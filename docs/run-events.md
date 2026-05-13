# RunEvent Contract v0

Frontend receives SSE events from the backend passthrough at `/api/runs` and `/api/runs/{threadId}/resume`.
The source of truth is mirrored from `libra-agent/docs/run-events.md`.

Current event names:

- `run_started`
- `node_started`
- `node_completed`
- `interrupt_required`
- `resume_received`
- `resume_ignored`
- `run_completed`
- `run_failed`

Current stable node names:

- `compliance_before`
- `round1`
- `mediator`
- `final_judge`
- `human_review`

The TypeScript mapping lives in `src/types/events.ts`.
The dashboard/design work should consume this contract, not invent event payloads in page components.
