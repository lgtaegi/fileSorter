# fileSorter

Created: 2026-05-04  
Created by lgtaegi

`fileSorter`는 macOS 폴더를 대상으로 사용하는 로컬 데스크톱형 파일 정리 툴박스입니다.

현재 포함된 주요 기능:
- `Sorter`: 연도, 월, 일, 정확한 확장자, 카테고리, 선택형 사이즈 규칙으로 파일 정리
- `Utilities`: 전역 undo, comparer, 파일 이름 정리, 중복 파일 찾기, 빈 폴더 정리, 하위 폴더 파일 꺼내기
- 실제 변경 작업마다 자동 `undo log` 생성
- 백업과 공식 릴리즈를 만들기 쉬운 프로젝트 구조

핵심 프로젝트 파일:
- `index.html`
- `main.js`
- `shared.js`
- `style.css`
- `server.js`
- `start-ai.command`

지원 문서 및 도구:
- `README.md`
- `README_KO.md`
- `USER_GUIDE.md`
- `USER_GUIDE_KO.md`
- `LATEST_UPDATE_NOTES.md`
- `create-backup.command`
- `create-release.command`
- `backups/`
- `released/`
- `undo-logs/`
- `undo-backups/`

백업과 릴리즈 스냅샷에는 아래 폴더가 포함되지 않습니다:
- `undo-logs/`
- `undo-backups/`

앱 실행:

```bash
./start-ai.command
```

그 다음 브라우저에서:

```text
http://127.0.0.1:5000
```

포트 `5000`이 이미 사용 중이면 기존 서버를 종료한 뒤 다시 실행하면 됩니다.

## 백업과 공식 릴리즈

백업 생성:

```bash
./create-backup.command "짧은 업데이트 라벨"
```

공식 릴리즈 생성:

```bash
./create-release.command "버전 라벨" "짧은 릴리즈 요약"
```

예시:

```bash
./create-release.command "v1.0.0" "official toolbox release"
```

공식 릴리즈에는 영문/한글 `README`, 사용 가이드, 릴리즈 노트가 함께 포함됩니다.
