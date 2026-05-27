import { api } from './client'
import type { BacktestRunStartRequest, BacktestRunStatus } from '@/types/api'

export const backtestAdminApi = {
  startRun: (body: BacktestRunStartRequest) =>
    api.post<BacktestRunStatus>('/api/admin/backtests/runs', body),
  status: (runId: string) =>
    api.get<BacktestRunStatus>(`/api/admin/backtests/runs/${encodeURIComponent(runId)}`)
}
