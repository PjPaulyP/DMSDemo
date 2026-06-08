-- mock_data/best_practices_schema.sql
-- Dedicated Best Practices database blueprint (separate from equipment document database).

PRAGMA foreign_keys = ON;

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
