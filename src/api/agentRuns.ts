// Agent run history — persisted past deliberation sessions.
import { api } from '@/api/client'

export interface AgentRunSummary {
  id: string
  threadId: string | null
  status: string
  query: string | null
  trigger: string | null
  finalDecision: string | null
  finalBranch: string | null
  summary: string | null
  eventCount: number
  createdAt: string
  completedAt: string | null
}

export interface AgentRunEventDto {
  eventIndex: number
  eventType: string
  data: unknown
  createdAt: string
}

export interface AgentRunTranscript {
  run: AgentRunSummary
  events: AgentRunEventDto[]
}

export interface SpringPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export const agentRunsApi = {
  list: (page = 0, size = 20) =>
    api
      .get<SpringPage<AgentRunSummary>>('/api/agent-runs', { params: { page, size } })
      .then((r) => r.data),
  transcript: (runId: string) =>
    api.get<AgentRunTranscript>(`/api/agent-runs/${encodeURIComponent(runId)}/transcript`).then((r) => r.data)
}
