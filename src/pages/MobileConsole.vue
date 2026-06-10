<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { brokerApi } from '@/api/broker'
import { useAuthStore } from '@/stores/auth'
import { useRunStreamStore } from '@/stores/runStream'
import { buildRunStartBody } from '@/composables/useRunPayload'
import type { DecimalValue, KisBalance, KisHolding } from '@/types/api'
import type { RunEvent } from '@/types/events'

type Tone = 'positive' | 'danger' | 'neutral'
type AssetClassKey = 'EQUITY' | 'BOND' | 'ALT' | 'CASH'
type VoteDirection = 'INCREASE' | 'HOLD' | 'DECREASE'
type AgentCompletedRunEvent = Extract<RunEvent, { event: 'agent_completed' }>

const router = useRouter()
const auth = useAuthStore()
const runStream = useRunStreamStore()

// ── 로컬 포트폴리오 상태 (모바일 뷰는 자체적으로 잔고를 가져온다) ──────────────
const balance = ref<KisBalance | null>(null)
const snapshotBalance = ref<KisBalance | null>(null)
const snapshotCount = ref(0)
const loadingBalance = ref(true)
const balanceNotice = ref('')
const runError = ref('')

const userName = computed(() => auth.user?.displayName || auth.user?.email || '운영자')

// ── 잔고 로딩 (loadBalance / loadLatestSnapshotDetail 미러) ─────────────────────
async function loadBalance() {
  try {
    const res = await brokerApi.kisBalance(true)
    balance.value = res.data
  } catch (err) {
    balanceNotice.value = errorMessage(err)
  }
}

async function loadSnapshotDetail() {
  try {
    const res = await brokerApi.latestPortfolioSnapshot()
    snapshotBalance.value = parseSnapshotBalance(res.data.snapshotJson)
  } catch {
    snapshotBalance.value = null
  }
}

async function loadSnapshots() {
  try {
    const res = await brokerApi.portfolioSnapshots(20)
    snapshotCount.value = res.data.length
  } catch {
    snapshotCount.value = 0
  }
}

onMounted(async () => {
  auth.hydrate()
  loadingBalance.value = true
  // 실잔고를 우선 시도하고, 실패/미연결 대비로 snapshot 도 병렬 로드한다.
  await Promise.allSettled([loadBalance(), loadSnapshotDetail(), loadSnapshots()])
  loadingBalance.value = false
})

// ── 파생 값 (visibleSummary / holdings / totalValue 미러) ──────────────────────
const visibleSummary = computed(() => balance.value?.summary ?? snapshotBalance.value?.summary ?? null)
const holdings = computed<KisHolding[]>(() => balance.value?.holdings ?? snapshotBalance.value?.holdings ?? [])
const totalValue = computed(() => toNumber(visibleSummary.value?.totalValuationAmount) ?? 0)
const totalProfit = computed(() => toNumber(visibleSummary.value?.profitLossAmount) ?? 0)
// 평가손익률은 검증 가능한 금액(평가-매입) 기준으로 재계산한다.
// KIS summary 의 profitLossRate 가 금액 부호와 어긋나는 계좌가 있어, 금액과 항상 일치시킨다.
const totalProfitRate = computed(() => {
  const summary = visibleSummary.value as { purchaseAmount?: DecimalValue; profitLossRate?: DecimalValue } | null
  const purchase = toNumber(summary?.purchaseAmount) ?? 0
  if (purchase > 0) return (totalProfit.value / purchase) * 100
  return toNumber(summary?.profitLossRate) ?? 0
})
const cashValue = computed(() => toNumber(visibleSummary.value?.depositAmount) ?? 0)
const cashWeight = computed(() => (totalValue.value > 0 ? cashValue.value / totalValue.value : 0))
const hasPortfolio = computed(() => holdings.value.length > 0 && totalValue.value > 0)

const dataSource = computed(() => {
  if (balance.value) return 'KIS LIVE'
  if (snapshotBalance.value) return 'SNAPSHOT'
  return ''
})
const isLive = computed(() => dataSource.value === 'KIS LIVE')
const profitTone = computed<Tone>(() => (totalProfit.value >= 0 ? 'positive' : 'danger'))

// ── 보유 종목 카드 ────────────────────────────────────────────────────────────
interface HoldingCard {
  key: string
  ticker: string
  name: string
  weightPct: number
  valueLabel: string
  profitRate: number
  tone: Tone
  assetClass: AssetClassKey
}

const holdingCards = computed<HoldingCard[]>(() => {
  if (!hasPortfolio.value) return []
  const rows = holdings.value
    .map((holding) => {
      const valuation = toNumber(holding.valuationAmount) ?? 0
      const weightPct = totalValue.value > 0 ? (valuation / totalValue.value) * 100 : 0
      const profitRate = toNumber(holding.profitLossRate) ?? 0
      return {
        key: holding.symbol,
        ticker: holding.symbol,
        name: holding.name || holding.symbol,
        weightPct,
        valueLabel: formatKrw(valuation),
        profitRate,
        tone: (toNumber(holding.profitLossAmount) ?? 0) >= 0 ? ('positive' as Tone) : ('danger' as Tone),
        assetClass: inferAssetClass(holding.symbol, holding.name),
        valuation
      }
    })
    .filter((row) => row.valuation > 0)
    .sort((a, b) => b.valuation - a.valuation)
    .slice(0, cashValue.value > 0 ? 7 : 8)
    .map(({ valuation, ...card }) => card)

  if (cashValue.value > 0) {
    rows.push({
      key: 'cash',
      ticker: 'CASH',
      name: '현금성 자산',
      weightPct: totalValue.value > 0 ? (cashValue.value / totalValue.value) * 100 : 0,
      valueLabel: formatKrw(cashValue.value),
      profitRate: 0,
      tone: 'neutral',
      assetClass: 'CASH'
    })
  }
  return rows
})

