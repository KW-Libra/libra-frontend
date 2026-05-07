# libra-frontend

LIBRA 프론트엔드 — Vue 3 + Vite + TypeScript SPA. 사용자가 포트폴리오를 동기화하고 Judge run 결과를 확인하는 화면을 제공합니다.

## 책임 분담

이 레포가 책임지는 것:

- 사용자 로그인 / 회원가입 / OAuth 콜백 화면
- 포트폴리오 대시보드 + Decision Trace 화면
- KIS credential 설정·동기화·Judge 실행 트리거
- Bearer 토큰 관리 (access + refresh, localStorage)
- 라우터 가드 (인증 필요한 라우트 보호)

이 레포가 책임지지 않는 것:

- 백엔드 도메인 로직 → [libra-backend](../libra-backend)
- LangGraph Judge 오케스트레이션 → [libra-agent](../libra-agent)
- KIS·LLM 키의 직접 사용 (KIS credential은 backend에 암호화 저장, LLM 키는 agent 운영 env)

## 스택

- Vue 3.5 (Composition API, `<script setup>`)
- Vue Router 4
- Vite 6
- TypeScript 5.9
- Pretendard / Fraunces / JetBrains Mono / 나눔명조 (Google Fonts + jsDelivr)

## 실행

```powershell
cd D:\libra-frontend
npm install
npm run dev
```

기본 포트: `http://localhost:5173`. `vue-tsc --noEmit`으로 타입체크.

## 환경 변수

`.env` 파일에 작성 (`.env.example` 참고).

- `VITE_LIBRA_API_BASE_URL` — backend 베이스 URL (예: `http://localhost:8080`). 비워두면 same-origin

## 라우트 구조

| 경로 | 컴포넌트 | 인증 | 설명 |
|---|---|---|---|
| `/` | LandingPage | 공개 | 신문 1면 스타일 랜딩 — Decision Room 진입 CTA |
| `/login` | LoginPage | 공개 | email/password + Google/Kakao/Naver OAuth |
| `/signup` | SignupPage | 공개 | 회원가입 |
| `/auth/callback` | AuthCallbackPage | 공개 | OAuth 성공 후 토큰 수령 → `/dashboard` |
| `/dashboard` | DashboardPage | 필요 | 포트폴리오 + verdict + stat 4개 + holdings 테이블 + agent roster + recent feed |
| `/decision` | DecisionTracePage | 필요 | 옛 3-rail Decision Room (RunStrip + PortfolioRail + DecisionRoom + InspectorRail) |
| `/profile` | ProfilePage | 필요 | 사용자 정보 + KIS credential 설정/상태 |
| `/history` | HistoryPage | 필요 | 저장된 Judge run 목록 + 상세 + 사후 평가 저장 |
| `/agents`, `/indexing`, `/news` | PlaceholderPage | 필요 | 다음 호 발행 예정 |

`/login`/`/signup`인데 이미 인증된 경우 `/dashboard`로 자동 redirect. 인증 필요한 라우트인데 미인증이면 `/login?redirect=원래경로`.

## 인증 흐름

**bootstrap (앱 시작)**:
1. localStorage에서 access/refresh 토큰 로드
2. `GET /api/v1/auth/me` 시도. 401이면 자동 refresh 후 재시도. 실패하면 토큰 모두 폐기

**email 로그인**: `POST /api/v1/auth/login` → 토큰 저장 → redirect

**OAuth 로그인**: `${API_BASE}/oauth2/authorization/{google|kakao|naver}` → backend가 provider로 redirect → 콜백 → backend가 `/auth/callback?access_token=...&refresh_token=...&provider=...`로 redirect → AuthCallbackPage가 토큰 저장 + `/me` → `/dashboard`

**API 호출 401**: `authedFetch`가 모든 요청을 wrap → 401이면 한 번 refresh + 재시도 → 그래도 실패면 401 반환 (라우터 가드가 `/login`으로 보냄)

## 소스 레이아웃

- `src/App.vue` — layout 분기 (public/auth/shell) + theme/lang state
- `src/main.ts` — Vue app 부트스트랩 + router 등록
- `src/styles.css` — 토큰 + 전역 스타일 (OKLCH, dark/light, 한글 폰트)
- `src/api.ts` — backend REST 타입 + `request()` (authedFetch 기반)
- `src/view-model.ts` — Judge run 결과 → UI view-model 매핑
- `src/router/index.ts` — 라우트 정의 + 인증 가드
- `src/composables/`
  - `useAuth.ts` — 토큰/유저 store + login/signup/refresh/logout/me/`authedFetch`
  - `useJudgeState.ts` — portfolio + judge state composable (Dashboard와 DecisionTrace가 공유)
- `src/layouts/`
  - `AppShell.vue` — 좁은 검은 사이드바(세로 인장 `天秤`) + masthead + RouterView
  - `AuthLayout.vue` — login/signup/callback용 풀폭 shell
- `src/pages/` — Landing/Login/Signup/AuthCallback/Dashboard/DecisionTrace/Placeholder
- `src/pages/ProfilePage.vue` — KIS credential 설정/삭제 + 마스킹된 저장 상태
- `src/pages/HistoryPage.vue` — 사용자별 결정 이력 조회 + 평가 기록
- `src/components/` — DecisionTrace 페이지가 사용하는 4개 rail 컴포넌트 (DecisionRoom/PortfolioRail/InspectorRail/RunStrip)
- `src/imports/image-2.png` — 시장 차트 reference 이미지

## 디자인 시스템 (현재 보류 상태)

현재 적용된 톤:

- **컬러**: dark는 따뜻한 carbon black + ivory, light는 newspaper cream + warm black. 액센트 단 하나 — 한국 인장 vermilion `#c8431a`
- **타이포**: Fraunces (display, variable opsz/wght) + Pretendard (한글 본문) + JetBrains Mono (라벨/숫자)
- **레이아웃**: hairline 룰로 섹션 분리 (카드 박스 최소화), 거대 figure + mono kicker 라벨

디자인 자체는 사용자 보류 결정 — 이후 레퍼런스 또는 실제 사용자 피드백 기반으로 재개. 현재는 기능 검증 위주.

## Backend 의존성

이 프론트는 [libra-backend](../libra-backend)에 다음 엔드포인트를 호출합니다:

- `POST /api/v1/auth/{signup,login,refresh,logout}`, `GET /api/v1/auth/me`
- `GET /oauth2/authorization/{google|kakao|naver}` — Spring Security OAuth 진입
- `GET/PUT/DELETE /api/v1/kis/credential`
- `GET/POST /api/v1/portfolios/current`, `POST /api/v1/portfolios/current/sync/kis`
- `POST /api/v1/judge-runs`
- `GET /api/v1/decision-runs`, `GET /api/v1/decision-runs/{id}`, `GET/POST /api/v1/decision-runs/{id}/evaluations`

backend가 띄워져 있어야 dashboard가 동작합니다. agent 호출 실패 시 Judge run은 실패로 처리됩니다. 화면만 확인하려면 저장된 결정 결과나 데모 데이터를 별도로 사용해야 합니다.
