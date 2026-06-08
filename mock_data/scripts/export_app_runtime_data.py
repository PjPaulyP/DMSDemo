import json
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "mock_data" / "dms_test.db"
OUTPUT_PATH = ROOT / "app" / "runtime-data.js"

FOLDER_TYPE_POLICY = {
    "PIDS": {
        "code": "PIDS",
        "label": "PIDs",
        "controlled": True,
        "allowDelete": False,
        "actionMode": "request-changes",
        "integrations": {"jde": True, "maximo": False},
    },
    "PROCEDURES": {
        "code": "PROCEDURES",
        "label": "Procedures",
        "controlled": True,
        "allowDelete": False,
        "actionMode": "request-changes",
        "integrations": {"jde": True, "maximo": True},
    },
    "TD": {
        "code": "TD",
        "label": "01 Technical Documents",
        "controlled": True,
        "allowDelete": False,
        "actionMode": "request-changes",
        "integrations": {"jde": True, "maximo": False},
    },
    "OP": {
        "code": "OP",
        "label": "02 Ops Procedures",
        "controlled": True,
        "allowDelete": False,
        "actionMode": "request-changes",
        "integrations": {"jde": True, "maximo": True},
    },
    "MP": {
        "code": "MP",
        "label": "03 Maintenance Procedures",
        "controlled": True,
        "allowDelete": False,
        "actionMode": "request-changes",
        "integrations": {"jde": True, "maximo": True},
    },
    "ES": {
        "code": "ES",
        "label": "04 Equipment Strategy",
        "controlled": True,
        "allowDelete": False,
        "actionMode": "request-changes",
        "integrations": {"jde": False, "maximo": True},
    },
    "MOC": {
        "code": "MOC",
        "label": "05 MOCs",
        "controlled": False,
        "allowDelete": True,
        "actionMode": "create-new",
        "integrations": {"jde": False, "maximo": True},
    },
    "RH": {
        "code": "RH",
        "label": "06 Repair History",
        "controlled": False,
        "allowDelete": True,
        "actionMode": "create-new",
        "integrations": {"jde": False, "maximo": True},
    },
}

EQUIP_DATASHEET_FIELDS = {
    "pump": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Driver", "driver"],
        ["Design Flow", "designFlow"],
        ["Diff. Head", "differentialHead"],
        ["Speed", "speed"],
        ["Suction P", "suctionPressure"],
        ["Discharge P", "dischargePressure"],
        ["Design Temp", "designTemperature"],
        ["Seal Plan", "sealPlan"],
        ["NPSHr", "npshr"],
        ["MOC", "materials"],
    ],
    "compressor": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Driver", "driver"],
        ["Design Flow", "designFlow"],
        ["Speed", "speed"],
        ["Suction P", "suctionPressure"],
        ["Discharge P", "dischargePressure"],
        ["Design Temp", "designTemperature"],
        ["Seal Plan", "sealPlan"],
        ["MOC", "materials"],
    ],
    "heat-exchanger": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Hot Side", "hotSide"],
        ["Cold Side", "coldSide"],
        ["Design Duty", "designDuty"],
        ["Area", "heatTransferArea"],
        ["Design Temp", "designTemperature"],
        ["Design P", "designPressure"],
        ["TEMA", "temaClass"],
        ["Passes", "passes"],
        ["Approach", "approachTemperature"],
        ["MOC", "materials"],
    ],
    "vessel": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Design P", "designPressure"],
        ["Operating P", "operatingPressure"],
        ["Design Temp", "designTemperature"],
        ["Operating Temp", "operatingTemperature"],
        ["Diameter", "diameter"],
        ["Tangent-to-Tangent", "tangentLength"],
        ["Volume", "volume"],
        ["Nozzle Rating", "nozzleRating"],
        ["PSV Set", "psvSetPressure"],
        ["MOC", "materials"],
    ],
    "column": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Driver", "driver"],
        ["Design Flow", "designFlow"],
        ["Design Temp", "designTemperature"],
        ["MOC", "materials"],
    ],
    "heater": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Driver", "driver"],
        ["Design Flow", "designFlow"],
        ["Design Temp", "designTemperature"],
        ["MOC", "materials"],
    ],
    "pipe-network": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Driver", "driver"],
        ["Design Flow", "designFlow"],
        ["Design Temp", "designTemperature"],
        ["MOC", "materials"],
    ],
    "default": [
        ["Service", "service"],
        ["Type", "pumpType"],
        ["Driver", "driver"],
        ["Design Flow", "designFlow"],
        ["Design Temp", "designTemperature"],
        ["MOC", "materials"],
    ],
}


