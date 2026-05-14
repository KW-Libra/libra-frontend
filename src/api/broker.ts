import { api } from './client'
import type {
  KisBalance,
  KisOrderAudit,
  KisQuote,
  KisStatus,
  PortfolioSnapshot,
  PortfolioSnapshotDetail
} from '@/types/api'

export const brokerApi = {
  kisStatus: () => api.get<KisStatus>('/api/market/kis/status'),

  kisQuote: (symbol: string, marketCode = 'J') =>
    api.get<KisQuote>(`/api/market/kis/quotes/${encodeURIComponent(symbol)}`, {
      params: { marketCode }
    }),

  kisBalance: (saveSnapshot = true) =>
    api.get<KisBalance>('/api/broker/kis/account/balance', {
      params: { saveSnapshot }
    }),

  orderAudits: (limit = 20) =>
    api.get<KisOrderAudit[]>('/api/broker/kis/orders/audits', {
      params: { limit }
    }),

  portfolioSnapshots: (limit = 20) =>
    api.get<PortfolioSnapshot[]>('/api/portfolio/snapshots', {
      params: { limit }
    }),

  latestPortfolioSnapshot: () =>
    api.get<PortfolioSnapshotDetail>('/api/portfolio/snapshots/latest')
}
