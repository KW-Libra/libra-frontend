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
  enabled: boolean
  tradingEnabled: boolean
  environment: string
  baseUrl: string
  restConfigured: boolean
  accountConfigured: boolean
  webSocketConfigured: boolean
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

export type KisOrderAuditStatus = 'REQUESTED' | 'DRY_RUN' | 'SUBMITTED' | 'REJECTED' | 'FAILED'
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
  dryRun: boolean
  tradingEnabled: boolean
  brokerOrderNo: string | null
  brokerMessage: string | null
  errorCode: string | null
  errorMessage: string | null
  traceId: string | null
  createdAt: string
  updatedAt: string
}
