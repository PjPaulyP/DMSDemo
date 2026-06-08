# Changelog

## v0.9.3 - 2026-06-07
- Added a home hub for Equipment Documents, Best Practices, Training, and Procedures.
- Split Best Practices into a separate database and runtime payload.
- Added standalone Training modules and separated them from Equipment Documents.
- Marked Training, Procedures, and Best Practices as controlled sections in the UI.
- Added approval metadata fields such as uploader, latest changed by, approved by, and timestamps.
- Added status hover details for richer document metadata.
- Added history-safe back and forward navigation across the new virtual views.

## v0.9.2 - 2026-06-05
- Split app logic out of `index.html` into `app.js` to separate layout and behavior.
- Renamed `P-101` display label to `Feed Stock Pump`.
- Added a new `Compressors` section under unit `35000 Feed Gas Compression` with new equipment `K-101`.
- Enriched 35000 equipment with additional seed documents and expanded repair history records.
- Added supporting integration mock data (JDE parts and Maximo work orders) for `K-101`.

## v0.9.1 - 2026-06-04
- Added hierarchical center-pane workspace views for sites, units, equipment groups, equipment, and document folders.
- Added Repair History incident subfolders so each past failure opens as its own workspace.
- Made breadcrumb trails clickable for parent navigation.
- Made Equipment In Scope rows link directly to equipment workspaces.
- Converted displayed engineering values to Imperial units.

## v0.9.0 - 2026-06-04
- Added back/forward navigation in center pane.
- Enhanced Advanced Filter with dependency ordering and field improvements.
- Added Equipment Type filtering with normalized display labels.
- Added controlled/uncontrolled folder indicators in center pane header.
- Added status-aware primary action button behavior.
- Disabled and greyed action button when no bottom folder is selected.