// ── 라이브 에이전트 의견 (agent_completed) ────────────────────────────────────
const agentCompletedEvents = computed(() =>
  runStream.events.filter((event): event is AgentCompletedRunEvent => event.event === 'agent_completed')
)
// 에이전트별 최신 1건만 (중복 라운드 제거)
const latestAgentCompletedEvents = computed(() => {
  const byAgent = new Map<string, AgentCompletedRunEvent>()
  agentCompletedEvents.value.forEach((event) => {
    byAgent.set(event.data.agent_id || `agent-${byAgent.size}`, event)
  })
  return Array.from(byAgent.values())
})

interface AgentOpinionRow {
  key: string
  name: string
  direction: VoteDirection
  directionGlyph: string
  directionLabel: string
  reasoning: string
}

const agentOpinions = computed<AgentOpinionRow[]>(() =>
  latestAgentCompletedEvents.value.map((event, index) => {
    const direction = voteDirectionFromAgent(event)
    const rawReason = [event.data.reasoning, event.data.opinion, event.data.limits_acknowledged, event.data.verdict]
      .find((value) => typeof value === 'string' && value.trim())
    return {
      key: `${event.data.agent_id || 'agent'}-${event.data.turn_number ?? 0}-${index}`,
      name: agentDisplayName(String(event.data.agent_id || 'agent')),
      direction,
      directionGlyph: direction === 'INCREASE' ? '▲' : direction === 'DECREASE' ? '▼' : '●',
      directionLabel: direction === 'INCREASE' ? '증가' : direction === 'DECREASE' ? '감소' : '유지',
      reasoning: rawReason ? simplifyDecisionReason(String(rawReason)) : '강한 조정 신호가 확인되지 않았습니다.'
    }
  })
)

// ── 합의/컴플라이언스 집계 (terminalConsensus 미러, 단순화) ────────────────────
interface ConsensusView {
  hasVotes: boolean
  nInc: number
  nHold: number
  nDec: number
  total: number
  agentCount: number
  headline: string
  conflict: boolean
}

const consensus = computed<ConsensusView>(() => {
  const votes = latestAgentCompletedEvents.value.map((event) => voteDirectionFromAgent(event))
  const nInc = votes.filter((v) => v === 'INCREASE').length
  const nHold = votes.filter((v) => v === 'HOLD').length
  const nDec = votes.filter((v) => v === 'DECREASE').length
  const total = nInc + nHold + nDec
  if (!total) {
    return { hasVotes: false, nInc: 0, nHold: 0, nDec: 0, total: 0, agentCount: 0, headline: '', conflict: false }
  }
  const focus = consensusFocusTicker()
  const action = nInc > nDec ? '확대' : nDec > nInc ? '축소' : '유지'
  const subject = focus || holdingCards.value[0]?.ticker || '포트폴리오'
  const headline = action === '유지'
    ? '현 비중 유지 권고'
    : `${subject} 비중 ${action} 권고`
  return {
    hasVotes: true,
    nInc,
    nHold,
    nDec,
    total,
    agentCount: latestAgentCompletedEvents.value.length,
    headline,
    conflict: nInc > 0 && nDec > 0
  }
})

function consensusFocusTicker(): string | null {
  const scores = new Map<string, number>()
  latestAgentCompletedEvents.value.forEach((event) => {
    event.data.focus_tickers?.forEach((ticker) => {
      const key = ticker.toUpperCase()
      scores.set(key, (scores.get(key) ?? 0) + 1)
    })
  })
  const entry = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]
  return entry ? entry[0] : null
}

// ── 컴플라이언스 / 한도 점검 상태 ─────────────────────────────────────────────
// interrupt 메시지에 한도 관련 문구가 있으면 '한도 초과', 아니면 '점검 통과'.
const complianceWarning = computed(() => {
  const pending = runStream.pendingInterrupt
  const text = pending?.message ?? ''
  return /한도|초과|cap|limit|exceed|single|집중/i.test(text)
})

// ── phase 기반 상태 플래그 ────────────────────────────────────────────────────
const isStreaming = computed(() =>
  runStream.phase === 'connecting' || runStream.phase === 'preparing' || runStream.phase === 'streaming'
)
const isInterrupted = computed(() => runStream.phase === 'interrupted' && !!runStream.pendingInterrupt)
const isCompleted = computed(() => runStream.phase === 'completed')
const isFailed = computed(() => runStream.phase === 'failed')
const hasRunStarted = computed(() => runStream.phase !== 'idle')

