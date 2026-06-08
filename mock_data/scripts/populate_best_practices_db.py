import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "mock_data" / "best_practices_test.db"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    conn.execute("PRAGMA foreign_keys = ON;")

    cur.executescript(
        """
        DROP TABLE IF EXISTS standard_revisions;
        DROP TABLE IF EXISTS standards_documents;
        DROP TABLE IF EXISTS disciplines;

        CREATE TABLE disciplines (
            discipline_id TEXT PRIMARY KEY,
            discipline_name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE standards_documents (
            standard_id INTEGER PRIMARY KEY,
            standard_code TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            discipline_id TEXT NOT NULL,
            owner_team TEXT NOT NULL,
            lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
            CHECK (lifecycle_status IN ('ACTIVE', 'RETIRED')),
            FOREIGN KEY (discipline_id) REFERENCES disciplines(discipline_id)
        );

        CREATE TABLE standard_revisions (
            revision_id INTEGER PRIMARY KEY,
            standard_id INTEGER NOT NULL,
            revision_code TEXT NOT NULL,
            file_pointer_url TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size_kb INTEGER NOT NULL,
            effective_date TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            latest_changed_by TEXT NOT NULL,
            latest_changed_at TEXT NOT NULL,
            approved_by TEXT NOT NULL,
            approved_at TEXT NOT NULL,
            pending_approver TEXT,
            moc_initiator_name TEXT,
            superseded_by TEXT,
            superseded_at TEXT,
            approval_status TEXT NOT NULL DEFAULT 'Approved',
            is_current INTEGER NOT NULL DEFAULT 1,
            UNIQUE (standard_id, revision_code),
            CHECK (approval_status IN ('Approved', 'For Review', 'Superseded')),
            FOREIGN KEY (standard_id) REFERENCES standards_documents(standard_id)
        );

        CREATE INDEX IX_standards_documents_discipline_id ON standards_documents(discipline_id);
        CREATE INDEX IX_standard_revisions_standard_id ON standard_revisions(standard_id);
        CREATE INDEX IX_standard_revisions_effective_date ON standard_revisions(effective_date);
        """
    )

    disciplines = [
        ("machinery", "Machinery"),
        ("process-engineering", "Process Engineering"),
        ("fixed-equipment", "Fixed Equipment"),
        ("civil", "Civil"),
        ("instrumentation", "Instrumentation"),
        ("electrical", "Electrical"),
    ]

    standards = [
        (1, "BP-MACH-001", "Rotating Equipment Alignment Standard", "machinery", "Corporate Reliability", "ACTIVE"),
        (2, "BP-MACH-002", "Compressor Seal System Best Practice", "machinery", "Corporate Reliability", "ACTIVE"),
        (3, "BP-PROC-001", "Process Hazard Review Standard", "process-engineering", "Corporate Process Engineering", "ACTIVE"),
        (4, "BP-PROC-002", "Steady-State Simulation Model Governance", "process-engineering", "Corporate Process Engineering", "ACTIVE"),
        (5, "BP-FE-001", "Pressure Vessel Inspection Interval Standard", "fixed-equipment", "Fixed Equipment Integrity", "ACTIVE"),
        (6, "BP-FE-002", "Heat Exchanger Mechanical Integrity Standard", "fixed-equipment", "Fixed Equipment Integrity", "ACTIVE"),
        (7, "BP-CIV-001", "Structural Steel Corrosion Mitigation Standard", "civil", "Corporate Civil", "ACTIVE"),
        (8, "BP-CIV-002", "Foundation Settlement Monitoring Standard", "civil", "Corporate Civil", "ACTIVE"),
        (9, "BP-INS-001", "Control Valve Sizing and Selection Standard", "instrumentation", "Corporate Instrumentation", "ACTIVE"),
        (10, "BP-INS-002", "SIS Proof Test Interval Standard", "instrumentation", "Corporate Instrumentation", "ACTIVE"),
        (11, "BP-ELEC-001", "MV Switchgear Maintenance Standard", "electrical", "Corporate Electrical", "ACTIVE"),
        (12, "BP-ELEC-002", "Motor Protection Relay Coordination Standard", "electrical", "Corporate Electrical", "ACTIVE"),
    ]

    discipline_people = {
        "machinery": {"uploaded_by": "Hannah Collins", "latest_changed_by": "Hannah Collins", "approved_by": "Rebecca Stone", "pending_approver": "Rebecca Stone", "moc_initiator_name": "Jordan Reed"},
        "process-engineering": {"uploaded_by": "Miguel Alvarez", "latest_changed_by": "Miguel Alvarez", "approved_by": "Daniel Kim", "pending_approver": "Daniel Kim", "moc_initiator_name": "Liam Chen"},
        "fixed-equipment": {"uploaded_by": "Priya Nair", "latest_changed_by": "Sofia Martinez", "approved_by": "Owen Taylor", "pending_approver": "Owen Taylor", "moc_initiator_name": "Emma Ward"},
        "civil": {"uploaded_by": "Liam Chen", "latest_changed_by": "Liam Chen", "approved_by": "Natalie Reed", "pending_approver": "Natalie Reed", "moc_initiator_name": "Avery Brooks"},
        "instrumentation": {"uploaded_by": "Avery Brooks", "latest_changed_by": "Avery Brooks", "approved_by": "Marcus Bell", "pending_approver": "Marcus Bell", "moc_initiator_name": "Noah Patel"},
        "electrical": {"uploaded_by": "Noah Patel", "latest_changed_by": "Noah Patel", "approved_by": "Emma Ward", "pending_approver": "Emma Ward", "moc_initiator_name": "Priya Nair"},
    }

    revisions = [
        (1001, 1, "R3", "best_practices/machinery/BP-MACH-001_R3.pdf", "pdf", 1320, "2026-02-15", discipline_people["machinery"]["uploaded_by"], "2026-02-15", discipline_people["machinery"]["latest_changed_by"], "2026-02-15", discipline_people["machinery"]["approved_by"], "2026-02-15", discipline_people["machinery"]["pending_approver"], discipline_people["machinery"]["moc_initiator_name"], None, None, "Approved", 1),
        (1002, 2, "R2", "best_practices/machinery/BP-MACH-002_R2.pdf", "pdf", 980, "2026-01-20", discipline_people["machinery"]["uploaded_by"], "2026-01-20", discipline_people["machinery"]["latest_changed_by"], "2026-01-20", discipline_people["machinery"]["approved_by"], "2026-01-20", discipline_people["machinery"]["pending_approver"], discipline_people["machinery"]["moc_initiator_name"], None, None, "Approved", 1),
        (1003, 3, "R1", "best_practices/process/BP-PROC-001_R1.pdf", "pdf", 1140, "2026-03-03", discipline_people["process-engineering"]["uploaded_by"], "2026-03-03", discipline_people["process-engineering"]["latest_changed_by"], "2026-03-03", discipline_people["process-engineering"]["approved_by"], "2026-03-03", discipline_people["process-engineering"]["pending_approver"], discipline_people["process-engineering"]["moc_initiator_name"], None, None, "Approved", 1),
        (1004, 4, "R1", "best_practices/process/BP-PROC-002_R1.pdf", "pdf", 860, "2026-03-22", discipline_people["process-engineering"]["uploaded_by"], "2026-03-22", discipline_people["process-engineering"]["latest_changed_by"], "2026-03-22", discipline_people["process-engineering"]["approved_by"], "2026-03-22", discipline_people["process-engineering"]["pending_approver"], discipline_people["process-engineering"]["moc_initiator_name"], None, None, "For Review", 1),
        (1005, 5, "R4", "best_practices/fixed/BP-FE-001_R4.pdf", "pdf", 1250, "2026-02-01", discipline_people["fixed-equipment"]["uploaded_by"], "2026-02-01", discipline_people["fixed-equipment"]["latest_changed_by"], "2026-02-01", discipline_people["fixed-equipment"]["approved_by"], "2026-02-01", discipline_people["fixed-equipment"]["pending_approver"], discipline_people["fixed-equipment"]["moc_initiator_name"], None, None, "Approved", 1),
        (1006, 6, "R2", "best_practices/fixed/BP-FE-002_R2.pdf", "pdf", 990, "2026-01-28", discipline_people["fixed-equipment"]["uploaded_by"], "2026-01-28", discipline_people["fixed-equipment"]["latest_changed_by"], "2026-01-28", discipline_people["fixed-equipment"]["approved_by"], "2026-01-28", discipline_people["fixed-equipment"]["pending_approver"], discipline_people["fixed-equipment"]["moc_initiator_name"], None, None, "Approved", 1),
        (1007, 7, "R1", "best_practices/civil/BP-CIV-001_R1.pdf", "pdf", 910, "2026-02-11", discipline_people["civil"]["uploaded_by"], "2026-02-11", discipline_people["civil"]["latest_changed_by"], "2026-02-11", discipline_people["civil"]["approved_by"], "2026-02-11", discipline_people["civil"]["pending_approver"], discipline_people["civil"]["moc_initiator_name"], None, None, "Approved", 1),
        (1008, 8, "R1", "best_practices/civil/BP-CIV-002_R1.pdf", "pdf", 870, "2026-03-01", discipline_people["civil"]["uploaded_by"], "2026-03-01", discipline_people["civil"]["latest_changed_by"], "2026-03-01", discipline_people["civil"]["approved_by"], "2026-03-01", discipline_people["civil"]["pending_approver"], discipline_people["civil"]["moc_initiator_name"], None, None, "Approved", 1),
        (1009, 9, "R3", "best_practices/instrumentation/BP-INS-001_R3.pdf", "pdf", 1080, "2026-02-25", discipline_people["instrumentation"]["uploaded_by"], "2026-02-25", discipline_people["instrumentation"]["latest_changed_by"], "2026-02-25", discipline_people["instrumentation"]["approved_by"], "2026-02-25", discipline_people["instrumentation"]["pending_approver"], discipline_people["instrumentation"]["moc_initiator_name"], None, None, "Approved", 1),
        (1010, 10, "R2", "best_practices/instrumentation/BP-INS-002_R2.pdf", "pdf", 940, "2026-01-18", discipline_people["instrumentation"]["uploaded_by"], "2026-01-18", discipline_people["instrumentation"]["latest_changed_by"], "2026-01-18", discipline_people["instrumentation"]["approved_by"], "2026-01-18", discipline_people["instrumentation"]["pending_approver"], discipline_people["instrumentation"]["moc_initiator_name"], None, None, "Approved", 1),
        (1011, 11, "R2", "best_practices/electrical/BP-ELEC-001_R2.pdf", "pdf", 1040, "2026-02-09", discipline_people["electrical"]["uploaded_by"], "2026-02-09", discipline_people["electrical"]["latest_changed_by"], "2026-02-09", discipline_people["electrical"]["approved_by"], "2026-02-09", discipline_people["electrical"]["pending_approver"], discipline_people["electrical"]["moc_initiator_name"], None, None, "Approved", 1),
        (1012, 12, "R1", "best_practices/electrical/BP-ELEC-002_R1.pdf", "pdf", 890, "2026-03-10", discipline_people["electrical"]["uploaded_by"], "2026-03-10", discipline_people["electrical"]["latest_changed_by"], "2026-03-10", discipline_people["electrical"]["approved_by"], "2026-03-10", discipline_people["electrical"]["pending_approver"], discipline_people["electrical"]["moc_initiator_name"], None, None, "For Review", 1),
    ]

    cur.executemany("INSERT INTO disciplines (discipline_id, discipline_name) VALUES (?, ?)", disciplines)
    cur.executemany(
        """
        INSERT INTO standards_documents (standard_id, standard_code, title, discipline_id, owner_team, lifecycle_status)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        standards,
    )
    cur.executemany(
        """
        INSERT INTO standard_revisions (revision_id, standard_id, revision_code, file_pointer_url, file_type, file_size_kb, effective_date, uploaded_by, uploaded_at, latest_changed_by, latest_changed_at, approved_by, approved_at, pending_approver, moc_initiator_name, superseded_by, superseded_at, approval_status, is_current)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        revisions,
    )

    conn.commit()
    conn.close()

    print(f"Populated Best Practices DB: {DB_PATH}")
    print(f"Disciplines: {len(disciplines)} | Standards: {len(standards)} | Revisions: {len(revisions)}")


if __name__ == "__main__":
    main()
