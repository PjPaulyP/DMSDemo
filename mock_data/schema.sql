-- mock_data/schema.sql
-- DMS static blueprint (structure only).
-- Use this file to initialize an empty database. Runtime records belong in the live database, not here.

SET NOCOUNT ON;

CREATE TABLE sites (
    site_id INTEGER PRIMARY KEY,
    site_code VARCHAR(20) NOT NULL UNIQUE,
    site_name VARCHAR(200) NOT NULL
);

CREATE TABLE units (
    unit_id INTEGER PRIMARY KEY,
    site_id INTEGER NOT NULL,
    unit_code VARCHAR(20) NOT NULL,
    unit_name VARCHAR(200) NOT NULL,
    UNIQUE (site_id, unit_code),
    FOREIGN KEY (site_id) REFERENCES sites(site_id)
);

CREATE TABLE equipment (
    equipment_id INTEGER PRIMARY KEY,
    unit_id INTEGER NOT NULL,
    tag_number VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(200) NOT NULL,
    equipment_type VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    FOREIGN KEY (unit_id) REFERENCES units(unit_id)
);

-- Spec definitions by equipment type (matches equipment datasheet field model).
CREATE TABLE equipment_type_spec_fields (
    equipment_type VARCHAR(100) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (equipment_type, field_key)
);

-- Per-equipment spec values (normalized key/value datasheet model).
CREATE TABLE equipment_spec_values (
    equipment_id INTEGER NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    field_value VARCHAR(500) NOT NULL,
    PRIMARY KEY (equipment_id, field_key),
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

CREATE TABLE documents (
    document_id INTEGER PRIMARY KEY,
    doc_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    discipline VARCHAR(50) NOT NULL
);

CREATE TABLE document_revisions (
    revision_id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    revision_code VARCHAR(10) NOT NULL,
    file_pointer_url VARCHAR(500) NOT NULL,
    checksum_sha256 VARCHAR(64),
    published_at DATE NOT NULL,
    uploaded_by VARCHAR(200) NOT NULL DEFAULT 'System',
    uploaded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    latest_changed_by VARCHAR(200) NOT NULL DEFAULT 'System',
    latest_changed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    approved_by VARCHAR(200) NOT NULL DEFAULT 'System',
    approved_at DATE NOT NULL DEFAULT CURRENT_DATE,
    pending_approver VARCHAR(200),
    moc_id VARCHAR(50),
    moc_initiator_name VARCHAR(200),
    superseded_by VARCHAR(200),
    superseded_at DATE,
    is_current INTEGER NOT NULL DEFAULT 0,
    UNIQUE (document_id, revision_code),
    FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE TABLE equipment_documents (
    equipment_id INTEGER NOT NULL,
    revision_id INTEGER NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    PRIMARY KEY (equipment_id, revision_id),
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
    FOREIGN KEY (revision_id) REFERENCES document_revisions(revision_id)
);

CREATE TABLE folder_references (
    folder_ref_id INTEGER PRIMARY KEY,
    folder_path VARCHAR(500) NOT NULL,
    folder_type VARCHAR(20) NOT NULL DEFAULT 'UNCONTROLLED',
    approval_required INTEGER NOT NULL DEFAULT 0,
    auto_rule VARCHAR(500),
    revision_id INTEGER NOT NULL,
    CHECK (folder_type IN ('AUTO', 'CONTROLLED', 'UNCONTROLLED')),
    FOREIGN KEY (revision_id) REFERENCES document_revisions(revision_id)
);

CREATE TABLE maximo_work_orders (
    work_order_id INTEGER PRIMARY KEY,
    wo_number VARCHAR(30) NOT NULL UNIQUE,
    equipment_id INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    priority INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL,
    opened_at DATE NOT NULL,
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
);

CREATE TABLE jde_spare_parts (
    part_id INTEGER PRIMARY KEY,
    manufacturer_part_number VARCHAR(60) NOT NULL UNIQUE,
    part_description VARCHAR(255) NOT NULL,
    warehouse_code VARCHAR(30) NOT NULL,
    stock_on_hand INTEGER NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL
);

CREATE TABLE equipment_spare_parts (
    equipment_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    typical_qty INTEGER NOT NULL,
    PRIMARY KEY (equipment_id, part_id),
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
    FOREIGN KEY (part_id) REFERENCES jde_spare_parts(part_id)
);

GO

-- Strict spec enforcement: field_key must be valid for the equipment's type.
IF OBJECT_ID('trg_validate_equipment_spec_values', 'TR') IS NOT NULL
    DROP TRIGGER trg_validate_equipment_spec_values;
GO

CREATE TRIGGER trg_validate_equipment_spec_values
ON equipment_spec_values
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN equipment e
            ON e.equipment_id = i.equipment_id
        LEFT JOIN equipment_type_spec_fields ets
            ON ets.equipment_type = e.equipment_type
           AND ets.field_key = i.field_key
        WHERE ets.field_key IS NULL
    )
    BEGIN
        RAISERROR ('Invalid equipment spec field for equipment type.', 16, 1)
        ROLLBACK TRANSACTION
        RETURN
    END
END

GO

CREATE INDEX IX_units_site_id ON units(site_id);
CREATE INDEX IX_equipment_unit_id ON equipment(unit_id);
CREATE INDEX IX_document_revisions_document_id ON document_revisions(document_id);
CREATE INDEX IX_equipment_documents_revision_id ON equipment_documents(revision_id);
CREATE INDEX IX_folder_references_revision_id ON folder_references(revision_id);
CREATE INDEX IX_maximo_work_orders_equipment_id ON maximo_work_orders(equipment_id);
