# Libra Codespace

GitHub Codespaces 환경에서 **frontend + backend + agent + Postgres** 풀스택을 한 컨테이너에 띄우는 설정.

## 무엇이 들어 있나

| 파일 | 역할 |
|---|---|
| `devcontainer.json` | Ubuntu 22.04 base + Node 22 / Java 21 / Python 3.12 / Docker-in-Docker, 포트 forward (5173/8080/8000/5432) |
| `setup.sh` | `postCreateCommand`. 형제 repo(`libra-backend`, `libra-agent`, `libra-ingest`) clone, deps 설치, Postgres 기동, frontend `.env`를 codespace 모드로 세팅 |
| `../.vscode/tasks.json` | VS Code Run Task로 3개 서비스 한 번에 실행 |
| `../vite.config.ts` | dev proxy 추가 — `/api` → `http://localhost:8080` |

## 사용법

### 1. Codespace 시크릿 등록 (최초 1회)

https://github.com/settings/codespaces → **Repository secrets** 또는 **Codespaces secrets**에

- `ANTHROPIC_API_KEY` = `sk-ant-...`

추가하고 `KW-Libra/libra-frontend`를 허용.

### 2. Codespace 생성

`KW-Libra/libra-frontend` repo 페이지 → **`< > Code`** → **Codespaces** 탭 → **Create codespace on `<branch>`**.

원하는 브랜치에서 띄울 수 있음. 첫 부팅에 약 3~5분 (deps 설치 + Postgres 다운로드).

### 3. 서비스 실행

부팅이 끝나면 setup 로그 마지막에 명령이 안내됩니다. 가장 빠른 방법:

**VS Code 메뉴 → Terminal → Run Task → `Libra: Run All`**

3개 터미널이 자동으로 분리돼서 agent/backend/frontend가 동시에 뜸.

수동 실행은:

```bash
# 터미널 ①
cd /workspaces/libra-agent
uv run uvicorn libra_agent.main:app --host 0.0.0.0 --port 8000 --reload

# 터미널 ②
cd /workspaces/libra-backend
./gradlew bootRun

# 터미널 ③ (이미 frontend 폴더에 있음)
npm run dev -- --host 0.0.0.0
```

### 4. 접속

VS Code 하단 **Ports** 탭 → 포트 `5173`의 globe 아이콘 클릭 → 브라우저 미리보기.

데모 계정 (`local`/`dev`/`demo` 프로파일에서 backend가 자동 생성):
- `demo@libra.local` / `demo1234`

## 통신 흐름

```
Browser (xxx-5173.app.github.dev)
   │ relative /api/* 요청
   ▼
Vite dev server (:5173)         ← VITE_API_BASE_URL=/ 로 설정됨
   │ proxy /api → :8080
   ▼
Spring Boot backend (:8080)
   │ HTTP/SSE
   ▼
LangGraph agent (:8000) ──reads──► Postgres (:5432)
```

5173만 public 미리보기로 노출하면 됨. 8080/8000은 컨테이너 내부 호출만 받음.

## 흔한 문제

- **agent가 401/Anthropic error**: `ANTHROPIC_API_KEY` 시크릿 미설정. 등록 후 codespace 재기동 또는 `bash .devcontainer/setup.sh` 재실행.
- **backend가 Postgres에 못 붙음**: `cd /workspaces/libra-backend && docker compose ps`로 확인. 없으면 `docker compose up -d`.
- **첫 빌드가 너무 느림**: gradle/uv가 의존성 다운로드 중. 다음 부팅부터는 캐시로 빠름. 4-core 머신 권장 (devcontainer.json의 `hostRequirements`).
- **포트 5173 미리보기가 안 뜸**: Ports 탭에서 우클릭 → Port Visibility → Public(또는 Org Restricted). 보통 Private 기본값으로도 본인 접속은 가능.

## 비용

- 개인 GitHub 계정: 월 **60시간 + 20GB storage 무료** (이후 $0.18/h, $0.07/GB-month)
- 사용 안 할 때는 codespace를 **Stop** (자동 30분 idle stop) — 시간만 계산되고 storage는 따로
