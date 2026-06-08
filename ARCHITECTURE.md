
# Data Management System Project

## Goal
Create a document management system for an oil and gas company with a normalized metadata model, UUID-based file storage, and a browser UI that exposes the document hierarchy through logical navigation rather than physical folders.

The company has multiple sites, each with multiple units and equipment classes. A document revision is stored once, but it can be referenced in multiple logical views when needed.

## Current Architecture

The app now starts from a home hub with four entry points:
- Equipment Documents
- Best Practices
- Training
- Procedures

These are logical workspace views, not separate storage systems. Equipment Documents remains the main operational document domain, Best Practices runs from a separate database, Training uses standalone module records, and Procedures is treated as a controlled document section.

### Data Principles
- Metadata is normalized to avoid duplication across revisions and folder references.
- Each revision has one physical file pointer, usually UUID-based, and the UI resolves the file through metadata.
- Controlled folders and views require approval-based change handling.
- Best Practices is isolated in its own database for independent governance.
- Training modules are standalone learning assets and are not reused from Equipment Documents.

### Logical Folder Types
- Auto folders resolve content dynamically from metadata, such as site/unit/equipment-specific document groups.
- Controlled folders require approval before content can be added, removed, or changed.
- Uncontrolled folders allow direct user updates.

### Recent High-Level Changes
- Added a home icon hub for top-level navigation.
- Split Best Practices into a separate database and runtime payload.
- Added Training as a distinct content area with standalone dummy modules.
- Marked Training, Procedures, and Best Practices as controlled sections in the UI.
- Added approval-person metadata such as uploader, latest changed by, approved by, and related timestamps.
- Added a status hover tooltip for richer document metadata.
- Added history-safe back/forward navigation using virtual view state.
- Added standalone Training folders for onboarding, unit process learning, maintenance, and inventory.

## Working Folder 
Goal is to have efficient document retrieval and have the AI quickly read documents when queried

For the goals (fast retrieval + AI-readiness), the best pattern is hybrid separation:

1. Physical storage: semi-flat, bucketed structure
- Keep files in a content store organized by predictable buckets, not business hierarchy.
- Example bucketing keys: site, year, and hash prefix.
- This avoids huge single-directory performance problems and keeps writes/reads scalable.
2. Logical hierarchy: database-driven
- Keep your folder tree (Site → Unit → Equipment → Functional folders) as metadata only.
- A document revision is stored once, then mapped to many logical folders.
- This gives normalization and prevents duplicate binaries.
3. UUID indirection via schema
- Every physical file is stored with a UUID-based filename (example: uuid-a1b2.pdf).
- The UI, search, and AI layers do not resolve files by browsing folders directly.
- They resolve files through metadata in schema.sql (documents -> document_revisions -> equipment_documents/folder_references).
- This keeps physical storage simple while preserving rich logical navigation.

oil-gas-dms-poc/
├── 🌐 app/                      <-- Frontend Client Application
│   ├── index.html               <-- The Interactive Dashboard Tree UI
│   └── app.js                   <-- Unified Multi-System UI Logic (DMS + Maximo + JDE)
│
├── 💾 data/                     <-- Core Production-Ready Blueprints
│   ├── schema.sql               <-- MASTER ARCHITECTURE (Tables, Keys, and Constraints only)
│   └── documents/               <-- Target Production Storage Directory (Empty Blueprint)
│       ├── SITE-C072_Sarnia_Chemical_Plant/
│       │   ├── 35000_Feed_Gas_Compression/
│       │   │   └── 2026/
│       │   └── 36000_Utilities_and_Offsites/
│       │       └── 2026/
│       └── SITE-C073_Kearl_Lake_Refinery/
│           ├── 31000_Crude_Distillation/
│           │   └── 2026/
│           └── 34000_Hydrotreating/
│               └── 2026/
│
└── 🧪 mock_data/                <-- Mirrored Local Sandbox (Isolated Test Environment)
    ├── schema.sql               <-- TEST SCHEMA (Houses Tables + Inline Mock Data Inserts)
    └── documents/               <-- UUID-based physical store (bucketed by Site/Unit/Year)
        ├── SITE-C072_Sarnia_Chemical_Plant/
        │   ├── 35000_Feed_Gas_Compression/
        │   │   ├── 2025/
        │   │   │   ├── uuid-a1b2.pdf
        │   │   │   ├── uuid-a1b2-r2.pdf
        │   │   │   └── uuid-c3d4.docx
        │   │   └── 2026/
        │   │       ├── uuid-f7g8.pdf
        │   │       └── uuid-h9j0.docx
        │   └── 36000_Utilities_and_Offsites/
        │       ├── 2025/
        │       └── 2026/
        └── SITE-C073_Kearl_Lake_Refinery/
            ├── 31000_Crude_Distillation/
            │   ├── 2025/
            │   │   └── uuid-e5f6.pdf
            │   └── 2026/
            │       └── uuid-k1l2.pdf
            └── 34000_Hydrotreating/
                ├── 2025/
                └── 2026/


