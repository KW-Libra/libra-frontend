/**
 * src/mocks/metrics4d.ts
 *
 * 4차원 메트릭 mock 응답.
 *
 * 백엔드 연결 전까지 프론트에서 사용. 시나리오별로 그럴듯한 수치를 생성.
 * threadId prefix로 시나리오를 식별 (resolveScenario와 동일 규칙).
 *
 * 실제 백엔드 연결 시 src/api/metrics.ts 의 fetchMetrics4D() 가 이 모듈 대신
 * 실제 엔드포인트를 호출하도록 USE_MOCK 플래그를 false로 바꾸면 된다.
 */

import type { Metrics4DResponse, MetricSeries } from '@/types/metrics4d'

// 결정적 의사난수 (seed 기반) — threadId가 같으면 같은 결과
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashThread(threadId: string): number {
  let h = 0
  for (let i = 0; i < threadId.length; i++) {
    h = (h * 31 + threadId.charCodeAt(i)) >>> 0
  }
  return h || 1
}

function genSeries(
  startEquity: number,
  driftPctYr: number,
  volPctYr: number,
  days: number,
  rng: () => number,
): number[] {
  const dailyDrift = driftPctYr / 100 / 252
  const dailyVol = volPctYr / 100 / Math.sqrt(252)
  const out: number[] = [startEquity]
  for (let i = 1; i < days; i++) {
    // 박스-뮬러 근사 (단순 합)
    const z = (rng() + rng() + rng() + rng() + rng() + rng() - 3) / Math.sqrt(2)
    const r = dailyDrift + dailyVol * z
    out.push(out[i - 1] * (1 + r))
  }
  return out
}

function genDateLabels(days: number, end: Date): string[] {
  const out: string[] = []
  const d = new Date(end)
  for (let i = days - 1; i >= 0; i--) {
    const cur = new Date(d)
    cur.setDate(d.getDate() - i)
    out.push(cur.toISOString().slice(0, 10))
  }
  return out
}

function toCumPct(series: number[]): number[] {
  const base = series[0]
  return series.map((v) => ((v - base) / base) * 100)
}

function cagr(series: number[], days: number): number {
  const totalReturn = series[series.length - 1] / series[0]
  const years = days / 252
  return (Math.pow(totalReturn, 1 / years) - 1) * 100
}