const phaseLabel = computed(() => {
  switch (runStream.phase) {
    case 'connecting':
      return '연결 중'
    case 'preparing':
      return '데이터 수집 중'
    case 'streaming':
      return '위원회 심의 중'
    case 'interrupted':
      return '사용자 승인 대기'
    case 'completed':
      return '심의 완료'
    case 'failed':
      return '실행 실패'
    default:
      return '대기'
  }
})

const ctaLabel = computed(() => {
  if (isStreaming.value) return '분석 중…'
  if (isInterrupted.value) return '승인 대기 중'
  return 'AI 리밸런싱 실행'
})
const ctaDisabled = computed(() => isStreaming.value || isInterrupted.value || loadingBalance.value)

// ── 결과 요약 (completion) ────────────────────────────────────────────────────
const completionSummary = computed(() => {
  const c = runStream.completion
  if (!c) return null
  const decisionRaw = (c.decision || '').toUpperCase()
  const isRebalance = decisionRaw === 'REBALANCE'
  return {
    decision: isRebalance ? '리밸런싱 실행' : decisionRaw === 'HOLD' ? '현 비중 유지' : decisionRaw || '심의 종료',
    branch: c.branch || '',
    isRebalance,
    statusLabel: c.run_status === 'completed_after_resume' ? '승인 반영 완료' : '심의 완료'
  }
})

// ── 승인 대기 거래안 (manualReviewPlan 미러) ──────────────────────────────────
interface PlanRow {
  ticker: string
  name: string
  deltaPct: number
}

const reviewPlan = computed<PlanRow[]>(() => {
  const pending = runStream.pendingInterrupt as Record<string, unknown> | null
  const plan = pending?.candidate_rebalance_plan
  if (!plan || typeof plan !== 'object') return []
  const nameByTicker = new Map(holdings.value.map((h) => [h.symbol, h.name]))
  return Object.entries(plan as Record<string, number>)
    .map(([ticker, delta]) => ({
      ticker,
      name: nameByTicker.get(ticker) || ticker,
      deltaPct: Number(delta) * 100
    }))
    .filter((row) => Number.isFinite(row.deltaPct) && Math.abs(row.deltaPct) >= 0.05)
    .sort((a, b) => b.deltaPct - a.deltaPct)
})

const reviewReason = computed(() => runStream.pendingInterrupt?.message || '최종 결정 적용 전에 사용자 확인이 필요합니다.')

// ── 액션 ──────────────────────────────────────────────────────────────────────
async function runRebalance() {
  runError.value = ''
  if (!hasPortfolio.value) {
    // 실잔고가 비어 있으면 snapshot 복원을 한 번 더 시도.
    await loadSnapshotDetail()
  }
  if (!hasPortfolio.value) {
    runError.value = 'KIS 잔고를 동기화하거나 저장된 포트폴리오 snapshot이 있어야 리밸런싱 판단을 실행할 수 있습니다.'
    return
  }
  try {
    const body = buildRunStartBody({
      balance: balance.value,
      snapshotBalance: snapshotBalance.value,
      summary: visibleSummary.value,
      holdings: holdings.value,
      totalValue: totalValue.value,
      cashWeight: cashWeight.value,
      dataSource: dataSource.value || 'SNAPSHOT',
      snapshotId: balance.value?.snapshotId || snapshotBalance.value?.snapshotId || null
    })
    await runStream.start(body)
    // 심의 종료 후 잔고/스냅샷 최신화
    await Promise.allSettled([loadBalance(), loadSnapshotDetail()])
  } catch (err) {
    runError.value = errorMessage(err)
  }
}

async function approve() {
  await resumeReview(true, 'APPROVE')
}
async function reject() {
  await resumeReview(false, 'REJECT')
}

async function resumeReview(approved: boolean, decision: 'APPROVE' | 'REJECT') {
  if (!runStream.currentThreadId) return
  runError.value = ''
  const pending = runStream.pendingInterrupt
  try {
    await runStream.resume({
      approved,
      decision,
      interrupt_id: pending?.interrupt_id ?? null,
      note: `mobile_console:${decision}`,
      metadata: { source: 'mobile_console' }
    })
  } catch (err) {
    runError.value = `에이전트 실행을 재개하지 못했습니다: ${errorMessage(err)}`
  }
}

function onLogout() {
  runStream.cancel()
  auth.logout()
  router.push({ name: 'login' })
}

// ── 자산군 색상 도트 ──────────────────────────────────────────────────────────
function assetDotColor(assetClass: AssetClassKey): string {
  switch (assetClass) {
    case 'BOND':
      return '#3b82f6'
    case 'ALT':
      return '#f59e0b'
    case 'CASH':
      return '#8a8f98'
    default:
      return '#22c55e'
  }
}

// ── 헬퍼 (DashboardPageJY 로직 동등 복제) ──────────────────────────────────────
function toNumber(value: DecimalValue | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function formatMoney(value: DecimalValue | undefined): string {
  const n = toNumber(value)
  if (n === null) return '-'
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)
}

function formatKrw(value: DecimalValue | undefined): string {
  const n = toNumber(value)
  if (n === null) return '-'
  return `₩${formatMoney(n)}`
}

