import { api } from './client'

export interface BacktestSummaryCard {
  label: string
  value: string
  caption: string
  tone: 'blue' | 'gray' | 'red'
}

export interface BacktestStrategyRow {
  strategy: string
  group: string
  totalReturnPct: number
  annualizedReturnPct: number
  annualizedVolatilityPct: number
  endingValueKrw: number
  trades: number
  sharpe: number
  maxDrawdownPct: number
  turnoverKrw: number
  transactionCostKrw: number
  gapVsLibraPctPoints: number
}

export interface RebalancePlanRow {
  date: string
  changes: Array<{
    ticker: string
    deltaPctPoints: number
  }>
}

export interface BacktestAuditSummary {
  complete: boolean
  datesMatchFixturePrefix: boolean
  handoffCount: number
  rawErrorCount: number
  auditErrorCount: number
  minWeightSum: number
  maxWeightSum: number
}

export interface BacktestCostSummary {
  models: string[]
  requestCount: number
  inputTokens: number
  outputTokens: number
  totalCostUsd: number
  costPerReplayDayUsd: number
}

export interface ThresholdEquivalenceSummary {
  sameTradeDatesAsThresholdBand: boolean
  libraRebalanceDates: string[]
  thresholdBandRebalanceDates: string[]
  libraOnlyTradeDates: string[]
  thresholdOnlyTradeDates: string[]
}

export interface BacktestAssetRow {
  ticker: string
  name: string
  targetWeightPct: number
  startPrice: number
  endPrice: number
  priceReturnPct: number
}

export interface BacktestAssumptions {
  initialValueKrw: number
  transactionCostBp: number
  annualizationFactor: number
  thresholdBandPct: number
  riskParityLookbackDays: number
  assetCount: number
  tradingDays: number
}

export interface BacktestValidation {
  period: string
  replayDays: number
  llmCostUsd: number
  assumptions: BacktestAssumptions
  assets: BacktestAssetRow[]
  decisionBreakdown: Record<string, number>
  audit: BacktestAuditSummary
  cost: BacktestCostSummary
  thresholdEquivalence: ThresholdEquivalenceSummary
  rebalanceDates: string[]
  rebalancePlans: RebalancePlanRow[]
  headline: string
  subtext: string
  summaryCards: BacktestSummaryCard[]
  findings: string[]
  strategies: BacktestStrategyRow[]
}

export const backtestApi = {
  publicRss3yValidation: () =>
    api.get<BacktestValidation>('/api/backtests/public-rss-3y/validation')
}
