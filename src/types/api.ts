// backend (Spring) 응답 타입 — Java DTO 와 1:1 매핑

/**
 * RFC 7807 ProblemDetail (Spring + FastAPI 양쪽 모두 같은 포맷).
 * code: ErrorCode enum 이름 (양쪽 동기화)
 */
export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: string
  traceId?: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number // seconds
  userId: string
  email: string
  displayName: string | null
}

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  createdAt: string // ISO
}

export type DecimalValue = number | string | null

export interface KisStatus {
  registered: boolean
  credentialScope: 'none' | 'server' | 'user' | string
  enabled: boolean
  tradingEnabled: boolean
  environment: string
  baseUrl: string
  restConfigured: boolean
  accountConfigured: boolean
  webSocketConfigured: boolean
  maskedAppKey: string | null
  maskedAccountNumber: string | null
  maxOrderQuantity: number
  maxOrderAmount: DecimalValue
  symbolAllowListEnabled: boolean
  allowedSymbolsCount: number
}

export interface KisCredentialRequest {
  environment: 'PAPER' | 'PROD'
  tradingEnabled: boolean
  appKey: string
  appSecret: string
  accountNumber: string
  accountProductCode: string
  htsId?: string
}

export interface KisCredentialStatus {
  registered: boolean
  credentialScope: string
  enabled: boolean
  tradingEnabled: boolean
  environment: string
  restConfigured: boolean
  accountConfigured: boolean
  webSocketConfigured: boolean
  maskedAppKey: string | null
  maskedAccountNumber: string | null
  updatedAt: string | null
}

export interface KisQuote {
  symbol: string
  marketCode: string
  name: string
  price: DecimalValue
  change: DecimalValue
  changeRate: DecimalValue
  accumulatedVolume: number | null
  raw: Record<string, unknown>
}

export interface KisHolding {
  symbol: string
  name: string
  quantity: DecimalValue
  orderableQuantity: DecimalValue
  averagePrice: DecimalValue
  currentPrice: DecimalValue
  purchaseAmount: DecimalValue
  valuationAmount: DecimalValue
  profitLossAmount: DecimalValue
  profitLossRate: DecimalValue
  raw: Record<string, unknown>
}

export interface KisAccountSummary {
  depositAmount: DecimalValue
  stockValuationAmount: DecimalValue
  totalValuationAmount: DecimalValue
  netAssetAmount: DecimalValue
  purchaseAmount: DecimalValue
  valuationAmount: DecimalValue
  profitLossAmount: DecimalValue
  profitLossRate: DecimalValue
}

export interface KisBalance {
  snapshotId: string | null
  environment: string
  holdings: KisHolding[]
  summary: KisAccountSummary
  rawSummary: Record<string, unknown>
  hasNextPage: boolean
  nextContextFk: string
  nextContextNk: string
}

export interface PortfolioSnapshot {
  id: string
  userId: string
  provider: string
  environment: string
  source: string
  holdingsCount: number
  depositAmount: DecimalValue
  stockValuationAmount: DecimalValue
  totalValuationAmount: DecimalValue
  netAssetAmount: DecimalValue
  purchaseAmount: DecimalValue
  valuationAmount: DecimalValue
  profitLossAmount: DecimalValue
  profitLossRate: DecimalValue
  traceId: string | null
  createdAt: string
}

export interface PortfolioSnapshotDetail extends PortfolioSnapshot {
  snapshotJson: string
}

export type KisOrderAuditStatus = 'REQUESTED' | 'SUBMITTED' | 'REJECTED' | 'FAILED'
export type KisOrderSide = 'BUY' | 'SELL'

export interface KisOrderAudit {
  id: string
  userId: string
  provider: string
  environment: string
  status: KisOrderAuditStatus
  side: KisOrderSide
  symbol: string
  quantity: number
  price: DecimalValue
  orderDivision: string
  exchangeId: string
  tradingEnabled: boolean
  idempotencyKey: string | null
  brokerOrderNo: string | null
  brokerMessage: string | null
  errorCode: string | null
  errorMessage: string | null
  traceId: string | null
  createdAt: string
  updatedAt: string
}

export interface BacktestMetric {
  strategy: string
  group: string | null
  endingValueKrw: DecimalValue
  totalReturnPct: DecimalValue
  annualizedVolatilityPct: DecimalValue
  sharpeRatio: DecimalValue
  maxDrawdownPct: DecimalValue
  trades: number | null
  turnoverKrw: DecimalValue
  transactionCostKrw: DecimalValue
  returnGapVsLibraPctPoints: DecimalValue
}

export interface BacktestTradeAlphaSummary {
  signals: number
  v3Executed: number
  v3Skipped: number
  v1Negative20d: number
  v1Negative60d: number
  v3Negative20d: number
  v3Negative60d: number
}

export interface BacktestTradeAlpha {
  signalDate: string
  v3Policy: string
  v1ExecuteDate: string
  v3ConfirmationDate: string
  v3ExecuteDate: string
  v3WasSkipped: boolean
  v1TradeAlpha20dPct: DecimalValue
  v3TradeAlpha20dPct: DecimalValue
  improvement20dPct: DecimalValue
  v1TradeAlpha60dPct: DecimalValue
  v3TradeAlpha60dPct: DecimalValue
  improvement60dPct: DecimalValue
}

export interface BacktestValidation {
  experimentId: string
  title: string
  period: string
  dataSource: string
  framing: string
  mainCandidate: BacktestMetric
  libraV1: BacktestMetric
  results: BacktestMetric[]
  tradeAlphaSummary: BacktestTradeAlphaSummary
  tradeAlpha: BacktestTradeAlpha[]
  artifacts: string[]
  notes: string[]
}

export type BacktestDecisionFrequency = 'daily' | 'every-n-trading-days' | 'weekly'

export interface BacktestRunStartRequest {
  runId?: string
  model?: string
  governancePreset?: string
  promptVariant?: string
  executionPolicyMode?: string
  executionParticipationRate?: string
  executionMaxAbsDeltaPct?: string
  executionResolveTickerConflicts?: boolean
  issueStateEnabled?: boolean
  issueStateCooldownObservations?: number
  startDate?: string
  endDate?: string
  decisionFrequency?: BacktestDecisionFrequency
  decisionInterval?: number
  limit?: number
  force?: boolean
}

export interface BacktestRunStatus {
  runId: string
  status: 'RUNNING' | 'EXITED' | 'MISSING' | string
  pid: number | null
  startedAt: string | null
  model: string | null
  governancePreset: string | null
  executionPolicyMode: string | null
  issueStateEnabled: boolean | null
  executionResolveTickerConflicts: boolean | null
  decisionFrequency: string | null
  decisionInterval: number | null
  startDate: string | null
  endDate: string | null
  expectedRows: number | null
  rawRows: number | null
  lastDate: string | null
  prefixMatch: boolean | null
  decisionDistribution: Record<string, number>
  governanceBranchDistribution: Record<string, number>
  nonemptyRebalanceCount: number | null
  emptyRebalanceCount: number | null
  userDecisionRequiredCount: number | null
  issueStateSuppressionCount: number | null
  round1AgentCount: number | null
  round1Agents: string[]
  fallbackEventCount: number | null
  usageRequestCount: number | null
  inputTokens: number | null
  outputTokens: number | null
  cacheCreationInputTokens: number | null
  cacheReadInputTokens: number | null
  rawUpdatedAt: string | null
  eta: string | null
  rawOut: string | null
  usageLog: string | null
  traceOut: string | null
  stdoutLog: string | null
  stderrLog: string | null
  stdoutTail: string[]
  stderrTail: string[]
}