function formatSignedKrw(value: number): string {
  return `${value > 0 ? '+' : ''}${formatMoney(value)}원`
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatDeltaPoint(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%p`
}

function inferAssetClass(ticker: string, name = ''): AssetClassKey {
  const text = `${ticker} ${name}`.toUpperCase()
  if (['USD', 'CASH', 'KRW'].some((token) => text.includes(token)) || /현금|예수금/.test(name)) return 'CASH'
  if (/(TLT|IEF|SHY|BND|AGG|LQD|HYG|BOND|채권|국채|회사채)/i.test(text)) return 'BOND'
  if (/(GLD|IAU|SLV|PDBC|DBC|BTC|ETH|금|원자재|CRYPTO)/i.test(text)) return 'ALT'
  return 'EQUITY'
}

function voteDirectionFromAgent(event: AgentCompletedRunEvent): VoteDirection {
  const numeric = event.data.direction
  if (typeof numeric === 'number') {
    if (numeric > 0.15) return 'INCREASE'
    if (numeric < -0.15) return 'DECREASE'
    return 'HOLD'
  }
  const text = [event.data.opinion, event.data.verdict, event.data.reasoning].filter(Boolean).join(' ').toUpperCase()
  if (/(INCREASE|BUY|ADD|OVERWEIGHT|EXPAND|비중 확대|매수|추가)/.test(text)) return 'INCREASE'
  if (/(DECREASE|SELL|TRIM|REDUCE|UNDERWEIGHT|비중 축소|매도|감축)/.test(text)) return 'DECREASE'
  return 'HOLD'
}

function agentDisplayName(agentId: string): string {
  const normalized = agentId.replaceAll('_', ' ').toLowerCase()
  if (normalized.includes('disclosure')) return '공시 에이전트'
  if (normalized.includes('news')) return '뉴스 에이전트'
  if (normalized.includes('report')) return '리포트 에이전트'
  if (normalized.includes('risk')) return '리스크 에이전트'
  if (normalized.includes('technical')) return '기술지표 에이전트'
  if (normalized.includes('liquidity')) return '유동성 에이전트'
  if (normalized.includes('cost')) return '비용 에이전트'
  if (normalized.includes('profit') || normalized.includes('fundamental')) return '수익성 에이전트'
  if (normalized.includes('tax')) return '세금 에이전트'
  if (normalized.includes('execution')) return '실행 에이전트'
  if (normalized.includes('esg')) return 'ESG 에이전트'
  if (normalized.includes('macro')) return '거시 에이전트'
  if (normalized.includes('sentiment')) return '감성 에이전트'
  if (normalized.includes('judge') || normalized.includes('final')) return '최종 판단자'
  if (normalized.includes('mediator')) return '중재자'
  return agentId.replaceAll('_', ' ').toUpperCase()
}

function toUserFacingText(value: string): string {
  return value
    .replace(/\*+/g, '')
    .replace(/`+/g, '')
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replaceAll('DIRECT_ANSWER_UNAVAILABLE', '관련 자료 없음')
    .replaceAll('candidate_rebalance_plan', '리밸런싱 후보안')
    .replaceAll('LLM', 'AI 판단')
}

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized
}

function simplifyDecisionReason(value: string): string {
  const text = toUserFacingText(value)
  if ((text.includes('근거') || text.includes('자료')) && (text.includes('없') || text.includes('부족'))) {
    return '해당 에이전트에서 강한 조정 신호가 확인되지 않았습니다.'
  }
  if (text.includes('관련 공시') || text.includes('관련 뉴스') || text.includes('근거 자료')) {
    return '현재 수집된 공시·뉴스·리포트에서 강한 조정 신호가 없어 포트폴리오를 유지합니다.'
  }
  if (text.includes('실행 가능한 거래') || text.includes('리밸런싱 후보안')) {
    return '실행할 만한 리밸런싱 후보가 없어 현재 포트폴리오를 유지합니다.'
  }
  return truncateText(text, 160)
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function normalizeSnapshotRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  if (record.summary && Array.isArray(record.holdings)) return record
  const candidates = [record.balance, record.kisBalance, record.data, record.snapshot]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const nested = candidate as Record<string, unknown>
      if (nested.summary && Array.isArray(nested.holdings)) return nested
    }
  }
  return null
}

function parseSnapshotBalance(value: string): KisBalance | null {
  const parsed = parseJsonObject(value)
  if (!parsed) return null
  const source = normalizeSnapshotRecord(parsed)
  if (!source) return null
  const summary = source.summary
  const snapshotHoldings = Array.isArray(source.holdings) ? source.holdings : []
  if (!summary || typeof summary !== 'object') return null
  return {
    snapshotId: typeof source.snapshotId === 'string' ? source.snapshotId : null,
    environment: typeof source.environment === 'string' ? source.environment : 'SNAPSHOT',
    holdings: snapshotHoldings as KisBalance['holdings'],
    summary: summary as KisBalance['summary'],
    rawSummary:
      typeof source.rawSummary === 'object' && source.rawSummary !== null
        ? (source.rawSummary as Record<string, unknown>)
        : {},
    hasNextPage: false,
    nextContextFk: '',
    nextContextNk: ''
  }
}

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.detail || err.response?.data?.message || err.message
  }
  return err instanceof Error ? err.message : String(err)
}
</script>

