# fileSorter Update Notes

Created: 2026-05-04  
Created by lgtaegi

## Summary

This update reorganized the project into a cleaner, more professional toolbox structure and improved recovery safety.

## Detailed updates

### App structure
- reorganized the UI into `Sorter` and `Utilities`
- moved `Comparer` into the `Utilities` workspace
- made utility sections use fold-down accordion panels
- tightened the layout so the interface feels smaller and cleaner

### Undo system
- added global undo log listing
- added tool-specific undo buttons for sort, compare, rename, duplicate cleanup, empty folder cleanup, and flatten
- added backup-assisted undo support for delete and replace actions

### Sorter
- preserved source and destination folder selection
- kept preview-first flow
- kept category and size-rule sorting support

### Utilities
- comparer with preview and target sync options
- file name cleaner
- duplicate finder with keep-earliest / keep-latest behavior
- empty folder cleaner
- move files out of folders with empty-folder cleanup option

### Project operations
- added project-level documentation
- added a reusable backup creation script
- prepared backup folder structure for runnable snapshots
