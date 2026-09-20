# ToDoWeb2

Vercel 배포용 할 일 관리 웹앱입니다. 기존 단일 HTML 기반 ToDo 앱에 Gemini 단답형 AI 기능을 추가해 Vercel에서 동작하도록 구성했습니다.

## 2026-09-20 변경사항

- `public/index.html`
  - 기본 예제 할 일 자동 생성 제거
  - PC용 `todo.json` 저장 기능 구현
  - `todo.json` 가져오기 및 구조 검증 구현
  - 향후 GitHub Gist 저장과 동일하게 사용할 수 있도록 `schemaVersion / updatedAt / todos` 구조 적용
  - localStorage 저장 실패 및 잘못된 저장 데이터에 대한 사용자 안내 추가
  - AI 요청 중 중복 전송 방지
  - 한글 IME 조합 중 Enter 오작동 방지
  - AI 질문 길이 4,000자 제한
  - AI 요청 타임아웃 및 오류 표시 개선
  - 기존 배포 팝업 높이 640 유지

- `api/ai.js`
  - 종료된 `gemini-2.0-flash` 제거
  - AI 모델 순서: `gemini-2.5-flash` → `gemini-2.5-flash-lite`
  - 429 무료 한도 초과 시 다음 모델로 전환
  - 입력값 형식·공백·길이 검증 추가
  - 400 / 401 / 403 / 404 / 5xx 오류를 구분하도록 처리 개선
  - 무료 한도 소진과 일반 API/통신 오류를 구분

- `.gitignore`
  - `.env`, `.env.*`, `.vercel`, `node_modules/` 제외 설정 추가
  - `.env.example`은 저장소에 포함 가능하도록 예외 처리

## 현재 데이터 저장 구조

PC JSON 저장과 다음 버전의 GitHub Gist 저장에서 같은 구조를 사용할 예정입니다.

```json
{
  "schemaVersion": 1,
  "updatedAt": 0,
  "todos": {
    "1": [],
    "2": [],
    "3": []
  }
}
```

## 다음 작업

다음 개발은 `main`에서 직접 작업하지 않고 별도 브랜치에서 진행합니다.

예정 작업:
- GitHub Gist에 `todo.json` 저장
- Gist에서 할 일 목록 불러오기
- 현재 PC JSON 저장/불러오기 구조와 Gist 저장 구조 공유
