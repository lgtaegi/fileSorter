# fileSorter User Guide

Created: 2026-05-04  
Created by lgtaegi

## 1. Start the app

Run:

```bash
./start-ai.command
```

The browser should open automatically.

## 2. Choose a source folder

Use the `Source folder` area in the sidebar.

- Click `Browse` to pick a folder
- Click `Load` to refresh counts
- Review `Items`, `Files`, `Folders`, and `Sortable`

## 3. Sorter

Use `Sorter` when you want to organize files into folders.

Available controls:
- destination folder browse/select
- folder creation by `Year`, `Month`, `Day`, `Exact extension`, `Category`
- optional `Size rule`
- `Include files inside folders`
- `Copy instead of move`
- `Preview before applying changes`
- `Undo last sort`

Typical flow:
1. Pick source folder
2. Choose destination
3. Select folder rules
4. Preview sorting
5. Run sorting
6. Undo if needed

## 4. Utilities

### Global undo
- undo latest run
- undo a specific logged run

### Comparer
- compare `Folder A` and `Folder B`
- preview differences in 3 columns
- choose which side becomes the target
- replace changed files
- delete target-only files
- preview before running
- undo last compare

### File name cleaner
- trim whitespace
- replace spaces with underscores
- remove special characters
- add date prefix
- add sequence numbers
- preview first, then apply

### Duplicate finder
- compare by `hash`, `name`, or `size`
- choose to keep earliest or latest created file
- optional delete mode
- undo last duplicate cleanup

### Empty folder cleaner
- preview empty folders
- delete empty folders
- undo last empty-folder cleanup

### Move files out of folders
- flatten nested files into the selected utility folder
- optionally delete empty folders afterward
- undo last flatten

## 5. Undo system

Every real file-changing operation creates:
- a log file in `undo-logs/`
- recovery backup content in `undo-backups/` when needed

The safest workflow is:
1. preview first
2. run for real
3. verify result
4. use undo immediately if something is wrong

## 6. Project backups

Use:

```bash
./create-backup.command "short update label"
```

Example:

```bash
./create-backup.command "ui polish"
```

This creates a dated backup folder under `backups/` and includes:
- all runnable project files
- update notes
- documentation files

Excluded from backups:
- `undo-logs/`
- `undo-backups/`

## 7. Official release builds

Use:

```bash
./create-release.command "version-label" "short release summary"
```

Example:

```bash
./create-release.command "v1.0.0" "utilities polish"
```

This creates a release folder under `released/` and includes:
- runnable app files
- English and Korean release notes
- release info
- English and Korean documentation files

Included documentation:
- `README.md`
- `README_KO.md`
- `USER_GUIDE.md`
- `USER_GUIDE_KO.md`
- `RELEASE_NOTES.md`
- `RELEASE_NOTES_KO.md`

Excluded from releases:
- `undo-logs/`
- `undo-backups/`

Use releases for milestone versions you want to preserve as official snapshots.