<template>
  <div class="mc-root dark-theme">
    <div class="mc-shell">
      <!-- 1. 상단 앱바 -->
      <header class="mc-appbar">
        <div class="mc-wordmark">LIBRA</div>
        <div class="mc-appbar-right">
          <span class="mc-source-pill" :class="{ 'is-live': isLive, 'is-snapshot': dataSource === 'SNAPSHOT', 'is-off': !dataSource }">
            <span class="mc-dot"></span>
            {{ isLive ? 'KIS LIVE' : dataSource === 'SNAPSHOT' ? '스냅샷' : '연결 전' }}
          </span>
          <button type="button" class="mc-icon-btn" aria-label="로그아웃" @click="onLogout">
            <i class="ph ph-sign-out"></i>
          </button>
        </div>
      </header>

      <!-- 2. 히어로 총자산 카드 -->
      <section class="mc-hero">
        <p class="mc-hero-label">총 자산</p>
        <p v-if="loadingBalance" class="mc-hero-value mc-skeleton-text">불러오는 중…</p>
        <template v-else>
          <p class="mc-hero-value">{{ hasPortfolio ? formatKrw(totalValue) : '—' }}</p>
          <div v-if="hasPortfolio" class="mc-hero-meta">
            <span class="mc-pnl-pill" :class="profitTone">
              {{ totalProfit >= 0 ? '▲' : '▼' }} {{ formatSignedPercent(totalProfitRate) }}
            </span>
            <span class="mc-hero-sub">평가손익 {{ formatSignedKrw(totalProfit) }}</span>
          </div>
          <p v-else class="mc-hero-sub mc-hero-empty">
            {{ balanceNotice || 'KIS 계좌 연결 또는 저장된 스냅샷이 필요합니다.' }}
          </p>
        </template>
      </section>

      <!-- 3. AI 판단 카드 (핵심 차별 요소) -->
      <section class="mc-ai-card" :class="{ 'is-active': consensus.hasVotes || isStreaming || isInterrupted }">
        <div class="mc-ai-head">
          <span class="mc-ai-title"><i class="ph-fill ph-sparkle"></i> 오늘의 AI 판단</span>
          <span v-if="hasRunStarted" class="mc-phase-chip" :class="{ streaming: isStreaming, done: isCompleted, fail: isFailed, review: isInterrupted }">
            {{ phaseLabel }}
          </span>
        </div>

        <!-- 분석 전 빈 상태 -->
        <div v-if="!hasRunStarted" class="mc-ai-empty">
          <p class="mc-ai-empty-title">아직 분석 전</p>
          <p class="mc-ai-empty-sub">아래 버튼으로 위원회를 실행하세요.</p>
        </div>

        <!-- 라이브 합의 결과 -->
        <template v-else>
          <template v-if="consensus.hasVotes">
            <p class="mc-ai-headline">{{ consensus.headline }}</p>
            <div class="mc-ai-chips">
              <span class="mc-ai-chip">{{ consensus.agentCount }}개 에이전트</span>
              <span class="mc-dist mc-dist-inc">▲ {{ consensus.nInc }}</span>
              <span class="mc-dist mc-dist-hold">● {{ consensus.nHold }}</span>
              <span class="mc-dist mc-dist-dec">▼ {{ consensus.nDec }}</span>
            </div>
            <div class="mc-compliance" :class="complianceWarning ? 'warn' : 'ok'">
              <i class="ph" :class="complianceWarning ? 'ph-warning' : 'ph-check-circle'"></i>
              {{ complianceWarning ? '한도 초과 — 사용자 검토 필요' : '컴플라이언스 점검 통과' }}
            </div>
          </template>
          <div v-else class="mc-ai-empty">
            <p class="mc-ai-empty-title">{{ isStreaming ? '위원회 심의 중…' : phaseLabel }}</p>
            <p class="mc-ai-empty-sub">{{ isStreaming ? '에이전트 의견을 수집하고 있습니다.' : '아직 집계된 합의가 없습니다.' }}</p>
          </div>
        </template>
      </section>

      <!-- 5. 기본 CTA -->
      <button type="button" class="mc-cta" :class="{ 'is-busy': isStreaming || isInterrupted }" :disabled="ctaDisabled" @click="runRebalance">
        <i v-if="!isStreaming" class="ph-fill ph-play-circle"></i>
        <span v-else class="mc-spinner"></span>
        {{ ctaLabel }}
      </button>
      <p v-if="runError" class="mc-error">{{ runError }}</p>

      <!-- 라이브 에이전트 피드 (스트리밍 중) -->
      <section v-if="isStreaming || (hasRunStarted && agentOpinions.length)" class="mc-feed">
        <div class="mc-feed-head">
          <span>에이전트 의견</span>
          <span class="mc-feed-count">{{ agentOpinions.length }}건</span>
        </div>
        <p v-if="!agentOpinions.length" class="mc-feed-wait">의견을 기다리는 중…</p>
        <ul v-else class="mc-feed-list">
          <li v-for="row in agentOpinions" :key="row.key" class="mc-feed-row">
            <span class="mc-feed-dir" :class="row.direction.toLowerCase()">{{ row.directionGlyph }}</span>
            <div class="mc-feed-body">
              <div class="mc-feed-top">
                <span class="mc-feed-name">{{ row.name }}</span>
                <span class="mc-feed-tag" :class="row.direction.toLowerCase()">{{ row.directionLabel }}</span>
              </div>
              <p class="mc-feed-reason">{{ row.reasoning }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- 6. 승인 시트 (interrupted) -->
      <section v-if="isInterrupted" class="mc-approval">
        <div class="mc-approval-head">
          <i class="ph-fill ph-gavel"></i>
          <span>리밸런싱 승인 요청</span>
        </div>
        <p class="mc-approval-reason">{{ reviewReason }}</p>
        <ul v-if="reviewPlan.length" class="mc-plan-list">
          <li v-for="row in reviewPlan" :key="row.ticker" class="mc-plan-row">
            <div class="mc-plan-name">
              <span class="mc-plan-ticker">{{ row.ticker }}</span>
              <span class="mc-plan-co">{{ row.name }}</span>
            </div>
            <span class="mc-plan-delta" :class="row.deltaPct >= 0 ? 'up' : 'down'">
              {{ row.deltaPct >= 0 ? '▲' : '▼' }} {{ formatDeltaPoint(row.deltaPct) }}
            </span>
          </li>
        </ul>
        <p v-else class="mc-plan-empty">구체적 거래안 없이 결정 확인이 필요합니다.</p>
        <div class="mc-approval-actions">
          <button type="button" class="mc-btn-reject" @click="reject">거절</button>
          <button type="button" class="mc-btn-approve" @click="approve">승인</button>
        </div>
      </section>

      <!-- 완료 결과 요약 -->
      <section v-else-if="isCompleted && completionSummary" class="mc-result">
        <div class="mc-result-head"><i class="ph-fill ph-check-circle"></i> {{ completionSummary.statusLabel }}</div>
        <p class="mc-result-decision">{{ completionSummary.decision }}</p>
        <p v-if="completionSummary.branch" class="mc-result-branch">분기: {{ completionSummary.branch }}</p>
      </section>

      <!-- 실패 안내 -->
      <section v-else-if="isFailed" class="mc-result is-fail">
        <div class="mc-result-head"><i class="ph-fill ph-x-circle"></i> 실행 실패</div>
        <p class="mc-result-decision">{{ runStream.errorMessage || '실시간 분석이 중단되었습니다.' }}</p>
      </section>

      <!-- 4. 보유 종목 리스트 -->
      <section class="mc-holdings">
        <div class="mc-holdings-head">
          <span>보유 종목</span>
          <span v-if="dataSource" class="mc-holdings-src">{{ dataSource }}</span>
        </div>
        <p v-if="loadingBalance" class="mc-holdings-empty">잔고를 불러오는 중…</p>
        <p v-else-if="!holdingCards.length" class="mc-holdings-empty">표시할 보유 종목이 없습니다.</p>
        <ul v-else class="mc-holdings-list">
          <li v-for="card in holdingCards" :key="card.key" class="mc-holding-row">
            <span class="mc-asset-dot" :style="{ backgroundColor: assetDotColor(card.assetClass) }"></span>
            <div class="mc-holding-name">
              <span class="mc-holding-ticker">{{ card.ticker }}</span>
              <span class="mc-holding-co">{{ card.name }}</span>
            </div>
            <div class="mc-holding-right">
              <span class="mc-holding-weight">{{ card.weightPct.toFixed(1) }}%</span>
              <span v-if="card.tone !== 'neutral'" class="mc-holding-pl" :class="card.tone">
                {{ formatSignedPercent(card.profitRate) }}
              </span>
              <span v-else class="mc-holding-pl flat">현금</span>
            </div>
          </li>
        </ul>
      </section>

      <footer class="mc-footer">{{ userName }} · LIBRA 운영 콘솔</footer>
    </div>
  </div>
</template>

<style scoped>
/* 다크 프리미엄 핀테크 — 데스크톱 콘솔의 토큰/팔레트(차콜 bg, 그린/레드 손익)와 일관. */
.mc-root {
  --mc-bg: hsl(220, 15%, 8%);
  --mc-bg-grad: radial-gradient(120% 80% at 50% 0%, hsl(220, 16%, 13%) 0%, hsl(220, 15%, 8%) 60%);
  --mc-card: hsl(220, 12%, 13%);
  --mc-card-soft: hsl(220, 12%, 16%);
  --mc-border: hsla(220, 10%, 90%, 0.08);
  --mc-text: hsl(35, 20%, 92%);
  --mc-text-sub: hsl(220, 8%, 66%);
  --mc-text-dim: hsl(220, 6%, 48%);
  --mc-pos: #22c55e;
  --mc-neg: #ef4444;
  --mc-accent: #2de2c4;
  --mc-accent-2: #22c55e;
  --mc-gold: #f59e0b;

  min-height: 100vh;
  background: var(--mc-bg-grad);
  color: var(--mc-text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.mc-shell {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px 18px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mc-num,
.mc-hero-value,
.mc-holding-weight,
.mc-holding-pl,
.mc-pnl-pill,
.mc-plan-delta {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

/* 앱바 */
.mc-appbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 2px;
}
.mc-wordmark {
  font-family: 'Outfit', 'Inter', sans-serif;
  font-weight: 800;
  letter-spacing: 0.22em;
  font-size: 19px;
  color: var(--mc-text);
}
.mc-appbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mc-source-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  border: 1px solid var(--mc-border);
  background: var(--mc-card);
  color: var(--mc-text-sub);
}
.mc-source-pill .mc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--mc-text-dim);
}
.mc-source-pill.is-live {
  color: var(--mc-pos);
  border-color: hsla(145, 60%, 45%, 0.4);
  background: hsla(145, 60%, 30%, 0.12);
}
.mc-source-pill.is-live .mc-dot {
  background: var(--mc-pos);
  box-shadow: 0 0 0 3px hsla(145, 60%, 45%, 0.25);
}
.mc-source-pill.is-snapshot {
  color: var(--mc-gold);
}
.mc-source-pill.is-snapshot .mc-dot {
  background: var(--mc-gold);
}
.mc-icon-btn {
  width: 38px;
  height: 38px;
  display: inline-grid;
  place-items: center;
  border-radius: 11px;
  border: 1px solid var(--mc-border);
  background: var(--mc-card);
  color: var(--mc-text-sub);
  font-size: 17px;
  cursor: pointer;
}
.mc-icon-btn:active {
  background: var(--mc-card-soft);
}

/* 히어로 */
.mc-hero {
  padding: 22px 20px 24px;
  border-radius: 20px;
  background: linear-gradient(160deg, hsl(220, 14%, 15%) 0%, hsl(220, 14%, 11%) 100%);
  border: 1px solid var(--mc-border);
}
.mc-hero-label {
  font-size: 13px;
  color: var(--mc-text-sub);
  margin: 0 0 6px;
}
.mc-hero-value {
  font-family: 'Outfit', 'Inter', sans-serif;
  font-size: 38px;
  line-height: 1.05;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}
.mc-skeleton-text {
  color: var(--mc-text-dim);
  font-size: 22px;
  font-weight: 500;
}
.mc-hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.mc-pnl-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 11px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 700;
}
.mc-pnl-pill.positive {
  color: var(--mc-pos);
  background: hsla(145, 60%, 35%, 0.16);
}
.mc-pnl-pill.danger {
  color: var(--mc-neg);
  background: hsla(0, 70%, 50%, 0.16);
}
.mc-hero-sub {
  font-size: 13px;
  color: var(--mc-text-sub);
}
.mc-hero-empty {
  margin: 14px 0 0;
  line-height: 1.5;
}

