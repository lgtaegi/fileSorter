# fileSorter

Created: 2026-05-04  
Created by lgtaegi

`fileSorter` is a local desktop-style file organization toolbox for macOS folders.

It currently includes:
- `Sorter` for previewing and organizing files by year, month, day, exact extension, category, and optional size rule
- `Utilities` for global undo, comparer actions, file name cleanup, duplicate detection, empty folder cleanup, and flattening nested folders
- automatic undo log creation for every real file-changing action
- backup-friendly project structure with runnable snapshots

Core project files:
- `index.html`
- `main.js`
- `shared.js`
- `style.css`
- `server.js`
- `start-ai.command`

Support files:
- `USER_GUIDE.md`
- `README_KO.md`
- `USER_GUIDE_KO.md`
- `LATEST_UPDATE_NOTES.md`
- `create-backup.command`
- `create-release.command`
- `backups/`
- `released/`
- `undo-logs/`
- `undo-backups/`

Backup and release snapshots exclude:
- `undo-logs/`
- `undo-backups/`

To run the app:

```bash
./start-ai.command
```

Then open:

```text
http://127.0.0.1:5000
```

If port `5000` is already occupied, stop the previous server first and run again.

## Backup and release

Create a backup snapshot:

```bash
./create-backup.command "short update label"
```

Create an official release snapshot:

```bash
./create-release.command "version-label" "short release summary"
```

Example:

```bash
./create-release.command "v1.0.0" "utilities polish"
```

Official releases include both English and Korean documentation:
- `README.md`
- `README_KO.md`
- `USER_GUIDE.md`
- `USER_GUIDE_KO.md`
- `RELEASE_NOTES.md`
- `RELEASE_NOTES_KO.md`
