# libra-frontend

Libra Vue 3 + TypeScript SPA — 멀티에이전트 의사결정 거버넌스 UI.

## Stack
- Vue 3.5 (Composition API + `<script setup>`)
- TypeScript 5.6
- Vite 6
- Pinia 2.2 (상태)
- Vue Router 4.4
- Tailwind CSS 3.4
- Axios (HTTP)
- **`@microsoft/fetch-event-source`** (헤더 박을 수 있는 SSE 클라이언트)

## 의사결정 (왜 이렇게)

- **B-2 SSE 패스스루**: backend (Spring) 가 agent (Python) 의 SSE 를 그대로 흘림. Vue 는 `fetchEventSource` 로 받음. 표준 `EventSource` 안 쓰는 이유 — 헤더 못 박아서 JWT 못 박힘. fetch 기반 라이브러리는 헤더 OK.
- **Axios 인터셉터 2개**:
    1. *요청*: `X-Trace-Id` 발급 (UUID) + `Authorization: Bearer <token>` 자동
    2. *응답*: 401 → 토큰 비우고 `/login` 리다이렉트
- **운영 콘솔 우선** — 디자인 확정 전까지는 KIS 상태, portfolio snapshot, 주문 audit 같은 backend-owned 도메인 상태를 먼저 확인한다.

## Run

```powershell
npm install
copy .env.example .env.local
npm run dev
```

- http://localhost:5173

backend 가 8080 에 떠 있어야 로그인 가능. agent 가 8000 에 떠 있어야 (다음 단계) 의사결정 트리거 가능.

운영 backend 로 로컬 확인할 때는 CORS 대신 Vite proxy 를 사용한다.

```powershell
$env:VITE_API_BASE_URL=""
$env:VITE_PROXY_API_TARGET="https://3-34-80-58.nip.io"
npm run dev
```

## 페이지 (현재 골격)

| Path | 인증 | 비고 |
|---|---|---|
| `/login` | public | 이메일/비번 → JWT. demo 계정 (`demo@libra.local` / `demo1234`) prefill |
| `/signup` | public | 회원가입 (8자+ 비번) |
| `/dashboard` | required | KIS 상태, 시세 조회, portfolio snapshot, 주문 audit |

## 폴더 구조

```
src/
├── main.ts                # createApp + Pinia + Router 마운트
├── App.vue                # <RouterView />
├── styles.css             # Tailwind directives
├── router/index.ts        # 라우트 + beforeEach 인증 가드
├── stores/auth.ts         # Pinia — token, user, login, signup, logout
├── stores/runStream.ts    # Pinia — RunEvent stream state, interrupt/resume state
├── api/
│   ├── client.ts          # axios + 인터셉터 2개
│   ├── auth.ts            # signup / login / me
│   ├── broker.ts          # KIS market/account/order audit + portfolio snapshot
│   └── sse.ts             # fetchEventSource wrapper (start/resume run)
├── types/
│   ├── api.ts             # AuthResponse, UserProfile, ProblemDetail
│   └── events.ts          # SSE RunEvent contract v0
└── pages/
    ├── LoginPage.vue
    ├── SignupPage.vue
    └── DashboardPage.vue
```

## 다음 작업
- KIS 키 설정 후 실제 잔고/시세 데이터 화면 검증
- 디자인/제품 결정 후 의사결정 트리거 페이지와 HITL 다이얼로그 구현
- 제품 결정 후 트랜스크립트/합의 매트릭스/보고서 화면 구현

## 이벤트 계약

- 로컬 타입: `src/types/events.ts`
- 문서: `docs/run-events.md`
- agent 기준 문서: `libra-agent/docs/run-events.md`