/* AI 판단 카드 */
.mc-ai-card {
  padding: 18px 18px 20px;
  border-radius: 20px;
  background: var(--mc-card);
  border: 1px solid var(--mc-border);
  position: relative;
}
.mc-ai-card.is-active {
  border-color: hsla(168, 70%, 52%, 0.45);
  box-shadow: 0 0 0 1px hsla(168, 70%, 52%, 0.18), 0 8px 30px hsla(168, 70%, 40%, 0.12);
  background: linear-gradient(165deg, hsla(168, 40%, 16%, 0.55) 0%, var(--mc-card) 55%);
}
.mc-ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.mc-ai-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 15px;
  font-weight: 700;
}
.mc-ai-title i {
  color: var(--mc-accent);
}
.mc-phase-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 9999px;
  background: var(--mc-card-soft);
  color: var(--mc-text-sub);
  border: 1px solid var(--mc-border);
}
.mc-phase-chip.streaming {
  color: var(--mc-accent);
  border-color: hsla(168, 70%, 52%, 0.4);
}
.mc-phase-chip.review {
  color: var(--mc-gold);
  border-color: hsla(38, 90%, 55%, 0.4);
}
.mc-phase-chip.done {
  color: var(--mc-pos);
}
.mc-phase-chip.fail {
  color: var(--mc-neg);
}
.mc-ai-empty {
  padding: 10px 0 4px;
}
.mc-ai-empty-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px;
}
.mc-ai-empty-sub {
  font-size: 13px;
  color: var(--mc-text-sub);
  margin: 0;
}
.mc-ai-headline {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 12px;
  line-height: 1.3;
}
.mc-ai-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.mc-ai-chip {
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 9999px;
  background: var(--mc-card-soft);
  color: var(--mc-text);
}
.mc-dist {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.mc-dist-inc {
  color: var(--mc-pos);
}
.mc-dist-hold {
  color: var(--mc-text-sub);
}
.mc-dist-dec {
  color: var(--mc-neg);
}
.mc-compliance {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 11px;
  border-radius: 10px;
}
.mc-compliance.ok {
  color: var(--mc-pos);
  background: hsla(145, 60%, 30%, 0.12);
}
.mc-compliance.warn {
  color: var(--mc-gold);
  background: hsla(38, 90%, 50%, 0.12);
}

/* CTA */
.mc-cta {
  width: 100%;
  min-height: 54px;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #04140f;
  background: linear-gradient(100deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  cursor: pointer;
  box-shadow: 0 10px 26px hsla(160, 70%, 40%, 0.28);
  transition: transform 0.12s ease, opacity 0.2s ease;
}
.mc-cta i {
  font-size: 20px;
}
.mc-cta:active {
  transform: scale(0.985);
}
.mc-cta:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}
.mc-cta.is-busy {
  color: var(--mc-text-sub);
  background: var(--mc-card);
  border: 1px solid var(--mc-border);
  box-shadow: none;
}
.mc-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid hsla(0, 0%, 100%, 0.25);
  border-top-color: var(--mc-accent);
  animation: mc-spin 0.7s linear infinite;
}
@keyframes mc-spin {
  to {
    transform: rotate(360deg);
  }
}
.mc-error {
  font-size: 12.5px;
  color: var(--mc-neg);
  margin: -6px 2px 0;
  line-height: 1.5;
}

