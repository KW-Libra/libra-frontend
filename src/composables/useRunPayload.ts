// 모바일 콘솔 전용 run 페이로드 빌더.
// DashboardPageJY 의 currentPortfolioPayload() / currentGovernancePayload() 와
// 동등한 POST /api/runs body 를 만든다. (데스크톱 페이지에는 연결하지 않는다.)
//
// 전략 모드는 'balanced' 고정. 데스크톱의 STRATEGIC_MODES[1] (Balanced) 설정을 그대로 옮겼다.

import type { RunStartBody } from '@/api/sse'
import type { DecimalValue, KisBalance, KisHolding } from '@/types/api'

export type StrategicModeKey = 'conservative' | 'balanced' | 'aggressive'

interface StrategicModeConfig {
  value: StrategicModeKey
  label: string
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  riskScore: number
  maxDrawdownTolerancePct: number
  singleTickerLimitPct: number
  sectorLimitPct: number
  annualVolatilityLimitPct: number
  minCashPct: number
  assetClassTarget: Record<string, number>
}

// 데스크톱 DashboardPageJY.vue STRATEGIC_MODES 의 Balanced 설정과 1:1 동일.
const BALANCED_MODE: StrategicModeConfig = {
  value: 'balanced',
  label: 'Balanced',
  riskTolerance: 'MODERATE',
  riskScore: 5.5,
  maxDrawdownTolerancePct: 15,
  singleTickerLimitPct: 25,
  sectorLimitPct: 40,
  annualVolatilityLimitPct: 20,
  minCashPct: 5,
  assetClassTarget: { EQUITY: 60, BOND: 35, ALT: 5 }
}

function toNumber(value: DecimalValue | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function inferKisMarketCode(symbol: string): string | null {
  return /^\d{6}$/.test(symbol.trim()) ? 'J' : null
}

export interface RunPayloadInput {
  /** 실시간 KIS 잔고(있으면). */
  balance: KisBalance | null
  /** snapshot 으로 복원한 잔고(있으면). */
  snapshotBalance: KisBalance | null
  /** 표시 중인 summary (balance ?? snapshot). */
  summary: KisBalance['summary'] | null
  /** 보유 종목. */
  holdings: KisHolding[]
  /** 총 평가금액. */
  totalValue: number
  /** 현금 비중(0~1). */
  cashWeight: number
  /** 데이터 소스 라벨 ('KIS LIVE' | 'SNAPSHOT' | ...). */
  dataSource: string
  /** snapshot id (있으면). */
  snapshotId: string | null
}

/**
 * currentPortfolioPayload() 와 동등한 portfolio dict.
 */
export function buildPortfolioPayload(input: RunPayloadInput): Record<string, unknown> {
  const generatedAt = new Date().toISOString()
  const safeTotalValue = input.totalValue > 0
    ? input.totalValue
    : input.holdings.reduce((sum, holding) => sum + (toNumber(holding.valuationAmount) ?? 0), 0)
  const safeTotal = safeTotalValue > 0 ? safeTotalValue : 1

  return {
    generated_at: generatedAt,
    total_value_krw: safeTotalValue,
    cash_weight: Math.max(0, Math.min(1, input.cashWeight)),
    source: input.balance
      ? 'kis_live_balance'
      : input.snapshotBalance
        ? 'portfolio_snapshot'
        : 'dashboard_fallback',
    as_of: generatedAt,
    snapshot_id: input.snapshotId,
    data_source: input.dataSource,
    summary: input.summary,
    holdings: input.holdings
      .map((holding) => {
        const valuation = toNumber(holding.valuationAmount) ?? 0
        const symbol = holding.symbol.trim()
        const payload: Record<string, unknown> = {
          ticker: symbol,
          symbol: holding.symbol,
          company_name: holding.name || symbol,
          name: holding.name,
          aliases: [symbol, holding.name].filter(Boolean),
          shares: toNumber(holding.quantity),
          quantity: toNumber(holding.quantity),
          last_price: toNumber(holding.currentPrice),
          average_price: toNumber(holding.averagePrice),
          market_value_krw: valuation,
          valuation_amount: valuation,
          weight: Math.max(0, Math.min(1, valuation / safeTotal)),
          unrealized_pnl_krw: toNumber(holding.profitLossAmount),
          profit_loss_amount: toNumber(holding.profitLossAmount),
          profit_loss_rate: toNumber(holding.profitLossRate)
        }
        const marketCode = inferKisMarketCode(symbol)
        if (marketCode) {
          payload.market_code = marketCode
          payload.marketCode = marketCode
        }
        return payload
      })
      .filter((holding) => {
        return String(holding.ticker || '').trim()
          && ((Number(holding.weight) || 0) > 0 || (Number(holding.shares) || 0) > 0)
      }),
    user_preferences: ['KIS 실잔고 기준', '무리한 회전율 회피', '리스크 우선']
  }
}

/**
 * currentGovernancePayload() 와 동등한 governance_v1 dict (Balanced 고정).
 */
export function buildGovernancePayload(): Record<string, unknown> {
  const mode = BALANCED_MODE
  return {
    enabled: true,
    execution_mode: 'primary',
    source: 'mobile_console_strategy_mode',
    strategy_mode: mode.value,
    kyc: {
      risk_tolerance: mode.riskTolerance,
      investment_horizon_years: 15,
      max_drawdown_tolerance_pct: mode.maxDrawdownTolerancePct
    },
    ips: {
      single_ticker_limit_pct: mode.singleTickerLimitPct,
      sector_limit_pct: mode.sectorLimitPct,
      annual_volatility_limit: mode.annualVolatilityLimitPct,
      asset_class_target: mode.assetClassTarget,
      asset_class_band_pct: 10,
      min_cash_pct: mode.minCashPct,
      max_market_impact_pct_of_adv: 5,
      excluded_tickers: [],
      excluded_sectors: ['TOBACCO', 'WEAPONS']
    },
    ui: {
      label: mode.label,
      risk_score: Number(mode.riskScore.toFixed(1))
    }
  }
}

/**
 * runStream.start() 에 넘길 전체 body. startAgentRun() 의 body 와 동등.
 */
export function buildRunStartBody(input: RunPayloadInput): RunStartBody {
  return {
    query: '현재 포트폴리오를 점검하고 유지/조정 필요성을 판단해줘.',
    trigger: 'pull',
    depth: 'deep',
    deadline_seconds: 900,
    approval_required: true,
    enable_human_interrupts: true,
    portfolio: buildPortfolioPayload(input),
    governance_v1: buildGovernancePayload(),
    trigger_event: {
      source: 'mobile_console',
      kind: 'manual_rebalance_check',
      strategic_mode: BALANCED_MODE.value,
      risk_score: Number(BALANCED_MODE.riskScore.toFixed(1)),
      requested_at: new Date().toISOString()
    },
    knowledge_sources: {
      market_data: 'kis',
      live_balance: !!input.balance,
      dashboard: 'mobile_console',
      strategic_mode: BALANCED_MODE.value
    }
  }
}
