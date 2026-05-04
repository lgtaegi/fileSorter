#!/bin/zsh
# fileSorter
# Created: 2026-05-04
# Created by lgtaegi

set -euo pipefail

cd "$(dirname "$0")" || exit 1

VERSION_LABEL="${1:-v0.0.0}"
RELEASE_SUMMARY="${2:-official release}"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
VERSION_SLUG="$(printf '%s' "$VERSION_LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"
SUMMARY_SLUG="$(printf '%s' "$RELEASE_SUMMARY" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"

if [ -z "$VERSION_SLUG" ]; then
  VERSION_SLUG="v0-0-0"
fi

if [ -z "$SUMMARY_SLUG" ]; then
  SUMMARY_SLUG="official-release"
fi

RELEASE_ROOT="released"
RELEASE_DIR="$RELEASE_ROOT/${STAMP}_${VERSION_SLUG}_${SUMMARY_SLUG}"

mkdir -p "$RELEASE_DIR"

rsync -a \
  --exclude 'backups' \
  --exclude 'released' \
  --exclude 'undo-logs' \
  --exclude 'undo-backups' \
  --exclude '.DS_Store' \
  ./ "$RELEASE_DIR/"

cat > "$RELEASE_DIR/RELEASE_INFO.txt" <<EOF
fileSorter
Created by lgtaegi
Release created: $(date '+%Y-%m-%d %H:%M:%S %Z')
Version label: $VERSION_LABEL
Release summary: $RELEASE_SUMMARY
Release folder: $RELEASE_DIR
EOF

cat > "$RELEASE_DIR/RELEASE_NOTES.md" <<EOF
# fileSorter Release Notes

Created: 2026-05-04  
Created by lgtaegi

## Release

- Version: $VERSION_LABEL
- Summary: $RELEASE_SUMMARY
- Built: $(date '+%Y-%m-%d %H:%M:%S %Z')

## Included

- runnable app files
- English and Korean documentation files
- English and Korean release notes
- current update notes

## Notes

Fill in milestone-specific notes here if this release is distributed or archived externally.
EOF

cat > "$RELEASE_DIR/RELEASE_NOTES_KO.md" <<EOF
# fileSorter 릴리즈 노트

Created: 2026-05-04  
Created by lgtaegi

## 릴리즈 정보

- 버전: $VERSION_LABEL
- 요약: $RELEASE_SUMMARY
- 생성 시각: $(date '+%Y-%m-%d %H:%M:%S %Z')

## 포함 항목

- 실행 가능한 앱 파일
- 영문/한글 문서 파일
- 영문/한글 릴리즈 노트
- 현재 업데이트 노트
- undo 로그 스냅샷

## 메모

외부 배포나 장기 보관용이면 여기에 이번 공식 버전의 변경 사항을 자세히 기록하면 됩니다.
EOF

echo "Release created:"
echo "$RELEASE_DIR"
