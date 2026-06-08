# DocManager PoC - Oil & Gas DMS

## Overview
This is a static Proof of Concept (PoC) for a document management interface used to browse assets, folders, and equipment documents.

The app is currently built with:
- `index.html` (UI layout + containers)
- `app.js` (upload, filter, search, and storage logic)
- `runtime-data.js` (equipment documents runtime payload)
- `best-practices-runtime-data.js` (best practices runtime payload)

## Data Domains

This PoC now uses two separate mock databases:
- Equipment Documents DB: `mock_data/dms_test.db`
- Best Practices DB: `mock_data/best_practices_test.db`

Best Practices records are intentionally separate from equipment documents to support scaled corporate standards content.

### Best Practices Scripts
- Populate DB: `mock_data/scripts/populate_best_practices_db.py`
- Export app runtime data: `mock_data/scripts/export_best_practices_runtime_data.py`
- Schema file: `mock_data/best_practices_schema.sql`

## Versioning
This project now follows **Semantic Versioning**:
- `MAJOR.MINOR.PATCH`
- `MAJOR`: breaking changes
- `MINOR`: new features (backward compatible)
- `PATCH`: fixes/tweaks (backward compatible)

### Current Version
**v0.9.2** (2026-06-05)

## Changelog
### v0.9.2 - 2026-06-05
- Split app logic out of `index.html` into `app.js` to separate layout and behavior.
- Renamed `P-101` display label to `Feed Stock Pump`.
- Added a new `Compressors` section under unit `35000 Feed Gas Compression` with new equipment `K-101`.
- Enriched 35000 equipment with additional seed documents and expanded repair history records.

### v0.9.1 - 2026-06-04
- Added hierarchical center-pane workspace views for sites, units, equipment groups, equipment, and document folders.
- Added Repair History incident subfolders so each past failure opens as its own workspace.
- Made breadcrumb trails clickable for parent navigation.
- Made Equipment In Scope rows link directly to equipment workspaces.
- Converted displayed engineering values to Imperial units.

### v0.9.0 - 2026-06-04
- Added back/forward navigation in center pane.
- Enhanced Advanced Filter with dependency ordering and field improvements.
- Added Equipment Type filtering with normalized display labels.
- Added controlled/uncontrolled folder indicators in center pane header.
- Added status-aware primary action button behavior:
  - Controlled folders: `Request Changes`
  - Uncontrolled folders: `Create New+` with `File`, `Folder`, and `Link`
- Disabled and greyed action button when no bottom folder is selected.

## Run / Open
No build step is required.

Open `index.html` in a browser.

## Backup Policy
Backups are stored in the local `backups/` folder using this format:
- `backups/vX.Y.Z_YYYY-MM-DD/`

Each backup folder contains a snapshot of:
- `app/`
- `mock_data/`
- `README.md`
- `CHANGELOG.md`
- `NEXT_STEPS.md`
- `ARCHITECTURE.md`
- `plan.md` when present

## Supporting Docs

- [Changelog](CHANGELOG.md)
- [Feature Summary](FEATURES_SUMMARY.md)
