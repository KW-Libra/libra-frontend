# libra-frontend

Frontend repository for LIBRA.

This repository owns:

- portfolio dashboard UI
- decision trace and agent-run views
- user approval screens
- settings for delegation boundaries and notifications

This repository does not own:

- backend persistence
- KIS integration
- LangGraph orchestration
- ingestion pipelines

## Stack

Initial scaffold:

- Vite
- Vue
- TypeScript

## Run

```powershell
cd D:\libra-frontend
npm install
npm run dev
```

The frontend should call `libra-backend`, not `libra-agent` directly.