## Document Metadata Workflow
 👤 User uploads file via UI (example: P-101_PID.pdf)
          │
          ▼
 🖥️ DMS application logic (app.js)
          │
          ├──► 💾 Pipeline A: Physical file storage
          │    ├──► Sandbox write path:
          │    │    /mock_data/documents/SITE-C072_Sarnia_Chemical_Plant/35000_Feed_Gas_Compression/2026/uuid-a1b2.pdf
          │    └──► Production write path (future):
          │         /data/documents/SITE-C072_Sarnia_Chemical_Plant/35000_Feed_Gas_Compression/2026/uuid-a1b2.pdf
          │
          └──► 📊 Pipeline B: Metadata catalog (schema.sql)
               ├──► documents: business identity (doc number, title, type)
               ├──► document_revisions: revision + file_pointer_url (UUID path)
               └──► folder_references / equipment_documents: logical placement

### UUID Resolution Flow (How the app finds a file)
1. User navigates UI context (site, unit, equipment, folder).
2. App queries schema metadata tables to identify matching document revision rows.
3. App reads file_pointer_url from document_revisions for the selected current revision.
4. UUID file is loaded from storage, while business context remains metadata-driven.

This means UUID is the physical storage identity, and schema.sql is the translation layer that maps business context to the physical file.

### Why UUID Storage
- Prevents overwrite collisions: two users can upload files with the same business filename, but each upload is stored as a unique UUID file, so no file is accidentally replaced.
- Improves path reliability: UUID filenames avoid unsafe characters that commonly break links, browser paths, or cloud/object storage integrations.
- Protects revision history: each published revision gets a new UUID file, while schema metadata tracks which revision is current and preserves prior revisions.

### Separation of Code vs Live State
- schema.sql is a static blueprint in the workspace. It defines tables, constraints, and seed examples used to initialize an empty database.
- The live database file (for example dms_test.db, or a SQL Server database in local/dev) is the runtime system of record.
- After initialization, normal user actions (upload document, add revision, create work order, update status) are written by app logic directly to the live database via INSERT/UPDATE/DELETE.
- Those runtime writes do not modify schema.sql. The code file stays clean unless we intentionally change the data model itself.

Practical rule:
1. Change schema.sql only when the structure changes (new tables/columns/constraints).
2. Change live database contents through app workflows or SQL DML operations.


## Front End UI
The front end application will have an intuitive user interface as per visual below. 

Multiple folders can point to the same document. For an example, if there was a "ABC-123 Rev3" P&ID found inside "C072.../Equipment/P-101 Feedstock Pump/01 Technical Documents/", it will be the same "ABC-123 Rev3" document found inside the "C072/PIDs/" folder. 

Note that the schema.sql files house Core, Maximo and JD Edwards data. 
- Core DMS Data: Houses the master physical plant hierarchy, equipment specifications, and metadata records, mapping asset tags directly to their corresponding file pointer paths in storage [INDEX].
- Maximo CMMS Data: Tracks live operational maintenance context, capturing active field Work Orders, equipment safety statuses, and repair logs directly linked to asset tags [INDEX].
- JD Edwards Data: Manages warehouse supply chains and material inventory records, tracking warehouse stock counts, spare part costs, and manufacturer item numbers [INDEX].


Logical UI tree (metadata-driven)

