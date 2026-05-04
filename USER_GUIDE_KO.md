# fileSorter 사용 가이드

Created: 2026-05-04  
Created by lgtaegi

## 1. 앱 실행

아래를 실행합니다:

```bash
./start-ai.command
```

정상이면 브라우저가 자동으로 열립니다.

## 2. Source folder 선택

사이드바의 `Source folder` 영역을 사용합니다.

- `Browse`를 눌러 폴더 선택
- `Load`를 눌러 개수 새로고침
- `Items`, `Files`, `Folders`, `Sortable` 수치 확인

## 3. Sorter

`Sorter`는 파일을 규칙에 따라 폴더로 정리할 때 사용합니다.

주요 기능:
- destination folder 선택 및 browse
- `Year`, `Month`, `Day`, `Exact extension`, `Category` 기준 폴더 생성
- 선택형 `Size rule`
- `Include files inside folders`
- `Copy instead of move`
- `Preview before applying changes`
- `Undo last sort`

추천 흐름:
1. source folder 선택
2. destination folder 선택
3. 정리 규칙 선택
4. preview 실행
5. 실제 sorting 실행
6. 필요하면 undo 실행

## 4. Utilities

### Global undo
- 가장 최근 작업 undo
- 특정 로그를 골라서 undo

### Comparer
- `Folder A` 와 `Folder B` 비교
- 3열 결과로 차이 확인
- 어느 쪽을 기준으로 맞출지 선택
- 다른 파일 교체
- target에만 있는 파일 삭제
- 실행 전 preview
- `Undo last compare`

### File name cleaner
- 앞뒤 공백 제거
- 공백을 underscore로 변경
- 특수문자 제거
- 날짜 prefix 추가
- 순번 추가
- preview 후 적용

### Duplicate finder
- `hash`, `name`, `size` 기준 비교
- 가장 먼저 생성된 파일 유지 또는 가장 나중 파일 유지 선택
- 필요시 중복 파일 삭제
- `Undo last duplicate cleanup`

### Empty folder cleaner
- 빈 폴더 preview
- 빈 폴더 삭제
- `Undo last empty-folder cleanup`

### Move files out of folders
- 선택한 utility folder 기준으로 하위 폴더 안 파일을 바깥으로 꺼냄
- 필요시 빈 폴더 삭제
- `Undo last flatten`

## 5. Undo 시스템

실제 파일 변경 작업이 실행되면 항상 다음이 생성됩니다:
- `undo-logs/` 안의 로그 파일
- 필요할 경우 `undo-backups/` 안의 복구용 백업 데이터

안전한 사용 순서:
1. 먼저 preview
2. 실제 실행
3. 결과 확인
4. 이상이 있으면 바로 undo

## 6. 프로젝트 백업

아래 명령으로 백업 생성:

```bash
./create-backup.command "짧은 업데이트 라벨"
```

예시:

```bash
./create-backup.command "ui polish"
```

이 명령은 `backups/` 아래에 날짜가 붙은 백업 폴더를 만들고 아래 내용을 포함합니다:
- 실행 가능한 프로젝트 파일
- 업데이트 노트
- 프로젝트 문서

백업에서 제외되는 항목:
- `undo-logs/`
- `undo-backups/`

## 7. 공식 릴리즈 빌드

아래 명령으로 공식 릴리즈 생성:

```bash
./create-release.command "버전 라벨" "짧은 릴리즈 요약"
```

예시:

```bash
./create-release.command "v1.0.0" "official toolbox release"
```

이 명령은 `released/` 아래에 공식 릴리즈 폴더를 만들고 아래 내용을 포함합니다:
- 실행 가능한 앱 파일
- 릴리즈 정보
- 영문/한글 릴리즈 노트
- 영문/한글 README
- 영문/한글 사용 가이드

릴리즈에서 제외되는 항목:
- `undo-logs/`
- `undo-backups/`

공식 배포나 보존용 스냅샷은 릴리즈 기능을 사용하는 것이 좋습니다.
