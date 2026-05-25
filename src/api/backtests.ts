import { api } from './client'
import type { BacktestValidation } from '@/types/api'

export const FINAL_JUDGE_EXPERIMENT_ID = 'kr-objective-2020-2023-opendart-googlenews'

export const backtestApi = {
  validation: (experimentId = FINAL_JUDGE_EXPERIMENT_ID) =>
    api.get<BacktestValidation>(`/api/backtests/${encodeURIComponent(experimentId)}/validation`)
}
