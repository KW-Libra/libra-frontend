import { api } from './client'
import type { BacktestRunConversation, BacktestRunStartRequest, BacktestRunStatus } from '@/types/api'

export const backtestAdminApi = {
  startRun: (body: BacktestRunStartRequest) =>
    api.post<BacktestRunStatus>('/api/admin/backtests/runs', body),
  status: (runId: string) =>
    api.get<BacktestRunStatus>(`/api/admin/backtests/runs/${encodeURIComponent(runId)}`),
  conversation: (runId: string, date?: string) =>
    api.get<BacktestRunConversation>(`/api/admin/backtests/runs/${encodeURIComponent(runId)}/conversation`, {
      params: date ? { date } : undefined
    })
}
