/**
 * src/api/metrics.ts
 *
 * 4차원 메트릭 API 클라이언트.
 *
 * - 백엔드 미연결 동안: mock 데이터 반환 (USE_MOCK=true)
 * - 백엔드 연결 후: VITE_METRICS_USE_MOCK=false 로 환경변수 토글
 *   또는 USE_MOCK 상수를 직접 false로 변경
 */

import { api } from './client'
import { buildMockMetrics4D } from '@/mocks/metrics4d'
import type { Metrics4DResponse } from '@/types/metrics4d'

const USE_MOCK =
  (import.meta.env.VITE_METRICS_USE_MOCK ?? 'true') !== 'false'

const MOCK_LATENCY_MS = 350 // mock 응답 지연 — 로딩 UI 확인용

export interface FetchMetricsOptions {
  withSeries?: boolean   // 시계열 동봉 여부 (백엔드 옵션, mock은 항상 true)
  signal?: AbortSignal
}

export async function fetchMetrics4D(
  threadId: string,
  opts: FetchMetricsOptions = {},
): Promise<Metrics4DResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS))
    return buildMockMetrics4D(threadId)
  }

  const res = await api.get<Metrics4DResponse>(
    `/api/runs/${threadId}/metrics`,
    {
      params: { withSeries: opts.withSeries ?? true },
      signal: opts.signal,
    },
  )
  return res.data
}
