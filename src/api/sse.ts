// SSE 스트림 wrapper — @microsoft/fetch-event-source.
//
// 표준 EventSource 안 쓰는 이유: 헤더 못 박음 (JWT 못 보냄, traceId 못 박음).
// fetchEventSource 는 fetch 기반이라 헤더 자유로움.
//
// 사용 예:
//   const ctrl = new AbortController()
//   startRunStream({ query: '...', trigger: 'pull' }, {
//     onOpen: () => console.log('open'),
//     onEvent: (ev) => console.log(ev.event, ev.data),
//     onError: (e) => console.error(e),
//     onClose: () => console.log('closed'),
//   }, ctrl.signal)
//   // 취소: ctrl.abort()

import { fetchEventSource } from '@microsoft/fetch-event-source'
import { TOKEN_KEY } from '@/api/client'
import type { RunEvent } from '@/types/events'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

export interface RunStartBody {
  query: string
  portfolio?: Record<string, unknown>
  knowledge_base?: Record<string, unknown>
  ingest_bundle?: Record<string, unknown>
  knowledge_sources?: Record<string, unknown>
  trigger?: 'pull' | 'push' | 'user_request'
  depth?: 'shallow' | 'medium' | 'deep'
  deadline_seconds?: number
  thread_id?: string
  approval_required?: boolean
  enable_human_interrupts?: boolean
}

export interface ResumeBody {
  approved: boolean
  decision?: 'APPROVE' | 'REJECT' | 'REVISE' | 'DEFER'
  interrupt_id?: string | null
  option_index?: number
  override_decision?: string
  override_plan?: Record<string, number>
  note?: string
  metadata?: Record<string, unknown>
}

export interface SseHandlers {
  onOpen?: () => void
  onEvent?: (ev: RunEvent) => void
  onError?: (err: unknown) => void
  onClose?: () => void
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY) || ''
  return {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Authorization': `Bearer ${token}`,
    'X-Trace-Id': crypto.randomUUID()
  }
}

async function streamPost(
  url: string,
  body: unknown,
  handlers: SseHandlers,
  signal?: AbortSignal
): Promise<void> {
  await fetchEventSource(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal,
    openWhenHidden: true, // 탭 안 보여도 스트림 유지
    async onopen(response) {
      const ct = response.headers.get('content-type') || ''
      if (response.ok && ct.includes('text/event-stream')) {
        handlers.onOpen?.()
        return
      }
      throw new Error(`SSE open failed: ${response.status} ${response.statusText}`)
    },
    onmessage(msg) {
      try {
        const data = msg.data ? JSON.parse(msg.data) : {}
        const evt = { event: (msg.event || 'message') as RunEvent['event'], data } as RunEvent
        handlers.onEvent?.(evt)
      } catch (e) {
        console.warn('SSE parse failed', msg, e)
      }
    },
    onerror(err) {
      handlers.onError?.(err)
      throw err // 자동 재시도 막음 — 사용자가 명시적으로 재시도
    },
    onclose() {
      handlers.onClose?.()
    }
  })
}

export function startRunStream(
  body: RunStartBody,
  handlers: SseHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(`${baseURL}/api/runs`, body, handlers, signal)
}

export function resumeRunStream(
  threadId: string,
  body: ResumeBody,
  handlers: SseHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(
    `${baseURL}/api/runs/${encodeURIComponent(threadId)}/resume`,
    body,
    handlers,
    signal
  )
}