function sharpe(series: number[]): number {
  const rets: number[] = []
  for (let i = 1; i < series.length; i++) {
    rets.push(series[i] / series[i - 1] - 1)
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  return ((mean * 252) / (std * Math.sqrt(252))) * 1 // 무위험 0 가정
}

/** 시나리오별 프리셋 — Libra 우위 정도를 시나리오 성격에 맞게 조정 */
interface Preset {
  libraDrift: number
  libraVol: number
  benchDrift: number
  benchVol: number
  ipsLibra: number      // 0~100 (%)
  ipsBench: number
  benchmarkName: string
  benchmarkTicker: string
}

function pickPreset(threadId: string): Preset {
  if (threadId.startsWith('run_kospi')) {
    // STRONG_REBALANCE — Libra가 한도 자동 해소로 우위
    return {
      libraDrift: 7.8, libraVol: 14.5,
      benchDrift: 7.4, benchVol: 18.2,
      ipsLibra: 99.6, ipsBench: 71.2,
      benchmarkName: 'KOSPI 200', benchmarkTicker: '069500',
    }
  }
  if (threadId.startsWith('run_esg')) {
    // COMPLIANCE_VETO — Libra가 ESG 룰 준수로 IPS는 압도, 수익은 비슷
    return {
      libraDrift: 6.9, libraVol: 13.8,
      benchDrift: 7.3, benchVol: 14.1,
      ipsLibra: 100.0, ipsBench: 58.4,
      benchmarkName: 'KOSPI 200', benchmarkTicker: '069500',
    }
  }
  if (threadId.startsWith('run_weak')) {
    // WEAK_CONSERVATIVE — 보수적 적용으로 미세 우위
    return {
      libraDrift: 6.8, libraVol: 12.7,
      benchDrift: 6.5, benchVol: 14.0,
      ipsLibra: 97.8, ipsBench: 82.1,
      benchmarkName: 'KOSPI 200', benchmarkTicker: '069500',
    }
  }
  // 기본: FOMC (STRONG_CONFLICT)
  return {
    libraDrift: 7.2, libraVol: 15.6,
    benchDrift: 7.8, benchVol: 17.9,
    ipsLibra: 96.4, ipsBench: 73.5,
    benchmarkName: 'KOSPI 200', benchmarkTicker: '069500',
  }
}

const DEFAULT_DAYS = 252 * 3 // 3년

export function buildMockMetrics4D(threadId: string): Metrics4DResponse {
  const seed = hashThread(threadId)
  const rngL = mulberry32(seed)
  const rngB = mulberry32(seed ^ 0x9e3779b9)

  const preset = pickPreset(threadId)
  const days = DEFAULT_DAYS
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  const libra = genSeries(100, preset.libraDrift, preset.libraVol, days, rngL)
  const bench = genSeries(100, preset.benchDrift, preset.benchVol, days, rngB)
  const dates = genDateLabels(days, end)

  const libraCagr = cagr(libra, days)
  const benchCagr = cagr(bench, days)
  const libraSharpe = sharpe(libra)
  const benchSharpe = sharpe(bench)

  // Net Return: 거래세 + 세금 약 1.2%p 차감 (벤치는 0.8%p — 단순화)
  const libraNet = libraCagr - 1.2
  const benchNet = benchCagr - 0.8

  // 누적 수익률(%) 시계열로 변환 (차트용)
  const libraCumPct = toCumPct(libra)
  const benchCumPct = toCumPct(bench)

  const cumSeries: MetricSeries = {
    dates,
    libra: libraCumPct,
    benchmark: benchCumPct,
  }

  // Sharpe/IPS는 시계열 대신 단일 비교만 (시각화는 막대형)
  const ipsSeries: MetricSeries = {
    dates: [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
    libra: [preset.ipsLibra, preset.ipsLibra],
    benchmark: [preset.ipsBench, preset.ipsBench],
  }

  function verdict(l: number, b: number) {
    const d = l - b
    if (Math.abs(d) < 0.05) return 'TIE' as const
    return d > 0 ? 'WIN' : 'LOSE'
  }

  return {
    generatedAt: new Date().toISOString(),
    period: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    },
    benchmark: { ticker: preset.benchmarkTicker, name: preset.benchmarkName },
    metrics: {
      cagr: {
        libra: +libraCagr.toFixed(2),
        benchmark: +benchCagr.toFixed(2),
        delta: +(libraCagr - benchCagr).toFixed(2),
        verdict: verdict(libraCagr, benchCagr),
        unit: '%',
        series: cumSeries,
      },
      sharpe: {
        libra: +libraSharpe.toFixed(2),
        benchmark: +benchSharpe.toFixed(2),
        delta: +(libraSharpe - benchSharpe).toFixed(2),
        verdict: verdict(libraSharpe, benchSharpe),
        unit: 'ratio',
      },
      netReturn: {
        libra: +libraNet.toFixed(2),
        benchmark: +benchNet.toFixed(2),
        delta: +(libraNet - benchNet).toFixed(2),
        verdict: verdict(libraNet, benchNet),
        unit: '%',
        series: cumSeries,
      },
      ipsCompliance: {
        libra: +preset.ipsLibra.toFixed(1),
        benchmark: +preset.ipsBench.toFixed(1),
        delta: +(preset.ipsLibra - preset.ipsBench).toFixed(1),
        verdict: verdict(preset.ipsLibra, preset.ipsBench),
        unit: '%',
        series: ipsSeries,
      },
    },
  }
}