/* 에이전트 피드 */
.mc-feed,
.mc-approval,
.mc-result,
.mc-holdings {
  border-radius: 18px;
  background: var(--mc-card);
  border: 1px solid var(--mc-border);
  padding: 16px 16px 14px;
}
.mc-feed-head,
.mc-holdings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mc-text-dim);
  margin-bottom: 12px;
}
.mc-feed-count,
.mc-holdings-src {
  font-size: 11px;
  color: var(--mc-text-sub);
}
.mc-feed-wait {
  font-size: 13px;
  color: var(--mc-text-sub);
  margin: 4px 0;
}
.mc-feed-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mc-feed-row {
  display: flex;
  gap: 11px;
}
.mc-feed-dir {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--mc-card-soft);
}
.mc-feed-dir.increase {
  color: var(--mc-pos);
}
.mc-feed-dir.decrease {
  color: var(--mc-neg);
}
.mc-feed-dir.hold {
  color: var(--mc-text-sub);
}
.mc-feed-body {
  flex: 1;
  min-width: 0;
}
.mc-feed-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.mc-feed-name {
  font-size: 14px;
  font-weight: 600;
}
.mc-feed-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 9999px;
  background: var(--mc-card-soft);
}
.mc-feed-tag.increase {
  color: var(--mc-pos);
}
.mc-feed-tag.decrease {
  color: var(--mc-neg);
}
.mc-feed-tag.hold {
  color: var(--mc-text-sub);
}
.mc-feed-reason {
  font-size: 13px;
  line-height: 1.5;
  color: var(--mc-text-sub);
  margin: 0;
}

