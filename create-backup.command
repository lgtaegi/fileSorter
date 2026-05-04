#!/bin/zsh
# fileSorter
# Created: 2026-05-04
# Created by lgtaegi

set -euo pipefail

cd "$(dirname "$0")" || exit 1

LABEL="${1:-manual update}"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
SLUG="$(printf '%s' "$LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"

if [ -z "$SLUG" ]; then
  SLUG="manual-update"
fi

BACKUP_ROOT="backups"
BACKUP_DIR="$BACKUP_ROOT/${STAMP}_${SLUG}"

mkdir -p "$BACKUP_DIR"

rsync -a \
  --exclude 'backups' \
  --exclude 'released' \
  --exclude 'undo-logs' \
  --exclude 'undo-backups' \
  --exclude '.DS_Store' \
  ./ "$BACKUP_DIR/"

cp "LATEST_UPDATE_NOTES.md" "$BACKUP_DIR/BACKUP_UPDATE_NOTES.md"

cat > "$BACKUP_DIR/BACKUP_INFO.txt" <<EOF
fileSorter
Created by lgtaegi
Backup created: $(date '+%Y-%m-%d %H:%M:%S %Z')
Backup label: $LABEL
Backup folder: $BACKUP_DIR
EOF

echo "Backup created:"
echo "$BACKUP_DIR"
