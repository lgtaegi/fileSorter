# fileSorter Release Workflow

Created: 2026-05-04  
Created by lgtaegi

## Purpose

Use the release workflow when you want to preserve an official milestone version of `fileSorter`.

## Command

```bash
./create-release.command "version-label" "short release summary"
```

Example:

```bash
./create-release.command "v1.0.0" "official toolbox release"
```

## What gets included

Each release folder under `released/` includes:
- runnable app files
- current project source files
- `README.md`
- `README_KO.md`
- `USER_GUIDE.md`
- `USER_GUIDE_KO.md`
- `LATEST_UPDATE_NOTES.md`
- `RELEASE_INFO.txt`
- `RELEASE_NOTES.md`
- `RELEASE_NOTES_KO.md`

Each release excludes:
- `undo-logs/`
- `undo-backups/`

## Naming format

Release folder names use:

```text
YYYY-MM-DD_HH-MM-SS_version-summary
```

Example:

```text
2026-05-04_02-55-09_v1-0-0_official-toolbox-release
```

## Recommended workflow

1. Confirm the app runs correctly.
2. Update notes in `LATEST_UPDATE_NOTES.md` if needed.
3. Create the release.
4. Open the new folder under `released/`.
5. Check that the English and Korean documents are present.

## Notes

Use `backups/` for work-in-progress safety snapshots.  
Use `released/` for official milestone versions you want to keep or share.
