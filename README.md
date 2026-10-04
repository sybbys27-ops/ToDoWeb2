# ToDoWeb2

Vercel에 배포하는 할 일 관리 웹앱입니다. 기존 단일 HTML 기반 ToDo 앱을 확장해 Gemini 단답형 AI, GitHub Gist 클라우드 동기화, 메모 탭을 사용할 수 있도록 구성했습니다.

## 현재 개발 상태

현재 `main` 브랜치는 다음 기능을 포함합니다.

- 할 일 탭 1~3
- 자유 메모 탭 4~5
- 브라우저 `localStorage` 자동 저장
- GitHub Gist의 `todo.json`을 이용한 구름저장 / 불러오기
- Gist와 로컬 데이터의 `updatedAt` 비교를 통한 덮어쓰기 충돌 확인
- Gemini 단답형 AI 질의응답
- Google / Papago 팝업 실행
- Vercel Serverless API를 통한 Gemini / GitHub API 호출
- 독립 팝업 형태의 앱 화면

과거에 시험했던 `always-on-top` 기능은 제거되었으며 현재 `main`에는 포함되어 있지 않습니다.

## 주요 파일

### `public/index.html`

- 탭 1~3: 할 일 목록
- 탭 4~5: 자유 메모
- Gist 구름저장 / 불러오기 UI
- localStorage 자동 저장
- Gemini 질문 UI
- Google / Papago 실행 버튼
- 한글 IME 조합 중 Enter 오작동 방지
- AI 요청 중복 전송 방지
- AI 질문 길이 4,000자 제한
- AI 요청 타임아웃 및 오류 표시 처리

### `api/ai.js`

Vercel 서버에서 Gemini API를 호출합니다.

사용 모델 순서:

1. `gemini-2.5-flash`
2. `gemini-2.5-flash-lite`

429 무료 한도 초과 또는 일시적인 5xx 오류가 발생하면 다음 모델을 시도합니다.

### `api/gist.js`

GitHub Gist의 `todo.json`을 읽고 저장하는 Vercel 서버 API입니다.

- GitHub Token은 브라우저에 전달하지 않고 Vercel 서버 환경변수로만 사용
- `TODO_GIST_SYNC_KEY`로 공개 API 엔드포인트 접근 보호
- 기존 Gist가 없으면 첫 저장 시 private Gist 생성
- 기존 Gist가 있으면 PATCH로 업데이트
- Gist와 로컬의 `updatedAt`을 비교해 더 최신 데이터가 있는 경우 충돌 확인

## 현재 데이터 구조

localStorage와 Gist의 `todo.json`은 같은 데이터 구조를 사용합니다.

```json
{
  "schemaVersion": 1,
  "updatedAt": 0,
  "todos": {
    "1": [],
    "2": [],
    "3": []
  },
  "notes": {
    "4": "",
    "5": ""
  }
}
```

## Vercel 환경변수

- `GEMINI_API_KEY`: Gemini API 호출용
- `GITHUB_GIST_TOKEN`: GitHub Gist 접근용 Token. Vercel 서버에서만 사용
- `TODO_GIST_SYNC_KEY`: `/api/gist` 호출 보호용 앱 전용 키
- `TODO_GIST_ID`: 선택 사항. 특정 Gist를 고정해서 사용할 때 지정

브라우저에는 `GITHUB_GIST_TOKEN`을 저장하지 않습니다. 사용자는 첫 구름저장 / 불러오기 시 `TODO_GIST_SYNC_KEY`를 입력하며, 이 값은 브라우저 localStorage에 저장됩니다.

## Vercel Production 기준 브랜치 변경

Vercel에서는 `main`이 아닌 특정 Git branch를 Production 기준으로 지정할 수 있습니다.

설정 경로:

```text
Vercel Project
→ Settings
→ Environments
→ Production
→ Branch Tracking
```

예를 들어:

```text
Branch is feature/gist-storage
```

로 저장하면 이후 `feature/gist-storage`에 새 commit이 push될 때 자동으로 Production Deployment가 생성됩니다. Production 기준이 아닌 다른 branch의 commit은 Preview Deployment로 생성됩니다.

`Deployments → Redeploy → Production / Preview` 선택은 기존 deployment를 선택한 환경으로 한 번 다시 배포하는 기능입니다. 앞으로 어떤 branch를 자동 Production으로 배포할지는 위의 `Branch Tracking` 설정이 결정합니다.

### Branch Tracking 학습 확인

2026-10-04에 다음 순서로 동작을 확인했습니다.

1. Production Branch Tracking을 `main`에서 `feature/gist-storage`로 변경
2. `feature/gist-storage`에 README commit 생성
3. 해당 commit이 Vercel Production Deployment로 자동 생성되는 것을 확인
4. 이후 Production Branch Tracking을 다시 `main`으로 복구

이 README 수정 commit은 `main` 복구 후 자동 Production Deployment가 정상적으로 생성되는지 확인하는 테스트이기도 합니다.

## 브랜치 사용 원칙

새 기능은 가능하면 `main`에서 직접 개발하지 않고 별도 feature branch에서 작업합니다.

기본 흐름:

```text
feature branch에서 개발
→ Preview 배포 확인
→ Pull Request
→ main에 merge
→ Production 자동 배포
```

개발 중에는 최신 `main`을 feature branch에 주기적으로 반영해 다른 기능과의 코드 충돌 및 통합 문제를 미리 확인합니다.