/* 승인 시트 */
.mc-approval {
  border-color: hsla(38, 90%, 55%, 0.4);
  box-shadow: 0 0 0 1px hsla(38, 90%, 55%, 0.14);
}
.mc-approval-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--mc-gold);
  margin-bottom: 10px;
}
.mc-approval-reason {
  font-size: 13px;
  line-height: 1.5;
  color: var(--mc-text-sub);
  margin: 0 0 14px;
}
.mc-plan-list {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.mc-plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--mc-card-soft);
}
.mc-plan-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mc-plan-ticker {
  font-size: 14px;
  font-weight: 700;
}
.mc-plan-co {
  font-size: 12px;
  color: var(--mc-text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-plan-delta {
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.mc-plan-delta.up {
  color: var(--mc-pos);
}
.mc-plan-delta.down {
  color: var(--mc-neg);
}
.mc-plan-empty {
  font-size: 13px;
  color: var(--mc-text-sub);
  margin: 0 0 16px;
}
.mc-approval-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
}
.mc-btn-reject,
.mc-btn-approve {
  min-height: 48px;
  border-radius: 13px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--mc-border);
}
.mc-btn-reject {
  background: transparent;
  color: var(--mc-neg);
  border-color: hsla(0, 70%, 50%, 0.4);
}
.mc-btn-reject:active {
  background: hsla(0, 70%, 50%, 0.1);
}
.mc-btn-approve {
  border: none;
  color: #04140f;
  background: linear-gradient(100deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%);
}
.mc-btn-approve:active {
  transform: scale(0.985);
}

/* 결과 요약 */
.mc-result-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mc-pos);
  margin-bottom: 8px;
}
.mc-result.is-fail .mc-result-head {
  color: var(--mc-neg);
}
.mc-result-decision {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.mc-result-branch {
  font-size: 12px;
  color: var(--mc-text-sub);
  margin: 6px 0 0;
}

/* 보유 종목 */
.mc-holdings-empty {
  font-size: 13px;
  color: var(--mc-text-sub);
  margin: 4px 0;
}
.mc-holdings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.mc-holding-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 0;
  border-bottom: 1px solid var(--mc-border);
}
.mc-holding-row:last-child {
  border-bottom: none;
}
.mc-asset-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mc-holding-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.mc-holding-ticker {
  font-size: 14px;
  font-weight: 700;
}
.mc-holding-co {
  font-size: 12px;
  color: var(--mc-text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-holding-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.mc-holding-weight {
  font-size: 14px;
  font-weight: 700;
}
.mc-holding-pl {
  font-size: 12px;
  font-weight: 600;
}
.mc-holding-pl.positive {
  color: var(--mc-pos);
}
.mc-holding-pl.danger {
  color: var(--mc-neg);
}
.mc-holding-pl.flat {
  color: var(--mc-text-dim);
}

.mc-footer {
  text-align: center;
  font-size: 11px;
  color: var(--mc-text-dim);
  padding-top: 6px;
}
</style>