def slug(value: str) -> str:
    return "-".join(value.lower().replace("/", " ").replace("_", " ").split())


def type_group_label(equipment_type: str) -> str:
    mapping = {
        "Pump": "Pumps",
        "Compressor": "Compressors",
        "Heat Exchanger": "Heat Exchangers",
        "Vessel": "Vessels",
        "Column": "Columns",
        "Heater": "Heaters",
        "Pipe Network": "Pipe Networks",
    }
    return mapping.get(equipment_type, f"{equipment_type}s")


def display_site_code(site_code: str) -> str:
    return site_code[5:] if site_code.startswith("SITE-") else site_code


def display_tag(tag: str) -> str:
    return tag[4:] if tag.startswith("TAG-") else tag


def doc_folder_code(doc_type: str) -> str:
    if doc_type in ("PID", "Datasheet"):
        return "TD"
    if doc_type in ("Procedure", "Checklist"):
        return "OP"
    if doc_type in ("Maintenance Procedure", "Engineering Procedure"):
        return "MP"
    if doc_type == "Strategy":
        return "ES"
    if doc_type in ("Inspection", "Repair Report"):
        return "RH"
    if doc_type == "MOC":
        return "MOC"
    return "MOC"


def doc_taxonomy(doc_type: str) -> tuple[str, str]:
    if doc_type == "PID":
        return ("Drawings", "P&ID")
    if doc_type == "Datasheet":
        return ("Equipment Data", "Datasheet")
    if doc_type in ("Procedure", "Checklist"):
        return ("Procedures", "Ops Procedure")
    if doc_type == "Maintenance Procedure":
        return ("Procedures", "Maintenance Procedure")
    if doc_type == "Engineering Procedure":
        return ("Procedures", "Engineering Procedure")
    if doc_type == "Repair Report":
        return ("Reports", "Repair Report")
    if doc_type == "Inspection":
        return ("Reports", "Inspection Report")
    if doc_type == "MOC":
        return ("Other", "Change Notice")
    if doc_type == "Strategy":
        # Keep ES folder routing via legacyFolder fallback.
        return ("", "")
    return ("Other", "Change Notice")


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    sites = cur.execute("SELECT site_id, site_code, site_name FROM sites ORDER BY site_code").fetchall()
    units = cur.execute(
        """
        SELECT unit_id, site_id, unit_code, unit_name
        FROM units
        ORDER BY unit_code
        """
    ).fetchall()
    equipment = cur.execute(
        """
        SELECT equipment_id, unit_id, tag_number, equipment_name, equipment_type
        FROM equipment
        ORDER BY tag_number
        """
    ).fetchall()

    spec_rows = cur.execute(
        """
        SELECT e.tag_number, e.equipment_type, esv.field_key, esv.field_value
        FROM equipment_spec_values esv
        JOIN equipment e ON e.equipment_id = esv.equipment_id
        ORDER BY e.tag_number, esv.field_key
        """
    ).fetchall()

    wo_rows = cur.execute(
        """
        SELECT mw.wo_number, mw.equipment_id, mw.description, mw.priority, mw.status
        FROM maximo_work_orders mw
        """
    ).fetchall()

    part_rows = cur.execute(
        """
        SELECT e.tag_number, p.manufacturer_part_number, p.part_description, p.stock_on_hand
        FROM equipment_spare_parts esp
        JOIN equipment e ON e.equipment_id = esp.equipment_id
        JOIN jde_spare_parts p ON p.part_id = esp.part_id
        ORDER BY e.tag_number, p.manufacturer_part_number
        """
    ).fetchall()

    doc_rows = cur.execute(
        """
         SELECT dr.revision_id, dr.revision_code, dr.published_at, dr.is_current,
             dr.uploaded_by, dr.uploaded_at, dr.latest_changed_by, dr.latest_changed_at,
             dr.approved_by, dr.approved_at, dr.pending_approver, dr.moc_id,
             dr.moc_initiator_name, dr.superseded_by, dr.superseded_at,
               d.doc_number, d.title, d.doc_type,
               dr.file_pointer_url,
               e.tag_number,
               u.unit_code,
               s.site_code
        FROM document_revisions dr
        JOIN documents d ON d.document_id = dr.document_id
        LEFT JOIN equipment_documents ed ON ed.revision_id = dr.revision_id
        LEFT JOIN equipment e ON e.equipment_id = ed.equipment_id
        LEFT JOIN units u ON u.unit_id = e.unit_id
        LEFT JOIN sites s ON s.site_id = u.site_id
        ORDER BY dr.revision_id
        """
    ).fetchall()

    specs_by_tag = defaultdict(dict)
    for row in spec_rows:
        tag = row["tag_number"]
        specs_by_tag[tag][row["field_key"]] = row["field_value"]

    equip_class_by_tag = {}
    for row in equipment:
        equip_class_by_tag[row["tag_number"]] = slug(row["equipment_type"])

    equip_datasheet = {}
    for tag, values in specs_by_tag.items():
        equip_datasheet[tag] = {"tag": tag, "class": equip_class_by_tag.get(tag, "default"), **values}

    maximo_by_tag = defaultdict(list)
    eq_id_to_tag = {row["equipment_id"]: row["tag_number"] for row in equipment}
    for row in wo_rows:
        tag = eq_id_to_tag.get(row["equipment_id"])
        if not tag:
            continue
        maximo_by_tag[tag].append(
            {
                "wo": row["wo_number"],
                "desc": row["description"],
                "type": "Maintenance",
                "status": row["status"],
            }
        )

    jde_by_tag = defaultdict(list)
    for row in part_rows:
        status = "Active" if int(row["stock_on_hand"] or 0) > 0 else "Low Stock"
        jde_by_tag[row["tag_number"]].append(
            {
                "partNo": row["manufacturer_part_number"],
                "desc": row["part_description"],
                "qty": int(row["stock_on_hand"] or 0),
                "uom": "EA",
                "status": status,
            }
        )

    units_by_site = defaultdict(list)
    for row in units:
        units_by_site[row["site_id"]].append(row)

    equipment_by_unit = defaultdict(list)
    for row in equipment:
        equipment_by_unit[row["unit_id"]].append(row)

    tree = []
    for site in sites:
        site_node = {
            "id": site["site_code"],
            "label": f"{display_site_code(site['site_code'])} {site['site_name']}",
            "type": "site",
            "children": [],
        }
        for unit in sorted(units_by_site.get(site["site_id"], []), key=lambda x: x["unit_code"]):
            equipment_root_node = {
                "id": f"{unit['unit_code']}-EQUIPMENT",
                "label": "Equipment",
                "type": "eqgroup",
                "children": [],
            }

            unit_children = [
                {
                    "id": f"{unit['unit_code']}-PIDS",
                    "label": "PIDs",
                    "type": "folder",
                    "autoFolder": {
                        "scope": "unit",
                        "kind": "pids",
                        "siteCode": site["site_code"],
                        "unitCode": unit["unit_code"],
                    },
                },
                {
                    "id": f"{unit['unit_code']}-PROCEDURES",
                    "label": "Procedures",
                    "type": "folder",
                    "autoFolder": {
                        "scope": "unit",
                        "kind": "procedures",
                        "siteCode": site["site_code"],
                        "unitCode": unit["unit_code"],
                    },
                },
                equipment_root_node,
            ]

            by_type = defaultdict(list)
            for eq in equipment_by_unit.get(unit["unit_id"], []):
                by_type[eq["equipment_type"]].append(eq)

            for eq_type in sorted(by_type.keys()):
                group_node = {
                    "id": f"{unit['unit_code']}-{slug(eq_type)}",
                    "label": type_group_label(eq_type),
                    "type": "eqgroup",
                    "children": [],
                }
                for eq in sorted(by_type[eq_type], key=lambda e: e["tag_number"]):
                    eq_id = eq["tag_number"]
                    eq_node = {
                        "id": eq_id,
                        "label": f"{display_tag(eq_id)} - {eq['equipment_name']}",
                        "type": "equip",
                        "children": [
                            {"id": f"{eq_id}-TD", "label": "01 Technical Documents", "type": "folder"},
                            {"id": f"{eq_id}-OP", "label": "02 Ops Procedures", "type": "folder"},
                            {"id": f"{eq_id}-MP", "label": "03 Maintenance Procedures", "type": "folder"},
                            {"id": f"{eq_id}-ES", "label": "04 Equipment Strategy", "type": "folder"},
                            {"id": f"{eq_id}-MOC", "label": "05 MOCs", "type": "folder"},
                            {"id": f"{eq_id}-RH", "label": "06 Repair History", "type": "folder"},
                        ],
                    }
                    group_node["children"].append(eq_node)
                equipment_root_node["children"].append(group_node)

            site_node["children"].append(
                {
                    "id": f"{site['site_code']}-{unit['unit_code']}",
                    "label": f"{unit['unit_code']} {unit['unit_name']}",
                    "type": "unit",
                    "children": unit_children,
                }
            )

        tree.append(site_node)

    documents = []
    for row in doc_rows:
        tag = row["tag_number"] or ""
        folder_code = doc_folder_code(row["doc_type"])
        primary_type, secondary_type = doc_taxonomy(row["doc_type"])
        ext = Path(row["file_pointer_url"]).suffix.replace(".", "").lower() or "file"
        status = "Approved" if int(row["is_current"] or 0) == 1 else "Superseded"
        doc_id = f"{row['doc_number']}-{row['revision_code']}-{tag or row['revision_id']}"

        documents.append(
            {
                "documentId": doc_id,
                "fileName": row["title"],
                "revision": row["revision_code"],
                "extension": ext,
                "fileSize": "1.0",
                "documentDate": row["published_at"],
                "metadataTags": {
                    "site": row["site_code"] or "",
                    "unit": row["unit_code"] or "",
                    "primaryEquipment": tag,
                    "secondaryEquipment": "",
                    "primaryDocumentType": primary_type,
                    "secondaryDocumentType": secondary_type,
                    "legacyFolder": f"{tag}-{folder_code}" if tag else "",
                    "status": status,
                    "uploader": row["uploaded_by"] or "System",
                    "uploadedBy": row["uploaded_by"] or "System",
                    "uploadedAt": row["uploaded_at"] or row["published_at"],
                    "latestChangedBy": row["latest_changed_by"] or row["uploaded_by"] or "System",
                    "latestChangedAt": row["latest_changed_at"] or row["published_at"],
                    "approvedBy": row["approved_by"] or row["uploaded_by"] or "System",
                    "approvedAt": row["approved_at"] or row["published_at"],
                    "pendingApprover": row["pending_approver"] or "",
                    "mocId": row["moc_id"] or "",
                    "mocInitiator": row["moc_initiator_name"] or "",
                    "supersededBy": row["superseded_by"] or "",
                    "supersededAt": row["superseded_at"] or "",
                },
            }
        )

    training_documents = [
        {
            "documentId": "TRAIN-ONB-001",
            "fileName": "Onboarding 101 - Getting Started in the DMS",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "2.4",
            "documentDate": "2026-06-01",
            "metadataTags": {
                "site": "",
                "unit": "",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Onboarding",
                "legacyFolder": "",
                "trainingFolder": "onboarding",
                "status": "Approved",
                "uploader": "Maya Collins",
                "uploadedBy": "Maya Collins",
                "uploadedAt": "2026-06-01",
                "latestChangedBy": "Maya Collins",
                "latestChangedAt": "2026-06-01",
                "approvedBy": "Rebecca Stone",
                "approvedAt": "2026-06-02",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-ONB-002",
            "fileName": "Onboarding 102 - Site Access, Safety, and Workflows",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "2.8",
            "documentDate": "2026-06-01",
            "metadataTags": {
                "site": "",
                "unit": "",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Onboarding",
                "legacyFolder": "",
                "trainingFolder": "onboarding",
                "status": "Approved",
                "uploader": "Maya Collins",
                "uploadedBy": "Maya Collins",
                "uploadedAt": "2026-06-01",
                "latestChangedBy": "Maya Collins",
                "latestChangedAt": "2026-06-01",
                "approvedBy": "Rebecca Stone",
                "approvedAt": "2026-06-02",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-SARNIA-001",
            "fileName": "Aromatics Unit Process 101 - Process Overview",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "3.1",
            "documentDate": "2026-06-03",
            "metadataTags": {
                "site": "SITE-C072",
                "unit": "35000",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Aromatics Unit Process",
                "legacyFolder": "",
                "trainingFolder": "sarnia-chemical-plant-process",
                "status": "Approved",
                "uploader": "Jordan Reed",
                "uploadedBy": "Jordan Reed",
                "uploadedAt": "2026-06-03",
                "latestChangedBy": "Jordan Reed",
                "latestChangedAt": "2026-06-03",
                "approvedBy": "Natalie Reed",
                "approvedAt": "2026-06-04",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-SARNIA-002",
            "fileName": "Aromatics Unit Process 102 - Utilities, Offsites, and Safe Operations",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "3.0",
            "documentDate": "2026-06-03",
            "metadataTags": {
                "site": "SITE-C072",
                "unit": "36000",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Aromatics Unit Process",
                "legacyFolder": "",
                "trainingFolder": "sarnia-chemical-plant-process",
                "status": "Approved",
                "uploader": "Jordan Reed",
                "uploadedBy": "Jordan Reed",
                "uploadedAt": "2026-06-03",
                "latestChangedBy": "Jordan Reed",
                "latestChangedAt": "2026-06-03",
                "approvedBy": "Natalie Reed",
                "approvedAt": "2026-06-04",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-KEARL-001",
            "fileName": "Hydrotreating Unit Process 101 - Process Overview",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "3.2",
            "documentDate": "2026-06-04",
            "metadataTags": {
                "site": "SITE-C073",
                "unit": "31000",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Hydrotreating Unit Process",
                "legacyFolder": "",
                "trainingFolder": "kearl-lake-process",
                "status": "Approved",
                "uploader": "Avery Brooks",
                "uploadedBy": "Avery Brooks",
                "uploadedAt": "2026-06-04",
                "latestChangedBy": "Avery Brooks",
                "latestChangedAt": "2026-06-04",
                "approvedBy": "Owen Taylor",
                "approvedAt": "2026-06-05",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-KEARL-002",
            "fileName": "Hydrotreating Unit Process 102 - Unit Interactions and Operating Rounds",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "3.3",
            "documentDate": "2026-06-04",
            "metadataTags": {
                "site": "SITE-C073",
                "unit": "34000",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Hydrotreating Unit Process",
                "legacyFolder": "",
                "trainingFolder": "kearl-lake-process",
                "status": "Approved",
                "uploader": "Avery Brooks",
                "uploadedBy": "Avery Brooks",
                "uploadedAt": "2026-06-04",
                "latestChangedBy": "Avery Brooks",
                "latestChangedAt": "2026-06-04",
                "approvedBy": "Owen Taylor",
                "approvedAt": "2026-06-05",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-MAINT-001",
            "fileName": "Maintenance 101 - Pump Alignment Fundamentals",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "2.6",
            "documentDate": "2026-06-05",
            "metadataTags": {
                "site": "",
                "unit": "",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Maintenance",
                "legacyFolder": "",
                "trainingFolder": "maintenance",
                "status": "Approved",
                "uploader": "Noah Patel",
                "uploadedBy": "Noah Patel",
                "uploadedAt": "2026-06-05",
                "latestChangedBy": "Noah Patel",
                "latestChangedAt": "2026-06-05",
                "approvedBy": "Emma Ward",
                "approvedAt": "2026-06-06",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-MAINT-002",
            "fileName": "Maintenance 102 - Pump Alignment Verification and Follow-Up",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "2.5",
            "documentDate": "2026-06-05",
            "metadataTags": {
                "site": "",
                "unit": "",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Maintenance",
                "legacyFolder": "",
                "trainingFolder": "maintenance",
                "status": "Approved",
                "uploader": "Noah Patel",
                "uploadedBy": "Noah Patel",
                "uploadedAt": "2026-06-05",
                "latestChangedBy": "Noah Patel",
                "latestChangedAt": "2026-06-05",
                "approvedBy": "Emma Ward",
                "approvedAt": "2026-06-06",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-INV-001",
            "fileName": "Inventory 101 - Spare Parts Control Basics",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "2.2",
            "documentDate": "2026-06-06",
            "metadataTags": {
                "site": "",
                "unit": "",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Inventory",
                "legacyFolder": "",
                "trainingFolder": "inventory",
                "status": "Approved",
                "uploader": "Liam Chen",
                "uploadedBy": "Liam Chen",
                "uploadedAt": "2026-06-06",
                "latestChangedBy": "Liam Chen",
                "latestChangedAt": "2026-06-06",
                "approvedBy": "Priya Nair",
                "approvedAt": "2026-06-06",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
        {
            "documentId": "TRAIN-INV-002",
            "fileName": "Inventory 102 - Stockroom Transactions and Cycle Counts",
            "revision": "R1",
            "extension": "pdf",
            "fileSize": "2.3",
            "documentDate": "2026-06-06",
            "metadataTags": {
                "site": "",
                "unit": "",
                "primaryEquipment": "",
                "secondaryEquipment": "",
                "primaryDocumentType": "Training Module",
                "secondaryDocumentType": "Inventory",
                "legacyFolder": "",
                "trainingFolder": "inventory",
                "status": "Approved",
                "uploader": "Liam Chen",
                "uploadedBy": "Liam Chen",
                "uploadedAt": "2026-06-06",
                "latestChangedBy": "Liam Chen",
                "latestChangedAt": "2026-06-06",
                "approvedBy": "Priya Nair",
                "approvedAt": "2026-06-06",
                "pendingApprover": "",
                "mocId": "",
                "mocInitiator": "",
                "supersededBy": "",
                "supersededAt": "",
            },
        },
    ]

    payload = {
        "EQUIPMENT_DATA": {
            "TREE": tree,
            "FOLDER_TYPE_POLICY": FOLDER_TYPE_POLICY,
            "EQUIP_DATASHEET": equip_datasheet,
            "EQUIP_DATASHEET_FIELDS": EQUIP_DATASHEET_FIELDS,
        },
        "DOC_REPOSITORY": {"documents": documents},
        "TRAINING_DOCS": training_documents,
        "POC_MOCK_DATA": {
            "SEED_DOCS": [],
            "JDE_PARTS": jde_by_tag,
            "MAXIMO_WOS": maximo_by_tag,
        },
    }

    lines = [
        "/* Generated from mock_data/dms_test.db. Do not edit manually. */",
        f"window.EQUIPMENT_DATA = {json.dumps(payload['EQUIPMENT_DATA'], indent=2)};",
        f"window.DOC_REPOSITORY = {json.dumps(payload['DOC_REPOSITORY'], indent=2)};",
        "window.SQL_SITE_REPOSITORY = null;",
        f"window.TRAINING_DOCS = {json.dumps(payload['TRAINING_DOCS'], indent=2)};",
        f"window.POC_MOCK_DATA = {json.dumps(payload['POC_MOCK_DATA'], indent=2)};",
        "",
    ]

    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    conn.close()

    print(f"Generated runtime data: {OUTPUT_PATH}")
    print(f"Sites: {len(sites)} | Units: {len(units)} | Equipment: {len(equipment)} | Documents: {len(documents)} | Training modules: {len(training_documents)}")


if __name__ == "__main__":
    main()
