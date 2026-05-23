/**
 * src/types/metrics4d.ts
 *
 * 4차원 메트릭 API 계약.
 *
 * 백엔드 엔드포인트: GET /api/runs/:threadId/metrics
 * - 응답: Metrics4DResponse
 * - 4개 지표: CAGR, Sharpe, NetReturn, IPSCompliance
 * - 각 지표마다 Libra vs Benchmark 단일 수치 + 선택적 시계열
 *
 * 변경 시 백엔드와 동기화 필수.
 */

export type MetricKey = 'cagr' | 'sharpe' | 'netReturn' | 'ipsCompliance'
export type MetricUnit = '%' | 'ratio' | 'count'
export type MetricVerdict = 'WIN' | 'TIE' | 'LOSE'

export interface MetricSeries {
  dates: string[]      // YYYY-MM-DD, 정렬된 오름차순
  libra: number[]      // dates와 길이 동일
  benchmark: number[]  // dates와 길이 동일
}

export interface Metric4D {
  libra: number
  benchmark: number
  delta: number             // libra - benchmark (편의용, 백엔드 계산)
  verdict: MetricVerdict    // WIN(우위) / TIE / LOSE(열위)
  unit: MetricUnit
  series?: MetricSeries     // 라인차트용 (선택, withSeries=true 시)
}

export interface Metrics4DResponse {
  generatedAt: string                           // ISO timestamp
  period: { start: string; end: string }        // YYYY-MM-DD
  benchmark: { ticker: string; name: string }   // 비교 기준 (e.g. KOSPI200)
  metrics: Record<MetricKey, Metric4D>
}

export interface MetricMeta {
  key: MetricKey
  title: string
  subtitle: string
  description: string       // tooltip/설명용 한 줄
  higherIsBetter: boolean   // CAGR/Sharpe/NetReturn/IPS 준수율 모두 true
}

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  cagr: {
    key: 'cagr',
    title: 'CAGR',
    subtitle: '연 환산 수익률',
    description: '백테스트 기간의 연 환산 복리 수익률',
    higherIsBetter: true,
  },
  sharpe: {
    key: 'sharpe',
    title: 'Sharpe',
    subtitle: '위험조정 수익률',
    description: '단위 변동성당 초과수익. 1.0 이상이 일반적으로 양호',
    higherIsBetter: true,
  },
  netReturn: {
    key: 'netReturn',
    title: 'Net Return',
    subtitle: '세후 + 거래비용 차감',
    description: '거래세·양도세·거래비용을 모두 차감한 net 누적 수익률',
    higherIsBetter: true,
  },
  ipsCompliance: {
    key: 'ipsCompliance',
    title: 'IPS 준수율',
    subtitle: '한도 위반 비율',
    description: 'IPS 한도(변동성·자산군 비중·ESG)를 위반하지 않은 일자 비율',
    higherIsBetter: true,
  },
}