📁 documents/
├── 🏭 SITE-C072_Sarnia_Chemical_Plant/
│   ├── 🌀 35000_Feed_Gas_Compression/
│   │   ├── 📁 PIDs/
│   │   ├── 📁 Procedures/
│   │   └── 📂 Equipment/
│   │       ├── 📁 Pumps/
│   │       │   ├── ⚙️ TAG-P-101_Feed_Stock_Pump/
│   │       │   │   ├── 📄 01 Technical Documents/
│   │       │   │   ├── 📄 02 Ops Procedures/
│   │       │   │   ├── 📄 03 Maintenance Procedures/
│   │       │   │   ├── 📄 04 Equipment Strategy/
│   │       │   │   ├── 📄 05 MOCs/
│   │       │   │   └── 📄 06 Repair History/
│   │       │   └── ⚙️ TAG-P-103_Charge_Pump/
│   │       └── 📁 Compressors/
│   └── 🌀 36000_Utilities_and_Offsites/
│       ├── 📁 PIDs/
│       ├── 📁 Procedures/
│       └── 📂 Equipment/
└── 🏭 SITE-C073_Kearl_Lake_Refinery/
    ├── 🌀 31000_Crude_Distillation/
    │   ├── 📁 PIDs/
    │   ├── 📁 Procedures/
    │   └── 📂 Equipment/
    │       └── 📁 Columns/
    │           └── ⚙️ TAG-T-201_Main_Fractionator/
    │               └── [01-06 Functional Folder Sub-Tree]
    └── 🌀 34000_Hydrotreating/
        ├── 📁 PIDs/
        ├── 📁 Procedures/
        └── 📂 Equipment/

Physical storage tree (UUID files)

📁 mock_data/documents/
├── SITE-C072_Sarnia_Chemical_Plant/
│   └── 35000_Feed_Gas_Compression/
│       ├── 2025/uuid-a1b2.pdf
│       ├── 2025/uuid-a1b2-r2.pdf
│       ├── 2025/uuid-c3d4.docx
│       ├── 2026/uuid-f7g8.pdf
│       └── 2026/uuid-h9j0.docx
└── SITE-C073_Kearl_Lake_Refinery/
    └── 31000_Crude_Distillation/
        ├── 2025/uuid-e5f6.pdf
        └── 2026/uuid-k1l2.pdf


## New Feature: Home Page Icon Hub

The application will add a dedicated home page that acts as the primary entry point. The top-level navigation will use four large icon tiles linking to:
- Equipment Documents
- Best Practices
- Training
- Procedures

### Purpose
- Provide a simple, high-visibility landing experience for users.
- Reduce clicks to common work areas.
- Keep the existing normalized document model while adding clearer navigation.

### Navigation Architecture
- Home page becomes the default start route/view.
- Each icon tile routes to a dedicated workspace view:
    - Equipment Documents: opens the current site/unit/equipment document tree.
    - Best Practices: opens curated reference content and standards.
    - Training: opens role/site-specific training content.
    - Procedures: opens operating and maintenance procedures views.
- Breadcrumbs should include Home as the first level for all four destinations.

### Information Architecture Rules
- Physical files remain stored once using UUID-based storage.
- These four home tiles are logical entry points only (metadata navigation), not separate file stores.
- A single document revision may appear in multiple sections via metadata mapping when needed.

### Data Model Implications
- Add a lightweight section taxonomy to classify content by home tile context:
        - `EQUIPMENT_DOCUMENTS`
    - `BEST_PRACTICES`
    - `TRAINING`
    - `PROCEDURES`
- Classification should be attached at metadata level (document/folder mapping), with no binary duplication.

## Best Practices Database Separation

Decision:
- Best Practices will run on a separate database from Equipment Documents to support independent growth and governance of corporate standards.

### Separate DB Objects
- Equipment Documents DB (existing): `mock_data/dms_test.db`
- Best Practices DB (new): `mock_data/best_practices_test.db`

### Best Practices Schema (separate)
- `disciplines`
- `standards_documents`
- `standard_revisions`

This schema is maintained in:
- `mock_data/best_practices_schema.sql`

### Runtime Export Path
- Best Practices runtime export is delivered to the app as:
    - `app/best-practices-runtime-data.js` (`window.BEST_PRACTICES_REPOSITORY`)
- Equipment runtime export remains:
    - `app/runtime-data.js`

### Mock Data Scaling Workflow
1. Populate Best Practices database using `mock_data/scripts/populate_best_practices_db.py`.
2. Export browser runtime payload using `mock_data/scripts/export_best_practices_runtime_data.py`.
3. App loads both runtime payloads, but keeps domains separated in UI and data handling.

### UI Behavior
- Best Practices subcategories (`Machinery`, `Process Engineering`, `Fixed Equipment`, `Civil`, `Instrumentation`, `Electrical`) query only Best Practices repository data.
- Equipment Documents views query only Equipment Documents repository data.

### UI/UX Requirements
- Tiles should be large, visually distinct, and readable at a glance.
- Each tile includes icon, label, and one-line description.
- Layout supports desktop and mobile breakpoints.
- Access to each tile should respect user role/profile permissions when authorization is enabled.

### Future Integration Notes
- Best Practices and Training can later include AI-assisted recommendations based on role, site, and recent document activity.
- Procedures can later integrate approval status indicators and revision timeline quick links.
