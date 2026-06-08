import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "mock_data" / "best_practices_test.db"
OUTPUT_PATH = ROOT / "app" / "best-practices-runtime-data.js"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    disciplines = cur.execute(
        """
        SELECT discipline_id, discipline_name
        FROM disciplines
        ORDER BY discipline_name
        """
    ).fetchall()

    docs = cur.execute(
        """
        SELECT d.standard_code,
               d.title,
               d.discipline_id,
               d.owner_team,
               r.revision_code,
               r.file_type,
               r.file_size_kb,
               r.effective_date,
             r.uploaded_by,
             r.uploaded_at,
             r.latest_changed_by,
             r.latest_changed_at,
             r.approved_by,
             r.approved_at,
             r.pending_approver,
             r.moc_initiator_name,
             r.superseded_by,
             r.superseded_at,
               r.approval_status,
               r.is_current
        FROM standards_documents d
        JOIN standard_revisions r ON r.standard_id = d.standard_id
        WHERE r.is_current = 1
        ORDER BY d.standard_code
        """
    ).fetchall()

    payload = {
        "database": "best_practices_test.db",
        "disciplines": [
            {
                "disciplineId": row["discipline_id"],
                "name": row["discipline_name"],
            }
            for row in disciplines
        ],
        "documents": [
            {
                "documentId": row["standard_code"],
                "title": row["title"],
                "disciplineId": row["discipline_id"],
                "revision": row["revision_code"],
                "status": row["approval_status"],
                "owner": row["approved_by"] or row["owner_team"],
                "effectiveDate": row["effective_date"],
                "fileType": row["file_type"],
                "fileSize": f"{row['file_size_kb']} KB",
                "uploadedBy": row["uploaded_by"] or row["owner_team"],
                "uploadedAt": row["uploaded_at"] or row["effective_date"],
                "latestChangedBy": row["latest_changed_by"] or row["uploaded_by"] or row["owner_team"],
                "latestChangedAt": row["latest_changed_at"] or row["effective_date"],
                "approvedBy": row["approved_by"] or row["owner_team"],
                "approvedAt": row["approved_at"] or row["effective_date"],
                "pendingApprover": row["pending_approver"] or "",
                "mocInitiator": row["moc_initiator_name"] or "",
                "supersededBy": row["superseded_by"] or "",
                "supersededAt": row["superseded_at"] or "",
            }
            for row in docs
        ],
    }

    lines = [
        "/* Generated from mock_data/best_practices_test.db. Do not edit manually. */",
        f"window.BEST_PRACTICES_REPOSITORY = {json.dumps(payload, indent=2)};",
        "",
    ]

    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    conn.close()

    print(f"Generated Best Practices runtime data: {OUTPUT_PATH}")
    print(f"Disciplines: {len(payload['disciplines'])} | Documents: {len(payload['documents'])}")


if __name__ == "__main__":
    main()
