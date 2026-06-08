import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "mock_data" / "dms_test.db"

FOLDER_LABELS = {
    "TD": "01 Technical Documents",
    "OP": "02 Ops Procedures",
    "MP": "03 Maintenance Procedures",
    "ES": "04 Equipment Strategy",
    "MOC": "05 MOCs",
    "RH": "06 Repair History",
}


def execute_many(cur, sql, rows):
    cur.executemany(sql, rows)


def sanitize_tag(tag):
    return tag.lower().replace("-", "")


def relation_type_for_folder(folder_code):
    mapping = {
        "TD": "TECHNICAL_REFERENCE",
        "OP": "OPERATING_PROCEDURE",
        "MP": "MAINTENANCE_PROCEDURE",
        "ES": "STRATEGY_REFERENCE",
        "MOC": "CHANGE_REFERENCE",
        "RH": "REPAIR_HISTORY",
    }
    return mapping.get(folder_code, "REFERENCE")


def build_specs_for_equipment(equipment_rows):
    specs = []
    for equipment_id, _, tag, _, equipment_type, _ in equipment_rows:
        base_service = f"{tag} service"
        if equipment_type == "Pump":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Centrifugal"),
                (equipment_id, "driver", "Electric motor"),
                (equipment_id, "designFlow", "220 m3/h"),
                (equipment_id, "differentialHead", "95 m"),
                (equipment_id, "designTemperature", "65 C"),
                (equipment_id, "materials", "316SS / WCB"),
            ])
        elif equipment_type == "Compressor":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Centrifugal Compressor"),
                (equipment_id, "driver", "Electric motor"),
                (equipment_id, "designFlow", "145000 Sm3/h"),
                (equipment_id, "suctionPressure", "4.0 barg"),
                (equipment_id, "dischargePressure", "16.0 barg"),
                (equipment_id, "designTemperature", "58 C"),
                (equipment_id, "materials", "17-4PH / WCB"),
            ])
        elif equipment_type == "Heat Exchanger":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Shell and Tube"),
                (equipment_id, "hotSide", "Process stream"),
                (equipment_id, "coldSide", "Cooling water"),
                (equipment_id, "designDuty", "2.1 MW"),
                (equipment_id, "heatTransferArea", "120 m2"),
                (equipment_id, "designTemperature", "130 C"),
                (equipment_id, "materials", "CS shell, SS tubes"),
            ])
        elif equipment_type == "Vessel":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Pressure Vessel"),
                (equipment_id, "designPressure", "22 barg"),
                (equipment_id, "operatingPressure", "18 barg"),
                (equipment_id, "designTemperature", "85 C"),
                (equipment_id, "diameter", "2.8 m"),
                (equipment_id, "volume", "55 m3"),
                (equipment_id, "materials", "SA-516 Gr70"),
            ])
        elif equipment_type == "Column":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Distillation Column"),
                (equipment_id, "driver", "Natural draft"),
                (equipment_id, "designFlow", "185 m3/h"),
                (equipment_id, "designTemperature", "345 C"),
                (equipment_id, "materials", "CS shell, SS internals"),
            ])
        elif equipment_type == "Heater":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Fired Heater"),
                (equipment_id, "driver", "Dual fuel burner"),
                (equipment_id, "designFlow", "210 m3/h"),
                (equipment_id, "designTemperature", "360 C"),
                (equipment_id, "materials", "Cr-Mo coil"),
            ])
        elif equipment_type == "Pipe Network":
            specs.extend([
                (equipment_id, "service", base_service),
                (equipment_id, "pumpType", "Process piping"),
                (equipment_id, "driver", "N/A"),
                (equipment_id, "designFlow", "620 m3/h"),
                (equipment_id, "designTemperature", "45 C"),
                (equipment_id, "materials", "ASTM A106 Gr B"),
            ])
    return specs


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    cur.executescript(
        """
        DROP TABLE IF EXISTS equipment_spare_parts;
        DROP TABLE IF EXISTS jde_spare_parts;
        DROP TABLE IF EXISTS maximo_work_orders;
        DROP TABLE IF EXISTS folder_references;
        DROP TABLE IF EXISTS equipment_documents;
        DROP TABLE IF EXISTS equipment_spec_values;
        DROP TABLE IF EXISTS equipment_type_spec_fields;
        DROP TABLE IF EXISTS document_revisions;
        DROP TABLE IF EXISTS documents;
        DROP TABLE IF EXISTS equipment;
        DROP TABLE IF EXISTS units;
        DROP TABLE IF EXISTS sites;

        CREATE TABLE sites (
            site_id INTEGER PRIMARY KEY,
            site_code TEXT NOT NULL UNIQUE,
            site_name TEXT NOT NULL
        );

        CREATE TABLE units (
            unit_id INTEGER PRIMARY KEY,
            site_id INTEGER NOT NULL,
            unit_code TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            UNIQUE (site_id, unit_code),
            FOREIGN KEY (site_id) REFERENCES sites(site_id)
        );

        CREATE TABLE equipment (
            equipment_id INTEGER PRIMARY KEY,
            unit_id INTEGER NOT NULL,
            tag_number TEXT NOT NULL UNIQUE,
            equipment_name TEXT NOT NULL,
            equipment_type TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (unit_id) REFERENCES units(unit_id)
        );

        CREATE TABLE equipment_type_spec_fields (
            equipment_type TEXT NOT NULL,
            field_key TEXT NOT NULL,
            field_label TEXT NOT NULL,
            display_order INTEGER NOT NULL,
            PRIMARY KEY (equipment_type, field_key)
        );

        CREATE TABLE equipment_spec_values (
            equipment_id INTEGER NOT NULL,
            field_key TEXT NOT NULL,
            field_value TEXT NOT NULL,
            PRIMARY KEY (equipment_id, field_key),
            FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        );

        CREATE TABLE documents (
            document_id INTEGER PRIMARY KEY,
            doc_number TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            discipline TEXT NOT NULL
        );

        CREATE TABLE document_revisions (
            revision_id INTEGER PRIMARY KEY,
            document_id INTEGER NOT NULL,
            revision_code TEXT NOT NULL,
            file_pointer_url TEXT NOT NULL,
            checksum_sha256 TEXT,
            published_at TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            latest_changed_by TEXT NOT NULL,
            latest_changed_at TEXT NOT NULL,
            approved_by TEXT NOT NULL,
            approved_at TEXT NOT NULL,
            pending_approver TEXT,
            moc_id TEXT,
            moc_initiator_name TEXT,
            superseded_by TEXT,
            superseded_at TEXT,
            is_current INTEGER NOT NULL DEFAULT 0,
            UNIQUE (document_id, revision_code),
            FOREIGN KEY (document_id) REFERENCES documents(document_id)
        );

        CREATE TABLE equipment_documents (
            equipment_id INTEGER NOT NULL,
            revision_id INTEGER NOT NULL,
            relation_type TEXT NOT NULL,
            PRIMARY KEY (equipment_id, revision_id),
            FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
            FOREIGN KEY (revision_id) REFERENCES document_revisions(revision_id)
        );

        CREATE TABLE folder_references (
            folder_ref_id INTEGER PRIMARY KEY,
            folder_path TEXT NOT NULL,
            folder_type TEXT NOT NULL DEFAULT 'UNCONTROLLED',
            approval_required INTEGER NOT NULL DEFAULT 0,
            auto_rule TEXT,
            revision_id INTEGER NOT NULL,
            CHECK (folder_type IN ('AUTO', 'CONTROLLED', 'UNCONTROLLED')),
            FOREIGN KEY (revision_id) REFERENCES document_revisions(revision_id)
        );

        CREATE TABLE maximo_work_orders (
            work_order_id INTEGER PRIMARY KEY,
            wo_number TEXT NOT NULL UNIQUE,
            equipment_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            priority INTEGER NOT NULL,
            status TEXT NOT NULL,
            opened_at TEXT NOT NULL,
            FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
        );

        CREATE TABLE jde_spare_parts (
            part_id INTEGER PRIMARY KEY,
            manufacturer_part_number TEXT NOT NULL UNIQUE,
            part_description TEXT NOT NULL,
            warehouse_code TEXT NOT NULL,
            stock_on_hand INTEGER NOT NULL,
            unit_cost NUMERIC NOT NULL
        );

        CREATE TABLE equipment_spare_parts (
            equipment_id INTEGER NOT NULL,
            part_id INTEGER NOT NULL,
            typical_qty INTEGER NOT NULL,
            PRIMARY KEY (equipment_id, part_id),
            FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
            FOREIGN KEY (part_id) REFERENCES jde_spare_parts(part_id)
        );

        CREATE TRIGGER trg_validate_equipment_spec_values_insert
        BEFORE INSERT ON equipment_spec_values
        FOR EACH ROW
        BEGIN
            SELECT CASE
                WHEN NOT EXISTS (
                    SELECT 1
                    FROM equipment e
                    JOIN equipment_type_spec_fields f
                      ON f.equipment_type = e.equipment_type
                    WHERE e.equipment_id = NEW.equipment_id
                      AND f.field_key = NEW.field_key
                )
                THEN RAISE(ABORT, 'Invalid equipment spec field for equipment type.')
            END;
        END;

        CREATE TRIGGER trg_validate_equipment_spec_values_update
        BEFORE UPDATE ON equipment_spec_values
        FOR EACH ROW
        BEGIN
            SELECT CASE
                WHEN NOT EXISTS (
                    SELECT 1
                    FROM equipment e
                    JOIN equipment_type_spec_fields f
                      ON f.equipment_type = e.equipment_type
                    WHERE e.equipment_id = NEW.equipment_id
                      AND f.field_key = NEW.field_key
                )
                THEN RAISE(ABORT, 'Invalid equipment spec field for equipment type.')
            END;
        END;

        CREATE INDEX IX_units_site_id ON units(site_id);
        CREATE INDEX IX_equipment_unit_id ON equipment(unit_id);
        CREATE INDEX IX_document_revisions_document_id ON document_revisions(document_id);
        CREATE INDEX IX_equipment_documents_revision_id ON equipment_documents(revision_id);
        CREATE INDEX IX_folder_references_revision_id ON folder_references(revision_id);
        CREATE INDEX IX_maximo_work_orders_equipment_id ON maximo_work_orders(equipment_id);
        """
    )

    sites = [
        (1, "SITE-C072", "Sarnia Chemical Plant"),
        (2, "SITE-C073", "Kearl Lake Refinery"),
    ]

    units = [
        (10, 1, "35000", "Feed Gas Compression"),
        (11, 2, "31000", "Crude Distillation"),
        (12, 1, "36000", "Utilities and Offsites"),
        (13, 2, "34000", "Hydrotreating"),
    ]

    equipment = [
        (100, 10, "TAG-P-101", "Feed Stock Pump", "Pump", "ACTIVE"),
        (104, 10, "TAG-K-101A", "Feed Gas Compressor A", "Compressor", "ACTIVE"),
        (105, 10, "TAG-K-101B", "Feed Gas Compressor B", "Compressor", "ACTIVE"),
        (106, 10, "TAG-E-115", "Compressor Suction Cooler", "Heat Exchanger", "ACTIVE"),
        (107, 10, "TAG-V-120", "Compressor Knockout Drum", "Vessel", "ACTIVE"),
        (108, 10, "TAG-H-110", "Anti-Surge Heater", "Heater", "ACTIVE"),
        (109, 10, "TAG-P-103", "Charge Pump", "Pump", "ACTIVE"),
        (128, 10, "TAG-P-105", "Seal Flush Pump", "Pump", "ACTIVE"),
        (129, 10, "TAG-P-106", "Lube Oil Pump", "Pump", "ACTIVE"),
        (130, 10, "TAG-K-102", "Feed Gas Compressor C", "Compressor", "ACTIVE"),
        (131, 10, "TAG-E-116", "Interstage Cooler", "Heat Exchanger", "ACTIVE"),
        (132, 10, "TAG-V-121", "Suction Scrubber", "Vessel", "ACTIVE"),
        (133, 10, "TAG-H-111", "Fuel Gas Heater", "Heater", "ACTIVE"),
        (101, 11, "TAG-T-201", "Main Fractionator", "Column", "ACTIVE"),
        (116, 11, "TAG-P-201", "Reflux Pump", "Pump", "ACTIVE"),
        (117, 11, "TAG-E-205", "Overhead Condenser", "Heat Exchanger", "ACTIVE"),
        (118, 11, "TAG-V-210", "Reflux Drum", "Vessel", "ACTIVE"),
        (119, 11, "TAG-H-215", "Crude Preheat Heater", "Heater", "ACTIVE"),
        (120, 11, "TAG-T-202", "Preflash Column", "Column", "ACTIVE"),
        (121, 11, "TAG-K-220", "Wet Gas Compressor", "Compressor", "ACTIVE"),
        (102, 12, "TAG-U-401", "Cooling Water Header", "Pipe Network", "ACTIVE"),
        (110, 12, "TAG-P-401", "Condensate Transfer Pump", "Pump", "ACTIVE"),
        (111, 12, "TAG-K-410", "Instrument Air Compressor", "Compressor", "ACTIVE"),
        (112, 12, "TAG-E-420", "Cooling Water Exchanger", "Heat Exchanger", "ACTIVE"),
        (113, 12, "TAG-V-430", "Utility Surge Drum", "Vessel", "ACTIVE"),
        (114, 12, "TAG-H-440", "Glycol Reboiler", "Heater", "ACTIVE"),
        (115, 12, "TAG-T-450", "Utility Stabilizer Column", "Column", "ACTIVE"),
        (103, 13, "TAG-H-301", "Feed Heater", "Heater", "ACTIVE"),
        (122, 13, "TAG-P-301", "Reactor Feed Pump", "Pump", "ACTIVE"),
        (123, 13, "TAG-E-305", "Reactor Effluent Exchanger", "Heat Exchanger", "ACTIVE"),
        (124, 13, "TAG-V-310", "Separator Vessel", "Vessel", "ACTIVE"),
        (125, 13, "TAG-H-320", "Charge Heater", "Heater", "ACTIVE"),
        (126, 13, "TAG-T-330", "Stripper Column", "Column", "ACTIVE"),
        (127, 13, "TAG-K-340", "Recycle Gas Compressor", "Compressor", "ACTIVE"),
    ]

    equipment_type_spec_fields = [
        ("Pump", "service", "Service", 1),
        ("Pump", "pumpType", "Type", 2),
        ("Pump", "driver", "Driver", 3),
        ("Pump", "designFlow", "Design Flow", 4),
        ("Pump", "differentialHead", "Diff. Head", 5),
        ("Pump", "speed", "Speed", 6),
        ("Pump", "suctionPressure", "Suction P", 7),
        ("Pump", "dischargePressure", "Discharge P", 8),
        ("Pump", "designTemperature", "Design Temp", 9),
        ("Pump", "sealPlan", "Seal Plan", 10),
        ("Pump", "npshr", "NPSHr", 11),
        ("Pump", "materials", "MOC", 12),
        ("Compressor", "service", "Service", 1),
        ("Compressor", "pumpType", "Type", 2),
        ("Compressor", "driver", "Driver", 3),
        ("Compressor", "designFlow", "Design Flow", 4),
        ("Compressor", "speed", "Speed", 5),
        ("Compressor", "suctionPressure", "Suction P", 6),
        ("Compressor", "dischargePressure", "Discharge P", 7),
        ("Compressor", "designTemperature", "Design Temp", 8),
        ("Compressor", "sealPlan", "Seal Plan", 9),
        ("Compressor", "materials", "MOC", 10),
        ("Heat Exchanger", "service", "Service", 1),
        ("Heat Exchanger", "pumpType", "Type", 2),
        ("Heat Exchanger", "hotSide", "Hot Side", 3),
        ("Heat Exchanger", "coldSide", "Cold Side", 4),
        ("Heat Exchanger", "designDuty", "Design Duty", 5),
        ("Heat Exchanger", "heatTransferArea", "Area", 6),
        ("Heat Exchanger", "designTemperature", "Design Temp", 7),
        ("Heat Exchanger", "designPressure", "Design P", 8),
        ("Heat Exchanger", "temaClass", "TEMA", 9),
        ("Heat Exchanger", "passes", "Passes", 10),
        ("Heat Exchanger", "approachTemperature", "Approach", 11),
        ("Heat Exchanger", "materials", "MOC", 12),
        ("Vessel", "service", "Service", 1),
        ("Vessel", "pumpType", "Type", 2),
        ("Vessel", "designPressure", "Design P", 3),
        ("Vessel", "operatingPressure", "Operating P", 4),
        ("Vessel", "designTemperature", "Design Temp", 5),
        ("Vessel", "operatingTemperature", "Operating Temp", 6),
        ("Vessel", "diameter", "Diameter", 7),
        ("Vessel", "tangentLength", "Tangent-to-Tangent", 8),
        ("Vessel", "volume", "Volume", 9),
        ("Vessel", "nozzleRating", "Nozzle Rating", 10),
        ("Vessel", "psvSetPressure", "PSV Set", 11),
        ("Vessel", "materials", "MOC", 12),
        ("Heater", "service", "Service", 1),
        ("Heater", "pumpType", "Type", 2),
        ("Heater", "driver", "Driver", 3),
        ("Heater", "designFlow", "Design Flow", 4),
        ("Heater", "designTemperature", "Design Temp", 5),
        ("Heater", "materials", "MOC", 6),
        ("Column", "service", "Service", 1),
        ("Column", "pumpType", "Type", 2),
        ("Column", "driver", "Driver", 3),
        ("Column", "designFlow", "Design Flow", 4),
        ("Column", "designTemperature", "Design Temp", 5),
        ("Column", "materials", "MOC", 6),
        ("Pipe Network", "service", "Service", 1),
        ("Pipe Network", "pumpType", "Type", 2),
        ("Pipe Network", "driver", "Driver", 3),
        ("Pipe Network", "designFlow", "Design Flow", 4),
        ("Pipe Network", "designTemperature", "Design Temp", 5),
        ("Pipe Network", "materials", "MOC", 6),
    ]

    equipment_spec_values = build_specs_for_equipment(equipment)

    documents = []
    document_revisions = []
    equipment_documents = []
    folder_references = []

    next_document_id = 1000
    next_revision_id = 2000
    next_folder_ref_id = 1

    unit_path_by_id = {
        10: "35000_Feed_Gas_Compression",
        11: "31000_Crude_Distillation",
        12: "36000_Utilities_and_Offsites",
        13: "34000_Hydrotreating",
    }

    site_path_by_id = {
        1: "SITE-C072_Sarnia_Chemical_Plant",
        2: "SITE-C073_Kearl_Lake_Refinery",
    }

    site_id_by_unit_id = {unit_id: site_id for unit_id, site_id, _, _ in units}

    folder_doc_templates = {
        "TD": [
            ("PID", "P&ID", "Process", "pdf"),
            ("Datasheet", "Mechanical Datasheet", "Mechanical", "pdf"),
        ],
        "OP": [
            ("Procedure", "Start-up Procedure", "Operations", "docx"),
            ("Checklist", "Shift Checklist", "Operations", "docx"),
        ],
        "MP": [
            ("Maintenance Procedure", "Preventive Maintenance Procedure", "Maintenance", "docx"),
            ("Engineering Procedure", "Overhaul Engineering Procedure", "Maintenance", "docx"),
        ],
        "ES": [
            ("Strategy", "Equipment Strategy Plan", "Reliability", "pdf"),
            ("Strategy", "Criticality and Sparing Strategy", "Reliability", "pdf"),
        ],
        "MOC": [
            ("MOC", "MOC Technical Assessment", "Process", "pdf"),
            ("MOC", "MOC Closure Memo", "Process", "pdf"),
        ],
        "RH": [
            ("Repair Report", "Repair Completion Report", "Maintenance", "pdf"),
            ("Inspection", "Inspection and Findings Report", "Mechanical", "pdf"),
        ],
    }

    folder_people = {
        "TD": {"uploaded_by": "Hannah Collins", "latest_changed_by": "Hannah Collins", "approved_by": "Rebecca Stone", "moc_initiator_name": "Avery Brooks"},
        "OP": {"uploaded_by": "Miguel Alvarez", "latest_changed_by": "Miguel Alvarez", "approved_by": "Rebecca Stone", "moc_initiator_name": "Avery Brooks"},
        "MP": {"uploaded_by": "Priya Nair", "latest_changed_by": "Sofia Martinez", "approved_by": "Owen Taylor", "moc_initiator_name": "Jordan Reed"},
        "ES": {"uploaded_by": "Liam Chen", "latest_changed_by": "Liam Chen", "approved_by": "Owen Taylor", "moc_initiator_name": "Jordan Reed"},
        "MOC": {"uploaded_by": "Avery Brooks", "latest_changed_by": "Avery Brooks", "approved_by": "Natalie Reed", "moc_initiator_name": "Jordan Reed"},
        "RH": {"uploaded_by": "Noah Patel", "latest_changed_by": "Noah Patel", "approved_by": "Emma Ward", "moc_initiator_name": "Marcus Bell"},
    }

    for equipment_id, unit_id, tag, equipment_name, equipment_type, _ in equipment:
        site_id = site_id_by_unit_id[unit_id]
        site_path = site_path_by_id[site_id]
        unit_path = unit_path_by_id[unit_id]
        equipment_group_label = f"{equipment_type}s"
        equipment_label_path = f"{tag}_{equipment_name.replace(' ', '_')}"

        for folder_code, doc_defs in folder_doc_templates.items():
            for doc_idx, (doc_type, suffix, discipline, extension) in enumerate(doc_defs, start=1):
                doc_number = f"{tag}-{folder_code}-{doc_idx:02d}"
                title = f"{equipment_name} {suffix}"

                documents.append((next_document_id, doc_number, title, doc_type, discipline))

                year = "2025" if doc_idx == 1 else "2026"
                uuid_file = f"uuid-{sanitize_tag(tag)}-{folder_code.lower()}-{doc_idx}.{extension}"
                relative_pointer = f"../mock_data/documents/{site_path}/{unit_path}/{year}/{uuid_file}"
                checksum = f"{next_revision_id:064x}"
                published_date = "2025-06-15" if doc_idx == 1 else "2026-02-15"
                people = folder_people[folder_code]
                uploaded_date = published_date
                latest_changed_date = published_date if doc_idx == 1 else "2026-03-15"
                approved_date = published_date
                pending_approver = people["approved_by"] if doc_idx == 2 and folder_code in {"TD", "OP", "MP", "ES"} else None
                moc_id = f"MOC-{tag}-{folder_code}-{doc_idx:02d}" if folder_code == "MOC" else None
                superseded_by = None
                superseded_at = None

                document_revisions.append(
                    (
                        next_revision_id,
                        next_document_id,
                        "R0",
                        relative_pointer,
                        checksum,
                        published_date,
                        people["uploaded_by"],
                        uploaded_date,
                        people["latest_changed_by"],
                        latest_changed_date,
                        people["approved_by"],
                        approved_date,
                        pending_approver,
                        moc_id,
                        people["moc_initiator_name"] if folder_code == "MOC" else None,
                        superseded_by,
                        superseded_at,
                        1,
                    )
                )
                equipment_documents.append((equipment_id, next_revision_id, relation_type_for_folder(folder_code)))

                folder_references.append(
                    (
                        next_folder_ref_id,
                        f"/{site_path}/{unit_path}/Equipment/{equipment_group_label}/{equipment_label_path}/{FOLDER_LABELS[folder_code]}",
                        "CONTROLLED" if folder_code in {"TD", "OP", "MP", "ES"} else "UNCONTROLLED",
                        1 if folder_code in {"TD", "OP", "MP", "ES"} else 0,
                        None,
                        next_revision_id,
                    )
                )

                next_document_id += 1
                next_revision_id += 1
                next_folder_ref_id += 1

    maximo_work_orders = [
        (5000, "WO-2026-00091", 100, "Replace pump mechanical seal", 2, "IN_PROGRESS", "2026-05-02"),
        (5001, "WO-2026-00107", 104, "Inspect compressor anti-surge loop", 3, "PLANNED", "2026-05-11"),
        (5002, "WO-2026-00131", 130, "Check compressor vibration trend", 2, "WAPPR", "2026-05-18"),
    ]

    jde_spare_parts = [
        (7000, "MFG-SEAL-44A", "Mechanical seal kit for TAG-P-101", "WH-C072-A", 8, 1299.50),
        (7001, "MFG-GASK-11C", "Column manway gasket set", "WH-C073-B", 15, 239.00),
        (7002, "MFG-BRG-2K1", "Compressor bearing cartridge", "WH-C072-A", 4, 3599.00),
    ]

    equipment_spare_parts = [
        (100, 7000, 1),
        (101, 7001, 2),
        (104, 7002, 1),
        (130, 7002, 1),
    ]

    execute_many(cur, "INSERT INTO sites VALUES (?, ?, ?)", sites)
    execute_many(cur, "INSERT INTO units VALUES (?, ?, ?, ?)", units)
    execute_many(cur, "INSERT INTO equipment VALUES (?, ?, ?, ?, ?, ?)", equipment)
    execute_many(cur, "INSERT INTO equipment_type_spec_fields VALUES (?, ?, ?, ?)", equipment_type_spec_fields)
    execute_many(cur, "INSERT INTO equipment_spec_values VALUES (?, ?, ?)", equipment_spec_values)
    execute_many(cur, "INSERT INTO documents VALUES (?, ?, ?, ?, ?)", documents)
    execute_many(cur, "INSERT INTO document_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", document_revisions)
    execute_many(cur, "INSERT INTO equipment_documents VALUES (?, ?, ?)", equipment_documents)
    execute_many(cur, "INSERT INTO folder_references VALUES (?, ?, ?, ?, ?, ?)", folder_references)
    execute_many(cur, "INSERT INTO maximo_work_orders VALUES (?, ?, ?, ?, ?, ?, ?)", maximo_work_orders)
    execute_many(cur, "INSERT INTO jde_spare_parts VALUES (?, ?, ?, ?, ?, ?)", jde_spare_parts)
    execute_many(cur, "INSERT INTO equipment_spare_parts VALUES (?, ?, ?)", equipment_spare_parts)

    conn.commit()

    for revision_id, pointer in cur.execute("SELECT revision_id, file_pointer_url FROM document_revisions ORDER BY revision_id").fetchall():
        # file_pointer_url values are stored relative to app/ (e.g., ../mock_data/documents/...)
        path = (ROOT / "app" / pointer).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(f"Mock document placeholder for revision {revision_id}\n", encoding="utf-8")

    checks = [
        "sites",
        "units",
        "equipment",
        "equipment_type_spec_fields",
        "equipment_spec_values",
        "documents",
        "document_revisions",
        "equipment_documents",
        "folder_references",
        "maximo_work_orders",
        "jde_spare_parts",
        "equipment_spare_parts",
    ]

    print(f"Populated: {DB_PATH}")
    for table in checks:
        count = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"{table}: {count}")

    conn.close()


if __name__ == "__main__":
    main()
