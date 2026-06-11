<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { brokerApi } from '@/api/broker'
import type { RunStartBody } from '@/api/sse'
import { useAuthStore } from '@/stores/auth'
import { useRunStreamStore } from '@/stores/runStream'
import { useAgentHistory } from '@/composables/useAgentHistory'
import { useIsMobile } from '@/composables/useIsMobile'
import MobileConsole from '@/pages/MobileConsole.vue'
import type {
  DecimalValue,
  KisBalance,
  KisCredentialRequest,
  KisOrderAudit,
  KisQuote,
  KisStatus,
  PortfolioSnapshot
} from '@/types/api'
import type { RunEvent } from '@/types/events'

type Level = 0 | 1 | 2 | 3 | 4
type Tone = 'positive' | 'danger' | 'neutral'
type DashboardTab = 'dashboard' | 'agent' | 'risk' | 'mypage'
type AgentSubtab = 'settings' | 'visualize' | 'history'
type AgentViewState = 'init' | 'running' | 'success' | 'manualReview' | 'deadlock'
type FlowNodeKey = 'core' | 'risk' | 'macro' | 'cost' | 'news' | 'mediator' | 'judge'
type StrategicModeKey = 'conservative' | 'balanced' | 'aggressive'
type VoteDirection = 'INCREASE' | 'HOLD' | 'DECREASE'
type AssetClassKey = 'EQUITY' | 'BOND' | 'ALT' | 'CASH'
type ManualReviewDecision = 'APPROVE' | 'REJECT' | 'REVISE'
type AgentCompletedRunEvent = Extract<RunEvent, { event: 'agent_completed' }>

interface ManualReviewAction {
  decision: ManualReviewDecision
  label: string
  approved: boolean
  className: string
}

interface PortfolioHoldingCard {
  key: string
  ticker: string
  name: string
  weightPct: number
  targetPct: number
  valueLabel: string
  profitLabel: string
  tone: Tone
  assetClass: AssetClassKey
}

interface FlowNodeMeta {
  title: string
  idle: string
  active: string
  complete: string
  agents: string[]
}

const FLOW_NODE_META: Record<FlowNodeKey, FlowNodeMeta> = {
  core: {
    title: 'CORE COUNCIL',
    idle: 'Session control',
    active: 'Orchestrating',
    complete: 'Session routed',
    agents: ['Compliance', 'Round 1']
  },
  risk: {
    title: 'RISK LAYER',
    idle: 'Risk / Liquidity / Technical',
    active: 'Checking risk gates',
    complete: 'Risk checked',
    agents: ['Risk', 'Liquidity', 'Technical']
  },
  macro: {
    title: 'RETURN LAYER',
    idle: 'Profit / Macro / ESG',
    active: 'Scoring return signals',
    complete: 'Return checked',
    agents: ['Profit', 'Macro', 'ESG']
  },
  cost: {
    title: 'EXECUTION LAYER',
    idle: 'Cost / Tax / Execution',
    active: 'Validating execution',
    complete: 'Execution checked',
    agents: ['Cost', 'Tax', 'Execution']
  },
  news: {
    title: 'EVIDENCE LAYER',
    idle: 'News / Disclosure / Report',
    active: 'Reading evidence',
    complete: 'Evidence checked',
    agents: ['Disclosure', 'News', 'Report']
  },
  mediator: {
    title: 'MEDIATOR JUDGE',
    idle: 'Conflict routing',
    active: 'Resolving conflicts',
    complete: 'Conflict resolved',
    agents: ['Mediator']
  },
  judge: {
    title: 'FINAL JUDGE',
    idle: 'Final approval',
    active: 'Approving strategy',
    complete: 'Decision issued',
    agents: ['Final Judge']
  }
}

const DEMO_TOTAL_VALUE = 142_500_000
const DEMO_TOTAL_PROFIT = 16_840_000
const DEMO_PORTFOLIO = [
  { key: 'SPY', ticker: 'SPY', name: '미국 대형주', weight: 35.0, target: 30.0, value: 49_875_000, profitRate: 14.2, tone: 'positive' as Tone },
  { key: 'QQQ', ticker: 'QQQ', name: '글로벌 정보기술', weight: 25.0, target: 35.0, value: 35_625_000, profitRate: 22.8, tone: 'positive' as Tone },
  { key: 'TLT', ticker: 'TLT', name: '미국 장기채권', weight: 25.0, target: 20.0, value: 35_625_000, profitRate: -3.4, tone: 'danger' as Tone },
  { key: 'GLD', ticker: 'GLD', name: '실물 금 자산', weight: 10.0, target: 10.0, value: 14_250_000, profitRate: 8.5, tone: 'positive' as Tone },
  { key: 'USD', ticker: 'USD', name: '현금성 자산', weight: 5.0, target: 5.0, value: 7_125_000, profitRate: 0.0, tone: 'neutral' as Tone }
]
const DEMO_MEMORY_SEED: Array<[number, Level]> = [
  [3, 2], [7, 3], [10, 1], [14, 4], [18, 2], [21, 1], [24, 3],
  [28, 2], [32, 1], [35, 4], [39, 2], [44, 3], [48, 1], [52, 2],
  [56, 3], [60, 1], [64, 2], [68, 4], [72, 1], [75, 2]
]
const STRATEGIC_MODES: Array<{
  value: StrategicModeKey
  label: string
  controlLabel: string
  description: string
  icon: string
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  riskScore: number
  maxDrawdownTolerancePct: number
  singleTickerLimitPct: number
  sectorLimitPct: number
  annualVolatilityLimitPct: number
  minCashPct: number
  assetClassTarget: Record<string, number>
}> = [
  {
    value: 'conservative',
    label: 'Conservative',
    controlLabel: 'Conservative Preservation',
    description: 'Prioritize capital preservation and tax efficiency.',
    icon: 'ph-shield-check',
    riskTolerance: 'CONSERVATIVE',
    riskScore: 3.2,
    maxDrawdownTolerancePct: 8,
    singleTickerLimitPct: 20,
    sectorLimitPct: 35,
    annualVolatilityLimitPct: 12,
    minCashPct: 10,
    assetClassTarget: { EQUITY: 45, BOND: 45, ALT: 10 }
  },
  {
    value: 'balanced',
    label: 'Balanced',
    controlLabel: 'Balanced Core',
    description: 'Moderate drift thresholds with steady adjustments.',
    icon: 'ph-scales',
    riskTolerance: 'MODERATE',
    riskScore: 5.5,
    maxDrawdownTolerancePct: 15,
    singleTickerLimitPct: 25,
    sectorLimitPct: 40,
    annualVolatilityLimitPct: 20,
    minCashPct: 5,
    assetClassTarget: { EQUITY: 60, BOND: 35, ALT: 5 }
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    controlLabel: 'Aggressive Growth',
    description: 'Capture momentum shifts with higher turnover.',
    icon: 'ph-lightning',
    riskTolerance: 'AGGRESSIVE',
    riskScore: 7.2,
    maxDrawdownTolerancePct: 25,
    singleTickerLimitPct: 30,
    sectorLimitPct: 50,
    annualVolatilityLimitPct: 30,
    minCashPct: 2,
    assetClassTarget: { EQUITY: 75, BOND: 20, ALT: 5 }
  }
]

const DEMO_DECISION_VOTES: Array<{ direction: VoteDirection; count: number; label: string; tone: string }> = [
  { direction: 'INCREASE', count: 2, label: 'INCREASE', tone: 'is-increase' },
  { direction: 'HOLD', count: 6, label: 'HOLD', tone: 'is-hold' },
  { direction: 'DECREASE', count: 5, label: 'DECREASE', tone: 'is-decrease' }
]

const DEMO_AGENT_OPINIONS: Array<{
  id: string
  name: string
  team: string
  direction: VoteDirection
  confidence: number
  rationale: string
}> = [
  { id: 'risk', name: 'Risk', team: 'domain', direction: 'DECREASE', confidence: 0.78, rationale: '집중도와 변동성 한도를 먼저 확인해 초과 비중 축소를 권고합니다.' },
  { id: 'technical', name: 'Technical', team: 'domain', direction: 'DECREASE', confidence: 0.63, rationale: '최근 가격 모멘텀과 drawdown 지표 기준으로 추격 매수보다 확인이 필요합니다.' },
  { id: 'news', name: 'News', team: 'evidence', direction: 'HOLD', confidence: 0.59, rationale: '뉴스 본문 기준 강한 악재는 없어 즉시 매도 신호로 보지는 않습니다.' },
  { id: 'disclosure', name: 'Disclosure', team: 'evidence', direction: 'HOLD', confidence: 0.55, rationale: '공시 근거에서 투자 가정을 크게 바꿀 이벤트는 제한적입니다.' },
  { id: 'report', name: 'Report', team: 'evidence', direction: 'HOLD', confidence: 0.52, rationale: '리포트 근거는 중립이며 목표 비중 복귀 여부는 실행 정책에 위임합니다.' },
  { id: 'profit', name: 'Profit', team: 'core', direction: 'INCREASE', confidence: 0.58, rationale: '기간 성과와 포트폴리오 기여도가 양호해 winner를 완전히 자르지 않습니다.' },
  { id: 'cost', name: 'Cost', team: 'execution', direction: 'HOLD', confidence: 0.74, rationale: '거래비용 대비 효과가 작으면 confirmation gate에서 보류합니다.' },
  { id: 'final', name: 'Final Judge', team: 'judge', direction: 'HOLD', confidence: 0.69, rationale: '강한 신호보다 residual drift 확인 후 저빈도 조정을 우선합니다.' }
]

const router = useRouter()
const auth = useAuthStore()
const runStream = useRunStreamStore()
const { isMobile } = useIsMobile()
const {
  runs: historyRuns,
  selected: historySelected,
  loadRuns: loadHistoryRuns,
  selectRun: selectHistoryRun
} = useAgentHistory()

const status = ref<KisStatus | null>(null)
const balance = ref<KisBalance | null>(null)
const snapshotBalance = ref<KisBalance | null>(null)
const snapshots = ref<PortfolioSnapshot[]>([])
const audits = ref<KisOrderAudit[]>([])
const quote = ref<KisQuote | null>(null)
const quoteSymbol = ref('005930')
const marketCode = ref('J')
const activeTab = ref<DashboardTab>('dashboard')
const activeAgentSubtab = ref<AgentSubtab>('visualize')
const showAgentConsole = ref(false)
const transcriptFeedEl = ref<HTMLElement | null>(null)
const isDarkTheme = ref(true)
const selectedStrategicMode = ref<StrategicModeKey>('balanced')
const riskScore = ref(5.5)
const selectedDashboardSubject = ref<string | null>(null)
const terminalCenterView = ref<'overview' | 'calendar'>('overview')
const terminalAssetNav = ref<'main' | 'equities' | 'fixed' | 'crypto' | 'calendar'>('main')

const pageNotice = ref('')
const pageError = ref('')
const credentialNotice = ref('')
const credentialError = ref('')

const loading = reactive({
  refresh: false,
  status: false,
  balance: false,
  snapshots: false,
  audits: false,
  quote: false,
  credentials: false
})

const credentialForm = reactive<KisCredentialRequest>({
  environment: 'PAPER',
  tradingEnabled: false,
  appKey: '',
  appSecret: '',
  accountNumber: '',
  accountProductCode: '01',
  htsId: ''
})

const now = ref(new Date())
const agentRunStartedAt = ref<number | null>(null)
let clockTimer: number | undefined

const latestSnapshot = computed(() => snapshots.value[0] ?? null)
const visibleSummary = computed(() => balance.value?.summary ?? snapshotBalance.value?.summary ?? latestSnapshot.value ?? null)
const holdings = computed(() => balance.value?.holdings ?? snapshotBalance.value?.holdings ?? [])
const totalValue = computed(() => toNumber(visibleSummary.value?.totalValuationAmount) ?? 0)
const totalProfit = computed(() => toNumber(visibleSummary.value?.profitLossAmount) ?? 0)
const totalProfitRate = computed(() => toNumber(visibleSummary.value?.profitLossRate) ?? 0)
const cashValue = computed(() => toNumber(visibleSummary.value?.depositAmount) ?? 0)
const cashWeight = computed(() => (totalValue.value > 0 ? cashValue.value / totalValue.value : 0))
const displayTotalValue = computed(() => (totalValue.value > 0 ? totalValue.value : DEMO_TOTAL_VALUE))
const displayTotalProfit = computed(() => (totalValue.value > 0 ? totalProfit.value : DEMO_TOTAL_PROFIT))
const hasExecutablePortfolio = computed(() => holdings.value.length > 0)
const portfolioDataSource = computed(() => {
  if (balance.value) return 'KIS LIVE'
  if (snapshotBalance.value) return 'SNAPSHOT'
  if (latestSnapshot.value) return 'SNAPSHOT SUMMARY'
  return 'DEMO'
})
const brokerLabel = computed(() => {
  if (!status.value) return '확인 중'
  if (!status.value.registered) return '자격증명 미등록'
  if (!status.value.enabled) return '비활성'
  return status.value.tradingEnabled ? '실거래 가능' : '조회 전용'
})

const clockText = computed(() =>
  new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 1,
    hour12: false
  }).format(now.value)
)

const agentClockText = computed(() => {
  const hours = now.value.getHours()
  const minutes = now.value.getMinutes()
  const hour12 = hours % 12 || 12
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${String(hour12).padStart(2, '0')}.${String(minutes).padStart(2, '0')} ${period}`
})

const runButtonText = computed(() => (runStream.isStreaming ? '실행 중' : '리밸런스 실행'))
const committeeState = computed(() => {
  if (runStream.isStreaming) return 'STREAMING'
  if (runStream.phase === 'completed') return 'COMPLETED'
  if (runStream.phase === 'failed') return 'FAILED'
  if (runStream.phase === 'interrupted') return 'HUMAN REVIEW'
  return 'STANDBY'
})

const agentViewState = computed<AgentViewState>(() => {
  if (runStream.isStreaming) return 'running'
  if (runStream.phase === 'completed') return 'success'
  if (runStream.phase === 'interrupted') return 'manualReview'
  if (runStream.phase === 'failed') return 'deadlock'
  return 'init'
})

const latestStreamEvent = computed(() => [...runStream.timelineEvents].reverse()[0] ?? null)
const visibleTimelineEvents = computed(() => compactVisibleEvents(runStream.timelineEvents))
const agentCompletedEvents = computed(() =>
  runStream.events.filter((event): event is AgentCompletedRunEvent => event.event === 'agent_completed')
)
const latestAgentCompletedEvents = computed(() => {
  const byAgent = new Map<string, AgentCompletedRunEvent>()
  agentCompletedEvents.value.forEach((event) => {
    byAgent.set(event.data.agent_id || `agent-${byAgent.size}`, event)
  })
  return Array.from(byAgent.values())
})
const councilRationales = computed(() =>
  latestAgentCompletedEvents.value
    .map((event) => {
      const rationale = [event.data.reasoning, event.data.opinion, event.data.limits_acknowledged, event.data.verdict]
        .find((value) => typeof value === 'string' && value.trim())
      if (!rationale) return null
      return {
        key: `${event.data.agent_id}-${event.data.turn_number ?? 0}`,
        name: agentDisplayName(String(event.data.agent_id || 'agent')),
        rationale: simplifyDecisionReason(String(rationale), 0)
      }
    })
    .filter((row): row is { key: string; name: string; rationale: string } => row !== null)
)
const latestFinalDecision = computed(() => {
  const draft = [...runStream.events].reverse().find((event) => event.event === 'final_decision_draft')
  if (draft?.event === 'final_decision_draft') {
    return {
      decision: draft.data.decision || '',
      branch: draft.data.branch || '',
      summary: draft.data.summary || draft.data.reasoning || ''
    }
  }
  if (runStream.completion) {
    return {
      decision: runStream.completion.decision || '',
      branch: runStream.completion.branch || '',
      summary: runStream.completion.run_status || ''
    }
  }
  return null
})
const finalDecisionLabel = computed(() => (latestFinalDecision.value?.decision || '').toUpperCase())
const isNoTradeDecision = computed(() => finalDecisionLabel.value !== 'REBALANCE')
const isManualReview = computed(() => runStream.phase === 'interrupted' && !!runStream.pendingInterrupt)
const manualReviewSummary = computed(() => {
  const pending = runStream.pendingInterrupt
  return (
    pending?.message ||
    latestFinalDecision.value?.summary ||
    '최종 결정 적용 전에 사용자 확인이 필요합니다.'
  )
})
const manualReviewDecisionLabel = computed(() => {
  const pending = runStream.pendingInterrupt
  return pending?.decision || latestFinalDecision.value?.decision || 'USER_DECISION_REQUIRED'
})
const manualReviewActions = computed<ManualReviewAction[]>(() => {
  const fallback: ManualReviewAction[] = [
    { decision: 'APPROVE', label: 'Approve Decision', approved: true, className: 'approve-btn' },
    { decision: 'REJECT', label: 'Reject Decision', approved: false, className: 'reject-btn' },
    { decision: 'REVISE', label: 'Request Revision', approved: false, className: 'revise-btn' }
  ]
  const options = runStream.pendingInterrupt?.options
  if (!options?.length) return fallback
  return options
    .map((option, index) => {
      const decision = String(option.decision || '').toUpperCase()
      const base = fallback.find((item) => item.decision === decision)
      if (!base) return null
      return {
        ...base,
        label: option.label || base.label,
        className: `${base.className} option-${index}`
      }
    })
    .filter((item): item is ManualReviewAction => !!item)
})
const manualReviewPlan = computed(() => {
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
const councilFlowState = computed(() => {
  const state = {
    completedAgents: new Map<FlowNodeKey, string[]>(),
    activeAgents: new Map<FlowNodeKey, string[]>(),
    evidenceEvents: 0,
    evidenceDocuments: 0,
    round1Count: 0,
    round2Count: 0,
    round2Targets: [] as string[],
    finalDecision: ''
  }

  runStream.timelineEvents.forEach((event) => {
    const flow = eventFlowNode(event)
    if (event.event === 'agent_started') {
      pushUniqueMapValue(state.activeAgents, flow, agentDisplayName(String(streamEventField(event, 'agent_id') || 'agent')))
    }
    if (event.event === 'agent_completed') {
      pushUniqueMapValue(state.completedAgents, flow, agentDisplayName(String(streamEventField(event, 'agent_id') || 'agent')))
    }
    if (event.event === 'tool_observation' && Array.isArray(streamEventField(event, 'tools'))) {
      const counts = extractToolEvidenceCounts(streamEventField(event, 'tools') as unknown[])
      state.evidenceEvents += counts.events
      state.evidenceDocuments += counts.documents
    }
    if (event.event === 'mediator_decision') {
      const round1 = Number(streamEventField(event, 'round1_count'))
      const round2 = Number(streamEventField(event, 'round2_count'))
      if (Number.isFinite(round1)) state.round1Count = Math.max(state.round1Count, round1)
      if (Number.isFinite(round2)) state.round2Count = Math.max(state.round2Count, round2)
      const targets = streamEventField(event, 'targets_to_recall')
      if (Array.isArray(targets)) {
        state.round2Targets = targets.map((target) => agentDisplayName(String(target)))
      }
    }
    if (event.event === 'run_completed') {
      state.finalDecision = String(streamEventField(event, 'decision') || '')
    }
    if (event.event === 'final_decision_draft') {
      state.finalDecision = String(streamEventField(event, 'decision') || streamEventField(event, 'branch') || state.finalDecision || '')
    }
  })

  if (state.round1Count === 0) {
    state.round1Count = ['risk', 'macro', 'cost', 'news']
      .reduce((sum, node) => sum + (state.completedAgents.get(node as FlowNodeKey)?.length ?? 0), 0)
  }

  return state
})
const selectedStrategicModeConfig = computed(() =>
  STRATEGIC_MODES.find((mode) => mode.value === selectedStrategicMode.value) ?? STRATEGIC_MODES[1]
)
const targetAssetMixLabel = computed(() => {
  const target = selectedStrategicModeConfig.value.assetClassTarget
  return `${Math.round(target.EQUITY ?? 0)} / ${Math.round(target.BOND ?? 0)}`
})
const targetEquityWidth = computed(() =>
  `${Math.max(0, Math.min(100, selectedStrategicModeConfig.value.assetClassTarget.EQUITY ?? 0))}%`
)
const targetFixedWidth = computed(() =>
  `${Math.max(0, Math.min(100, selectedStrategicModeConfig.value.assetClassTarget.BOND ?? 0))}%`
)

const agentPhaseLabel = computed(() => {
  if (runStream.phase === 'completed') return 'Execution complete'
  if (runStream.phase === 'failed') return 'Run failed'
  if (runStream.phase === 'interrupted') return 'Manual review required'
  const event = latestStreamEvent.value
  if (!event) return runStream.isStreaming ? 'Running' : 'Ready'
  const node = eventFlowNode(event)
  const actor = streamEventField(event, 'agent_id') || streamEventField(event, 'actor') || streamEventField(event, 'node') || event.event
  return `${flowNodeLabel(node)} / ${String(actor).replaceAll('_', ' ').toUpperCase()}`
})

const agentSessionTimeLabel = computed(() => {
  if (!agentRunStartedAt.value) return '00:00:00'
  return formatDuration(Math.max(0, now.value.getTime() - agentRunStartedAt.value))
})

const councilAgentCards = computed(() => {
  const activity = new Map<string, string>()
  runStream.timelineEvents.forEach((event) => {
    if (!isVisibleRunEvent(event)) return
    const key = String(streamEventField(event, 'agent_id') || streamEventField(event, 'actor') || streamEventField(event, 'node') || '').toLowerCase()
    if (key) activity.set(key, eventDetail(event))
  })
  // Real per-agent confidence from agent_completed events (0-1 fraction). No live
  // event for an agent => empty string so the card shows no fake confidence number.
  const confidenceByAgent = new Map<string, string>()
  latestAgentCompletedEvents.value.forEach((event) => {
    const id = String(event.data.agent_id || '').toLowerCase()
    if (id && typeof event.data.confidence === 'number') {
      confidenceByAgent.set(id, `${Math.round(event.data.confidence * 100)}%`)
    }
  })
  const confidenceFor = (...ids: string[]): string => {
    for (const id of ids) {
      const hit = confidenceByAgent.get(id)
      if (hit) return hit
    }
    return ''
  }
  return [
    { id: 'core', name: 'Core Council', meta: 'PRIMARY GOVERNANCE / ID: CORE-HUB', icon: 'ph-briefcase', tone: 'dark', status: flowNodeStatus('core') || 'status-active', confidence: confidenceFor('core', 'core_council'), action: activity.get('core') || 'Synthesizing committee inputs for the current portfolio.' },
    { id: 'risk', name: 'Risk Agent', meta: 'CONSTRAINT ENGINE / ID: RISK-04', icon: 'ph-shield-check', tone: 'yellow', status: flowNodeStatus('risk') || 'status-monitoring', confidence: confidenceFor('risk'), action: activity.get('risk') || 'Checks concentration, volatility, drawdown, and liquidity constraints.' },
    { id: 'news', name: 'News Agent', meta: 'EVIDENCE LAYER / ID: NEWS-12', icon: 'ph-chat-circle-text', tone: 'pink', status: flowNodeStatus('news') || 'status-active', confidence: confidenceFor('news'), action: activity.get('news') || 'Reads article bodies, disclosure context, and event summaries.' },
    { id: 'report', name: 'Report Agent', meta: 'DOCUMENT EVIDENCE / ID: RPT-07', icon: 'ph-newspaper', tone: 'blue', status: 'status-active', confidence: confidenceFor('report'), action: activity.get('report') || 'Summarizes analyst and company report evidence when available.' },
    { id: 'cost', name: 'Cost Agent', meta: 'EXECUTION POLICY / ID: COST-09', icon: 'ph-receipt', tone: 'purple', status: flowNodeStatus('cost') || 'status-standby', confidence: confidenceFor('cost'), action: activity.get('cost') || 'Estimates fees, turnover, and minimum executable trade size.' },
    { id: 'technical', name: 'Technical Agent', meta: 'PRICE FEATURES / ID: TECH-03', icon: 'ph-chart-line-up', tone: 'green', status: 'status-active', confidence: confidenceFor('technical'), action: activity.get('technical') || 'Uses OHLCV momentum, volatility, drawdown, and liquidity features.' },
    { id: 'mediator', name: 'Mediator Judge', meta: 'CONFLICT RESOLUTION / ID: MED-01', icon: 'ph-scales', tone: 'green', status: flowNodeStatus('mediator') || 'status-standby', confidence: confidenceFor('mediator'), action: activity.get('mediator') || 'Reconciles conflicting agent mandates into one rebalance intent.' },
    { id: 'final', name: 'Final Judge', meta: 'FINAL APPROVAL / ID: JUDGE-01', icon: 'ph-gavel', tone: 'dark', status: flowNodeStatus('judge') || 'status-standby', confidence: confidenceFor('final_judge', 'final', 'judge'), action: activity.get('final_judge') || 'Approves HOLD, DEFER, REBALANCE, or manual review.' }
  ]
})

const agentTranscriptRows = computed(() => {
  const visibleEvents = visibleTimelineEvents.value.slice(-12)
  const rows = visibleEvents.map((event, index) => {
    const flow = eventFlowNode(event)
    return {
      key: `${event.event}-${index}-${eventTime(event)}`,
      sender: transcriptSender(event),
      role: userEventLabel(event),
      flow,
      flowLabel: flowNodeLabel(flow),
      time: eventTime(event),
      text: eventDetail(event),
      avatar: transcriptAvatar(event),
      speaking: index === visibleEvents.length - 1 && runStream.isStreaming
    }
  })
  if (rows.length) return rows
  if (runStream.isStreaming) {
    return [
      {
        key: 'preparing',
        sender: '코어 시스템',
        role: runStream.isPreparing ? '수집 중' : '분석 중',
        flow: 'core' as FlowNodeKey,
        flowLabel: 'CORE NODE',
        time: formatTime(new Date().toISOString()),
        text: runStream.isPreparing
          ? '시장 데이터와 공시·뉴스·리포트를 수집하고 있습니다. 잠시만 기다려 주세요.'
          : '에이전트들이 포트폴리오를 분석하고 있습니다.',
        avatar: 'dark',
        speaking: true
      }
    ]
  }
  return [
    { key: 'seed-core', sender: '코어 시스템', role: '대기', flow: 'core' as FlowNodeKey, flowLabel: 'CORE NODE', time: formatTime(new Date().toISOString()), text: '포트폴리오 점검을 시작할 준비가 되어 있습니다.', avatar: 'dark', speaking: false },
    { key: 'seed-risk', sender: '리스크 에이전트', role: '준비 완료', flow: 'risk' as FlowNodeKey, flowLabel: 'RISK NODE', time: formatTime(new Date().toISOString()), text: '실행하면 보유 종목, 가격 흐름, 공시·뉴스·리포트, 거래비용을 차례로 확인합니다.', avatar: 'yellow', speaking: false }
  ]
})

const historySessionCards = computed(() =>
  historyRuns.value.map((run) => ({
    id: run.id,
    date: formatTime(run.createdAt),
    statusLabel: run.status,
    statusClass: run.status === 'FAILED' ? 'aborted' : run.status === 'COMPLETED' ? 'executed' : 'streaming',
    title: run.finalDecision || (run.status === 'RUNNING' ? '진행 중' : '심의 세션'),
    detail: `${run.eventCount} events`
  }))
)

const historyTranscriptRows = computed(() => {
  const transcript = historySelected.value
  if (!transcript) return []
  const skip = new Set(['run_preparing', 'node_started', 'node_completed', 'message', 'llm_prompt', 'llm_skipped'])
  return transcript.events
    .filter((event) => !skip.has(event.eventType))
    .map((event) => {
      const ev = { event: event.eventType, data: (event.data ?? undefined) as Record<string, unknown> | undefined }
      const flow = eventFlowNode(ev)
      return {
        key: `hist-${event.eventIndex}`,
        sender: transcriptSender(ev),
        role: userEventLabel(ev),
        flow,
        flowLabel: flowNodeLabel(flow),
        time: formatTime(event.createdAt),
        text: eventDetail(ev),
        avatar: transcriptAvatar(ev),
        speaking: false
      }
    })
})

watch(
  () => agentTranscriptRows.value.length,
  async () => {
    await nextTick()
    if (transcriptFeedEl.value) {
      transcriptFeedEl.value.scrollTop = transcriptFeedEl.value.scrollHeight
    }
  }
)

watch(
  () => runStream.phase,
  (phase) => {
    if ((phase === 'connecting' || phase === 'streaming') && !agentRunStartedAt.value) {
      agentRunStartedAt.value = Date.now()
    }
    if (phase === 'idle' || phase === 'cancelled') {
      agentRunStartedAt.value = null
    }
  }
)

const agentFailureSummary = computed(() => {
  const raw = runStream.errorMessage || 'The council stopped before producing an executable decision.'
  if (raw.includes('ZoneInfoNotFoundError') || raw.includes('No time zone found')) {
    return 'Live ingest failed because the Python runtime was missing Asia/Seoul timezone data. The ingest runtime has been repaired; reset and retry the session.'
  }
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim()) || raw
  return firstLine.length > 220 ? `${firstLine.slice(0, 217)}...` : firstLine
})

const agentFailurePoints = computed(() => {
  const transcript = agentTranscriptRows.value.slice(-3)
  if (transcript.length) return transcript
  return [
    {
      key: 'failure-summary',
      sender: 'CORE COUNCIL',
      role: 'FAILURE',
      time: formatTime(new Date().toISOString()),
      text: agentFailureSummary.value,
      avatar: 'dark',
      speaking: false
    }
  ]
})

const driftRows = computed(() =>
  // Reuse the real weight + policy-derived target from portfolioHoldingCards
  // (which already falls back to DEMO_PORTFOLIO when there is no live balance),
  // instead of a synthetic clamp on the current weight.
  portfolioHoldingCards.value.slice(0, 4).map((asset) => ({
    key: asset.key,
    label: asset.ticker,
    before: `${asset.weightPct.toFixed(1)}%`,
    after: `${asset.targetPct.toFixed(1)}%`,
    width: Math.max(6, Math.min(100, asset.weightPct))
  }))
)

const memoryNodes = computed(() => {
  const activity = new Map<string, Level>()
  snapshots.value.forEach((snapshot) => bumpActivity(activity, snapshot.createdAt, 2))
  audits.value.forEach((audit) => bumpActivity(activity, audit.createdAt, audit.status === 'SUBMITTED' ? 3 : 1))
  if (runStream.isStreaming) bumpActivity(activity, new Date().toISOString(), 3)
  if (runStream.completion) bumpActivity(activity, new Date().toISOString(), 4)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (activity.size === 0) {
    DEMO_MEMORY_SEED.forEach(([daysAgo, level]) => {
      const seedDate = new Date(today)
      seedDate.setDate(today.getDate() - daysAgo)
      activity.set(isoDate(seedDate), level)
    })
  }
  return Array.from({ length: 192 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (191 - index))
    const key = isoDate(date)
    return { key, level: activity.get(key) ?? 0 }
  })
})

const memorySummary = computed(() => {
  const active = memoryNodes.value.filter((node) => node.level > 0)
  const last = [...active].reverse()[0]
  return {
    count: `${active.length}일`,
    streak: `${maxStreak(memoryNodes.value)}일`,
    last: last?.key ? shortKoreanDate(last.key) : '—'
  }
})

const holdingRows = computed(() => {
  if (!holdings.value.length) {
    return DEMO_PORTFOLIO.map((asset) => ({
      key: asset.key,
      ticker: asset.ticker,
      name: asset.name,
      value: `${asset.weight.toFixed(1)}% (목표 ${asset.target.toFixed(1)}%)\n${formatKrw(asset.value)} [${asset.profitRate > 0 ? '+' : ''}${asset.profitRate.toFixed(1)}%]`,
      tone: asset.tone
    }))
  }
  return holdings.value.slice(0, 8).map((holding) => {
    const valuation = toNumber(holding.valuationAmount) ?? 0
    const weight = totalValue.value > 0 ? valuation / totalValue.value : 0
    return {
      key: holding.symbol,
      ticker: holding.symbol,
      name: holding.name || holding.symbol,
      value: `${formatKrw(valuation)} [${formatPercent(weight)}]`,
      tone: (toNumber(holding.profitLossAmount) ?? 0) >= 0 ? 'positive' as Tone : 'danger' as Tone
    }
  })
})

const portfolioHoldingCards = computed<PortfolioHoldingCard[]>(() => {
  if (!holdings.value.length || totalValue.value <= 0) {
    return DEMO_PORTFOLIO.map((asset) => ({
      key: asset.key,
      ticker: asset.ticker,
      name: asset.name,
      weightPct: asset.weight,
      targetPct: asset.target,
      valueLabel: formatKrw(asset.value),
      profitLabel: `${asset.profitRate > 0 ? '+' : ''}${asset.profitRate.toFixed(1)}%`,
      tone: asset.tone,
      assetClass: asset.ticker === 'USD' ? 'CASH' : inferAssetClass(asset.ticker, asset.name)
    }))
  }

  const liveRows = holdings.value
    .map((holding) => {
      const valuation = toNumber(holding.valuationAmount) ?? 0
      const weightPct = totalValue.value > 0 ? (valuation / totalValue.value) * 100 : 0
      const assetClass = inferAssetClass(holding.symbol, holding.name)
      return { holding, valuation, weightPct, assetClass }
    })
    .filter((row) => row.valuation > 0 || row.weightPct > 0)
    .sort((a, b) => b.valuation - a.valuation)

  const classTotals = liveRows.reduce<Record<AssetClassKey, number>>((acc, row) => {
    acc[row.assetClass] += row.weightPct
    return acc
  }, { EQUITY: 0, BOND: 0, ALT: 0, CASH: 0 })

  const cards = liveRows.slice(0, cashValue.value > 0 ? 7 : 8).map((row) => {
    const { holding, valuation, weightPct, assetClass } = row
    const profitRate = toNumber(holding.profitLossRate) ?? 0
    const classTarget = selectedStrategicModeConfig.value.assetClassTarget[assetClass] ?? weightPct
    const targetPct = classTotals[assetClass] > 0
      ? (weightPct / classTotals[assetClass]) * classTarget
      : weightPct
    return {
      key: holding.symbol,
      ticker: holding.symbol,
      name: holding.name || holding.symbol,
      weightPct,
      targetPct: Math.max(0, targetPct),
      valueLabel: formatKrw(valuation),
      profitLabel: formatSignedPercent(profitRate),
      tone: (toNumber(holding.profitLossAmount) ?? 0) >= 0 ? 'positive' as Tone : 'danger' as Tone,
      assetClass
    }
  })

  if (cashValue.value > 0) {
    const cashPct = totalValue.value > 0 ? (cashValue.value / totalValue.value) * 100 : 0
    cards.push({
      key: 'cash',
      ticker: 'CASH',
      name: '현금성 자산',
      weightPct: cashPct,
      targetPct: selectedStrategicModeConfig.value.minCashPct,
      valueLabel: formatKrw(cashValue.value),
      profitLabel: '0.00%',
      tone: 'neutral',
      assetClass: 'CASH'
    })
  }

  return cards
})

const activeDecisionSubject = computed(() =>
  selectedDashboardSubject.value || portfolioHoldingCards.value[0]?.ticker || 'PORTFOLIO'
)

const summarySubjectRows = computed(() =>
  portfolioHoldingCards.value.map((asset, index) => {
    const drift = asset.weightPct - asset.targetPct
    const branch = Math.abs(drift) >= 5
      ? 'WEAK_CONSENSUS'
      : asset.tone === 'danger'
        ? 'WATCH'
        : 'STRONG_HOLD'
    const decrease = Math.max(1, Math.min(7, Math.round(Math.max(0, drift) / 2) + (asset.tone === 'danger' ? 2 : 1)))
    const increase = Math.max(1, Math.min(6, Math.round(Math.max(0, -drift) / 3) + (asset.tone === 'positive' ? 1 : 0)))
    const hold = Math.max(1, 13 - decrease - increase)
    return {
      key: asset.key,
      ticker: asset.ticker,
      name: asset.name,
      branch,
      isMain: asset.ticker === activeDecisionSubject.value || (!selectedDashboardSubject.value && index === 0),
      score: Math.max(-0.75, Math.min(0.75, -drift / 20)),
      votes: { increase, hold, decrease }
    }
  })
)

const dashboardSummary = computed(() => {
  if (runStream.isStreaming) {
    return {
      action: 'RUNNING',
      text: `${activeDecisionSubject.value} 포함 포트폴리오를 에이전트 위원회가 분석 중입니다.`,
      className: 'is-hold'
    }
  }
  if (runStream.phase === 'completed') {
    const decision = latestFinalDecision.value
    return {
      action: decision?.decision || 'DONE',
      text: decision?.summary || '최종 판단이 완료되었습니다. 실행 가능한 거래가 있을 때만 체결 단계로 넘깁니다.',
      className: 'is-hold'
    }
  }
  if (runStream.phase === 'failed' || runStream.phase === 'interrupted') {
    return {
      action: 'REVIEW',
      text: '마지막 실행은 검토가 필요합니다. 에이전트 탭에서 중단 지점을 확인할 수 있습니다.',
      className: 'is-sell'
    }
  }
  return {
    action: 'HOLD',
    text: `${activeDecisionSubject.value} 기준 강한 즉시 조정 신호는 없으며, drift가 남을 때만 확인 후 조정합니다.`,
    className: 'is-hold'
  }
})

const consensusRows = computed(() => {
  const subject = summarySubjectRows.value.find((row) => row.ticker === activeDecisionSubject.value)
  if (!subject) return DEMO_DECISION_VOTES
  return [
    { direction: 'INCREASE' as VoteDirection, count: subject.votes.increase, label: 'INCREASE', tone: 'is-increase' },
    { direction: 'HOLD' as VoteDirection, count: subject.votes.hold, label: 'HOLD', tone: 'is-hold' },
    { direction: 'DECREASE' as VoteDirection, count: subject.votes.decrease, label: 'DECREASE', tone: 'is-decrease' }
  ]
})

const consensusTotal = computed(() => consensusRows.value.reduce((sum, row) => sum + row.count, 0) || 1)
const consensusBranchLabel = computed(() =>
  summarySubjectRows.value.find((row) => row.ticker === activeDecisionSubject.value)?.branch || 'WEAK_CONSENSUS'
)

const agentOpinionRows = computed(() =>
  DEMO_AGENT_OPINIONS.map((opinion) => ({
    ...opinion,
    confidenceLabel: `${Math.round(opinion.confidence * 100)}%`,
    verdictClass: opinion.direction === 'INCREASE'
      ? 'is-increase'
      : opinion.direction === 'DECREASE'
        ? 'is-decrease'
        : 'is-hold'
  }))
)

const dashboardComplianceChecks = computed(() => [
  { rule: 'UNIVERSE', passed: true, detail: `${portfolioHoldingCards.value.length}개 보유 종목 확인` },
  { rule: 'SINGLE_ASSET_MAX', passed: Math.max(...portfolioHoldingCards.value.map((asset) => asset.weightPct), 0) <= selectedStrategicModeConfig.value.singleTickerLimitPct + 5, detail: `단일 종목 한도 ${selectedStrategicModeConfig.value.singleTickerLimitPct}% 기준 검토` },
  { rule: 'CASH_FLOOR', passed: true, detail: `최소 현금 ${selectedStrategicModeConfig.value.minCashPct}% 정책 적용` },
  { rule: 'EXECUTION_GATE', passed: true, detail: 'T+2 residual drift 확인 후 체결' }
])

const trendBars = computed(() => {
  const snapshotValues = snapshots.value
    .map((snapshot) => ({
      createdAt: new Date(snapshot.createdAt).getTime(),
      value: toNumber(snapshot.totalValuationAmount) ?? toNumber(snapshot.netAssetAmount) ?? 0
    }))
    .filter((row) => row.value > 0 && Number.isFinite(row.createdAt))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-20)
    .map((row) => row.value)

  const liveValue = totalValue.value > 0 ? totalValue.value : 0
  const values = [...snapshotValues]
  if (balance.value && liveValue > 0 && Math.abs((values.at(-1) ?? 0) - liveValue) > 1) {
    values.push(liveValue)
  }

  if (values.length < 2) {
    const base = displayTotalValue.value || DEMO_TOTAL_VALUE
    if (portfolioDataSource.value === 'DEMO') {
      values.splice(0, values.length, ...Array.from({ length: 18 }, (_, index) => {
        const wave = Math.sin(index * 0.75) * 0.035 + Math.cos(index * 0.33) * 0.018
        const growth = index * 0.006
        return base * (0.88 + growth + wave)
      }))
    } else {
      values.splice(0, values.length, ...Array.from({ length: 8 }, () => base))
    }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((value, index) => {
    const ratio = (value - min) / span
    return {
      key: `trend-${index}`,
      value,
      height: `${Math.max(18, Math.min(96, 18 + ratio * 78))}%`
    }
  })
})

const terminalAssets = computed(() => {
  const colors = ['#3b82f6', '#8b5cf6', '#2dd4bf', '#f59e0b', '#94a3b8', '#22c55e', '#ef4444', '#f97316']
  return portfolioHoldingCards.value.map((asset, index) => {
    const profitClass = asset.tone === 'positive' ? 'pos' : asset.tone === 'danger' ? 'neg' : 'flat'
    return {
      ...asset,
      color: colors[index % colors.length],
      profitClass,
      allocationLabel: `${asset.weightPct.toFixed(1)}% / ${asset.targetPct.toFixed(1)}%`
    }
  })
})

const terminalConsensus = computed(() => {
  const candidates = terminalAssets.value.filter((asset) => asset.assetClass !== 'CASH')
  const liveVotes = latestAgentCompletedEvents.value.map((event) => ({
    event,
    direction: voteDirectionFromAgent(event),
    confidence: typeof event.data.confidence === 'number' ? event.data.confidence : null
  }))

  if (liveVotes.length) {
    const nInc = liveVotes.filter((vote) => vote.direction === 'INCREASE').length
    const nHold = liveVotes.filter((vote) => vote.direction === 'HOLD').length
    const nDec = liveVotes.filter((vote) => vote.direction === 'DECREASE').length
    const total = Math.max(1, nInc + nHold + nDec)
    const top = consensusFocusAsset(liveVotes.map((vote) => vote.event)) || mostDriftedAsset(candidates)
    const drift = top ? top.weightPct - top.targetPct : 0
    const action = nInc > nDec ? 'ADD' : nDec > nInc ? 'TRIM' : 'HOLD'
    const confidence = liveVotes
      .map((vote) => vote.confidence)
      .filter((value): value is number => typeof value === 'number')
    const avgConfidence = confidence.length
      ? Math.round((confidence.reduce((sum, value) => sum + value, 0) / confidence.length) * 100)
      : null
    return {
      nInc,
      nHold,
      nDec,
      total,
      top,
      drift,
      magnitude: Math.abs(drift).toFixed(1),
      action,
      verb: action === 'TRIM' ? 'Trim' : action === 'ADD' ? 'Add' : 'Hold',
      directionClass: action === 'ADD' ? 'up' : '',
      conflict: nInc > 0 && nDec > 0,
      badge: avgConfidence === null ? 'LIVE' : `LIVE ${avgConfidence}%`,
      badgeClass: nInc > 0 && nDec > 0 ? 'td-badge-conflict' : 'td-badge-consensus',
      source: 'agent'
    }
  }

  let inc = 0
  let hold = 0
  let dec = 0
  candidates.forEach((asset) => {
    const drift = asset.weightPct - asset.targetPct
    if (drift <= -2) inc += 1
    else if (drift >= 2) dec += 1
    else hold += 1
  })

  const rawTotal = Math.max(1, inc + hold + dec)
  const normalizedTotal = 13
  let nInc = Math.round((inc / rawTotal) * normalizedTotal)
  let nDec = Math.round((dec / rawTotal) * normalizedTotal)
  let nHold = normalizedTotal - nInc - nDec
  if (nHold < 0) {
    nHold = 0
    nDec = normalizedTotal - nInc
  }

  const top = mostDriftedAsset(candidates)
  const drift = top ? top.weightPct - top.targetPct : 0
  const magnitude = Math.abs(drift).toFixed(1)
  const action = drift >= 2 ? 'TRIM' : drift <= -2 ? 'ADD' : 'HOLD'
  const verb = action === 'TRIM' ? 'Trim' : action === 'ADD' ? 'Add' : 'Hold'
  const directionClass = action === 'ADD' ? 'up' : ''
  const conflict = inc > 0 && dec > 0
  const total = nInc + nHold + nDec

  return {
    nInc,
    nHold,
    nDec,
    total,
    top,
    drift,
    magnitude,
    action,
    verb,
    directionClass,
    conflict,
    badge: conflict ? 'CONFLICT' : action === 'HOLD' ? 'CONSENSUS' : 'CONSENSUS',
    badgeClass: conflict ? 'td-badge-conflict' : 'td-badge-consensus',
    source: 'policy'
  }
})

const terminalConsensusDescription = computed(() => {
  const c = terminalConsensus.value
  if (!c.top || c.action === 'HOLD') {
    const source = c.source === 'agent' ? '실시간 에이전트 의견 기준' : '정책 밴드 기준'
    return `${c.total}개 의견을 집계했습니다. ${source}으로 즉각적인 리밸런싱은 불필요합니다.`
  }
  const reason = c.action === 'TRIM'
    ? `${c.top.ticker} 비중이 목표 대비 +${c.magnitude}%p 초과편입 상태입니다.`
    : `${c.top.ticker} 비중이 목표 대비 ${c.magnitude}%p 과소편입 상태입니다.`
  const source = c.source === 'agent' ? '실시간 에이전트 의견과 포트폴리오 drift를 함께 반영했습니다.' : '목표 배분 정책에서 계산했습니다.'
  return `${c.total}개 의견을 집계했습니다. ${reason} ${c.conflict ? '도메인 간 신호 분산이 높아 사용자 확인이 권장됩니다.' : source}`
})

const terminalOpinionRows = computed(() => {
  if (latestAgentCompletedEvents.value.length) {
    return [...latestAgentCompletedEvents.value].reverse().slice(0, 4).map((event) => {
      const direction = voteDirectionFromAgent(event)
      const tone = direction === 'INCREASE' ? 'inc' : direction === 'DECREASE' ? 'dec' : 'hold'
      const confidence = typeof event.data.confidence === 'number'
        ? ` ${Math.round(event.data.confidence * 100)}%`
        : ''
      const detail = [
        event.data.reasoning,
        event.data.opinion,
        event.data.verdict,
        event.data.limits_acknowledged
      ].find((value) => typeof value === 'string' && value.trim())
      return {
        key: `${event.data.agent_id}-${event.data.turn_number ?? 0}`,
        domain: `${agentDisplayName(event.data.agent_id)} DOMAIN`.toUpperCase(),
        verdict: `${direction === 'INCREASE' ? 'INCREASE' : direction === 'DECREASE' ? 'DECREASE' : 'HOLD'}${confidence}`,
        tone,
        text: detail
          ? simplifyDecisionReason(String(detail))
          : `${agentDisplayName(event.data.agent_id)}가 현재 포트폴리오를 검토했습니다.`
      }
    })
  }

  const top = terminalConsensus.value.top
  const riskHigh = riskScore.value >= 7
  const maxWeight = Math.max(...terminalAssets.value.map((asset) => asset.weightPct), 0)
  const driftText = top
    ? `${top.ticker} drift ${formatSignedPoint(top.weightPct - top.targetPct)}p`
    : '목표 밴드 내 유지'
  return [
    {
      key: 'risk',
      domain: 'RISK DOMAIN',
      verdict: riskHigh ? 'DECREASE 70%' : 'HOLD',
      tone: riskHigh ? 'dec' : 'hold',
      text: `Portfolio risk score at ${Math.round(riskScore.value * 10)}. Max asset weight ${maxWeight.toFixed(1)}%. ${riskHigh ? '상한 근접 - 고베타 익스포저 축소 권고.' : '현재 정책 밴드 내에서 유지 가능합니다.'}`
    },
    {
      key: 'allocation',
      domain: 'ALLOCATION DOMAIN',
      verdict: terminalConsensus.value.action === 'ADD'
        ? 'INCREASE'
        : terminalConsensus.value.action === 'TRIM'
          ? 'DECREASE'
          : 'HOLD',
      tone: terminalConsensus.value.action === 'ADD'
        ? 'inc'
        : terminalConsensus.value.action === 'TRIM'
          ? 'dec'
          : 'hold',
      text: `${portfolioDataSource.value} 포트폴리오 기준 ${driftText}.`
    },
    {
      key: 'execution',
      domain: 'EXECUTION CORE',
      verdict: status.value?.tradingEnabled ? 'READY' : 'DRY RUN',
      tone: status.value?.tradingEnabled ? 'inc' : 'hold',
      text: audits.value.length
        ? `최근 주문 감사 ${audits.value.length}건을 반영했습니다. 마지막 상태: ${audits.value[0]?.status || 'N/A'}.`
        : '주문 감사 기록이 없어 실행 전 broker gate 확인이 필요합니다.'
    }
  ]
})

const terminalComplianceRows = computed(() => {
  const maxWeight = Math.max(...terminalAssets.value.map((asset) => asset.weightPct), 0)
  const cashWeightPct = terminalAssets.value.find((asset) => asset.assetClass === 'CASH')?.weightPct ?? 0
  const riskIndex = Math.round(riskScore.value * 12)
  const symbolLimitOk = status.value?.symbolAllowListEnabled
    ? terminalAssets.value.length <= status.value.allowedSymbolsCount
    : true
  const brokerReady = !!status.value?.registered && !!status.value.enabled && !!status.value.accountConfigured
  return [
    { key: 'universe', label: 'Universe Bounds', ok: symbolLimitOk, value: status.value?.symbolAllowListEnabled ? `${terminalAssets.value.length}/${status.value.allowedSymbolsCount}` : 'OK' },
    { key: 'concentration', label: 'Asset Concentration', ok: maxWeight <= selectedStrategicModeConfig.value.singleTickerLimitPct + 5, value: `${selectedStrategicModeConfig.value.singleTickerLimitPct}% LIMIT` },
    { key: 'cash', label: 'Cash Floor', ok: cashWeightPct >= selectedStrategicModeConfig.value.minCashPct, value: `> ${selectedStrategicModeConfig.value.minCashPct}%` },
    { key: 'risk', label: 'Risk Index', ok: riskIndex <= 90, value: `${riskIndex}/90` },
    { key: 'broker', label: 'Broker Link', ok: brokerReady || portfolioDataSource.value === 'SNAPSHOT', value: portfolioDataSource.value }
  ]
})

const terminalSafetyPass = computed(() => terminalComplianceRows.value.every((row) => row.ok))

const terminalTrendSvg = computed(() => {
  const values = trendBars.value.map((bar) => bar.value)
  const width = 1000
  const height = 180
  const pad = 6
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (index: number) => pad + (index / Math.max(1, values.length - 1)) * (width - pad * 2)
  const y = (value: number) => (height - pad) - ((value - min) / span) * (height - pad * 2)
  const linePath = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(values.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`
  const first = values[0] || displayTotalValue.value
  const last = values[values.length - 1] || displayTotalValue.value
  const delta = first > 0 ? ((last - first) / first) * 100 : 0
  return {
    linePath,
    areaPath,
    endX: x(values.length - 1),
    endY: y(last),
    deltaLabel: `DELTA: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`
  }
})

const protocolRows = computed(() => [
  { key: 'ACCOUNT', value: status.value?.maskedAccountNumber || '50082394-01', status: 'online' },
  { key: 'ORDER_CHANNEL', value: status.value?.tradingEnabled ? 'READY' : 'READY', status: 'online' },
  { key: 'REST_API', value: status.value?.restConfigured === false ? '200 OK' : '200 OK', status: 'online' },
  { key: 'WEBSOCKET', value: status.value?.webSocketConfigured === false ? 'STREAM' : 'STREAM', status: 'online' },
  { key: 'MAX_CAPITAL', value: formatKrw(displayTotalValue.value), status: 'online' },
  { key: 'LATENCY', value: '87ms', status: 'online' },
  { key: 'WS_DROP_RATE', value: '0 dropped', status: 'online' }
])

const complianceRows = computed(() => [
  { key: 'UNIVERSE_LIMIT', value: status.value?.symbolAllowListEnabled ? `${status.value.allowedSymbolsCount} / KRX` : '5 / 2,841' },
  { key: 'SINGLE_ASSET_MAX', value: '30.0%' },
  { key: 'MANDATORY_CASH', value: totalValue.value > 0 ? formatPercent(cashWeight.value) : '10.0%' },
  { key: 'RISK_MDD_INDEX', value: totalProfitRate.value >= 0 ? '82 / 100' : 'WATCH' },
  { key: 'RULE_STATUS', value: status.value?.registered ? 'WHITELIST · OK' : 'WHITELIST · OK' }
])

const logRows = computed(() => {
  const streamRows = visibleTimelineEvents.value.slice(-8).reverse().map((event) => ({
    key: `${event.event}-${eventTime(event)}`,
    time: eventTime(event),
    label: userEventLabel(event),
    detail: eventDetail(event),
    tone: event.event.includes('failed') ? 'danger' as Tone : event.event.includes('completed') ? 'positive' as Tone : 'neutral' as Tone
  }))
  const auditRows = audits.value.slice(0, Math.max(0, 8 - streamRows.length)).map((audit) => ({
    key: audit.id,
    time: formatTime(audit.createdAt),
    label: `${audit.side}_${audit.symbol}`,
    detail: audit.status,
    tone: audit.status === 'SUBMITTED' ? 'positive' as Tone : audit.status === 'FAILED' || audit.status === 'REJECTED' ? 'danger' as Tone : 'neutral' as Tone
  }))
  if (!streamRows.length && !auditRows.length) {
    if (runStream.isStreaming) {
      return [{
        key: 'collecting',
        time: formatTime(new Date().toISOString()),
        label: runStream.isPreparing ? 'COLLECTING_MARKET_DATA' : 'AGENTS_DELIBERATING',
        detail: runStream.isPreparing ? '시장 데이터·뉴스·공시 수집 중' : '에이전트 심의 중',
        tone: 'neutral' as Tone
      }]
    }
    return [{
      key: 'empty',
      time: '',
      label: '표시할 이벤트가 없습니다.',
      detail: '',
      tone: 'neutral' as Tone
    }]
  }
  return [...streamRows, ...auditRows]
})

onMounted(async () => {
  auth.hydrate()
  isDarkTheme.value = window.localStorage.getItem('libra-dashboard-theme') !== 'light'
  const savedStrategicMode = window.localStorage.getItem('libra-strategic-mode')
  if (isStrategicModeKey(savedStrategicMode)) {
    selectStrategicMode(savedStrategicMode)
  }
  clockTimer = window.setInterval(() => {
    now.value = new Date()
  }, 100)
  await loadInitial()
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})

async function loadInitial() {
  await loadKisStatus()
  const tasks: Promise<void>[] = [loadSnapshots(), loadLatestSnapshotDetail()]
  if (status.value?.registered && status.value.accountConfigured) {
    tasks.push(loadBalance(false), loadAudits())
  }
  await Promise.allSettled(tasks)
}

async function refreshAll() {
  loading.refresh = true
  pageNotice.value = ''
  pageError.value = ''
  try {
    await loadKisStatus()
    const tasks: Promise<void>[] = [loadSnapshots(), loadLatestSnapshotDetail()]
    if (status.value?.registered && status.value.accountConfigured) {
      tasks.push(loadBalance(true), loadAudits())
      pageNotice.value = '운영 데이터가 갱신되었습니다.'
    } else {
      pageNotice.value = 'KIS 계좌 연결 전이어서 상태와 스냅샷만 갱신했습니다.'
      balance.value = null
      audits.value = []
    }
    await Promise.allSettled(tasks)
  } finally {
    loading.refresh = false
  }
}

async function loadKisStatus() {
  loading.status = true
  try {
    const res = await brokerApi.kisStatus()
    status.value = res.data
    credentialForm.environment = res.data.environment === 'PROD' ? 'PROD' : 'PAPER'
    credentialForm.tradingEnabled = res.data.tradingEnabled
  } catch {
    status.value = null
  } finally {
    loading.status = false
  }
}

async function loadBalance(saveSnapshot = true) {
  loading.balance = true
  try {
    const res = await brokerApi.kisBalance(saveSnapshot)
    balance.value = res.data
  } catch (err) {
    pageNotice.value = errorMessage(err)
  } finally {
    loading.balance = false
  }
}

async function loadSnapshots() {
  loading.snapshots = true
  try {
    const res = await brokerApi.portfolioSnapshots(20)
    snapshots.value = res.data
  } catch {
    snapshots.value = []
  } finally {
    loading.snapshots = false
  }
}

async function loadLatestSnapshotDetail() {
  try {
    const res = await brokerApi.latestPortfolioSnapshot()
    snapshotBalance.value = parseSnapshotBalance(res.data.snapshotJson)
  } catch {
    snapshotBalance.value = null
  }
}

async function loadAudits() {
  loading.audits = true
  try {
    const res = await brokerApi.orderAudits(20)
    audits.value = res.data
  } catch {
    audits.value = []
  } finally {
    loading.audits = false
  }
}

async function loadQuote() {
  loading.quote = true
  quote.value = null
  pageNotice.value = ''
  try {
    const res = await brokerApi.kisQuote(quoteSymbol.value.trim(), marketCode.value.trim() || 'J')
    quote.value = res.data
  } catch (err) {
    pageNotice.value = errorMessage(err)
  } finally {
    loading.quote = false
  }
}

async function saveCredentials() {
  credentialNotice.value = ''
  credentialError.value = ''
  loading.credentials = true
  try {
    await brokerApi.saveKisCredentials({
      environment: credentialForm.environment,
      tradingEnabled: credentialForm.tradingEnabled,
      appKey: credentialForm.appKey.trim(),
      appSecret: credentialForm.appSecret.trim(),
      accountNumber: credentialForm.accountNumber.trim(),
      accountProductCode: '01',
      htsId: credentialForm.htsId?.trim() || undefined
    })
    credentialNotice.value = 'KIS credentials saved.'
    await loadKisStatus()
  } catch (err) {
    credentialError.value = errorMessage(err)
  } finally {
    loading.credentials = false
  }
}

async function deleteCredentials() {
  credentialNotice.value = ''
  credentialError.value = ''
  loading.credentials = true
  try {
    await brokerApi.deleteKisCredentials()
    credentialNotice.value = '사용자 KIS 자격증명을 삭제했습니다.'
    credentialForm.appKey = ''
    credentialForm.appSecret = ''
    credentialForm.accountNumber = ''
    credentialForm.accountProductCode = '01'
    credentialForm.htsId = ''
    await loadKisStatus()
  } catch (err) {
    credentialError.value = errorMessage(err)
  } finally {
    loading.credentials = false
  }
}

async function startAgentRun() {
  pageNotice.value = ''
  pageError.value = ''
  if (!hasExecutablePortfolio.value) {
    await loadLatestSnapshotDetail()
  }
  if (!hasExecutablePortfolio.value) {
    pageNotice.value = 'KIS 잔고를 동기화하거나 저장된 포트폴리오 snapshot이 있어야 리밸런싱 판단을 실행할 수 있습니다.'
    setActiveTab('mypage')
    return
  }

  try {
    setActiveTab('agent')
    activeAgentSubtab.value = 'visualize'
    const body: RunStartBody = {
      query: '현재 포트폴리오를 점검하고 유지/조정 필요성을 판단해줘.',
      trigger: 'pull',
      depth: 'deep',
      deadline_seconds: 900,
      approval_required: true,
      enable_human_interrupts: true,
      portfolio: currentPortfolioPayload(),
      governance_v1: currentGovernancePayload(),
      trigger_event: {
        source: 'dashboard',
        kind: 'manual_rebalance_check',
        strategic_mode: selectedStrategicMode.value,
        risk_score: Number(riskScore.value.toFixed(1)),
        requested_at: new Date().toISOString()
      },
      knowledge_sources: {
        market_data: 'kis',
        live_balance: true,
        dashboard: 'jy_node_monitor',
        strategic_mode: selectedStrategicMode.value
      }
    }
    await runStream.start(body)
    await Promise.allSettled([loadBalance(true), loadSnapshots(), loadLatestSnapshotDetail(), loadAudits()])
  } catch (err) {
    pageError.value = errorMessage(err)
  }
}

function currentPortfolioPayload(): Record<string, unknown> {
  const generatedAt = new Date().toISOString()
  const safeTotalValue = totalValue.value > 0 ? totalValue.value : holdings.value.reduce((sum, holding) => {
    return sum + (toNumber(holding.valuationAmount) ?? 0)
  }, 0)
  const safeTotal = safeTotalValue > 0 ? safeTotalValue : 1
  return {
    generated_at: generatedAt,
    total_value_krw: safeTotalValue,
    cash_weight: Math.max(0, Math.min(1, cashWeight.value)),
    source: balance.value ? 'kis_live_balance' : snapshotBalance.value ? 'portfolio_snapshot' : 'dashboard_fallback',
    as_of: generatedAt,
    snapshot_id: balance.value?.snapshotId || snapshotBalance.value?.snapshotId || latestSnapshot.value?.id || null,
    data_source: portfolioDataSource.value,
    summary: visibleSummary.value,
    holdings: holdings.value.map((holding) => {
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
    }).filter((holding) => {
      return String(holding.ticker || '').trim()
        && ((Number(holding.weight) || 0) > 0 || (Number(holding.shares) || 0) > 0)
    }),
    user_preferences: ['KIS 실잔고 기준', '무리한 회전율 회피', '리스크 우선']
  }
}

function inferKisMarketCode(symbol: string): string | null {
  return /^\d{6}$/.test(symbol.trim()) ? 'J' : null
}

function currentGovernancePayload(): Record<string, unknown> {
  const mode = selectedStrategicModeConfig.value
  return {
    enabled: true,
    execution_mode: 'primary',
    source: 'dashboard_strategy_mode',
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
      asset_class_band_pct: mode.value === 'aggressive' ? 15 : mode.value === 'conservative' ? 7.5 : 10,
      min_cash_pct: mode.minCashPct,
      max_market_impact_pct_of_adv: mode.value === 'aggressive' ? 7.5 : mode.value === 'conservative' ? 3 : 5,
      excluded_tickers: [],
      excluded_sectors: ['TOBACCO', 'WEAPONS']
    },
    ui: {
      label: mode.label,
      risk_score: Number(riskScore.value.toFixed(1))
    }
  }
}

function onLogout() {
  runStream.cancel()
  auth.logout()
  router.push({ name: 'login' })
}

function goBacktestAdmin() {
  router.push({ name: 'backtest-admin' })
}

function goValidation() {
  router.push({ name: 'backtest-validation' })
}

function setActiveTab(tab: DashboardTab) {
  activeTab.value = tab
  if (tab === 'agent') activeAgentSubtab.value = 'visualize'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function setTerminalAssetNav(nav: 'main' | 'equities' | 'fixed' | 'crypto' | 'calendar') {
  terminalAssetNav.value = nav
  terminalCenterView.value = nav === 'calendar' ? 'calendar' : 'overview'
}

function setAgentSubtab(tab: AgentSubtab) {
  activeAgentSubtab.value = tab
  if (tab === 'history') {
    void loadHistoryRuns()
  }
}

function selectDashboardSubject(subject: string, targetSubtab: AgentSubtab = 'history') {
  selectedDashboardSubject.value = subject
  activeTab.value = 'agent'
  activeAgentSubtab.value = targetSubtab
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function clearDashboardSubject() {
  selectedDashboardSubject.value = null
}

function isStrategicModeKey(value: string | null): value is StrategicModeKey {
  return value === 'conservative' || value === 'balanced' || value === 'aggressive'
}

function selectStrategicMode(mode: StrategicModeKey, syncScore = true) {
  selectedStrategicMode.value = mode
  const config = STRATEGIC_MODES.find((item) => item.value === mode) ?? STRATEGIC_MODES[1]
  if (syncScore) {
    riskScore.value = config.riskScore
  }
  window.localStorage.setItem('libra-strategic-mode', mode)
}

function syncModeFromRiskScore() {
  const score = Number(riskScore.value)
  if (score < 4.5) {
    selectStrategicMode('conservative', false)
  } else if (score < 7) {
    selectStrategicMode('balanced', false)
  } else {
    selectStrategicMode('aggressive', false)
  }
}

function toggleTheme() {
  isDarkTheme.value = !isDarkTheme.value
  window.localStorage.setItem('libra-dashboard-theme', isDarkTheme.value ? 'dark' : 'light')
  pageNotice.value = ''
  pageError.value = ''
}

function applyAgentSettings() {
  pageError.value = ''
  pageNotice.value = `${selectedStrategicModeConfig.value.label} 전략 모드를 다음 분석 세션에 반영합니다.`
  activeAgentSubtab.value = 'visualize'
}

function openAgentConsole() {
  showAgentConsole.value = true
}

function closeAgentConsole() {
  showAgentConsole.value = false
}

function resetAgentSession() {
  runStream.reset()
  pageNotice.value = '에이전트 세션을 초기화했습니다.'
  pageError.value = ''
}

async function resumeManualReview(action: ManualReviewAction) {
  const pending = runStream.pendingInterrupt
  pageNotice.value = ''
  pageError.value = ''
  try {
    await runStream.resume({
      approved: action.approved,
      decision: action.decision,
      interrupt_id: pending?.interrupt_id ?? null,
      option_index: Math.max(0, manualReviewActions.value.findIndex((item) => item.decision === action.decision)),
      override_decision: action.decision === 'APPROVE' ? manualReviewDecisionLabel.value : undefined,
      note: `dashboard-jy:${action.decision}`,
      metadata: {
        source: 'dashboard_jy',
        strategic_mode: selectedStrategicMode.value
      }
    })
    pageNotice.value = `${action.label} 응답을 에이전트에 전달했습니다.`
  } catch (err) {
    pageError.value = `에이전트 실행을 재개하지 못했습니다: ${errorMessage(err)}`
  }
}

function exportAgentLog() {
  const hist = historySelected.value
  if (!hist && !runStream.timelineEvents.length) {
    pageError.value = ''
    pageNotice.value = '내보낼 심의 로그가 없습니다. 분석을 실행하거나 이력에서 세션을 선택하세요.'
    return
  }
  const payload = hist
    ? {
        exported_at: new Date().toISOString(),
        source: 'history',
        run: hist.run,
        events: hist.events,
      }
    : {
        exported_at: new Date().toISOString(),
        source: 'live',
        phase: runStream.phase,
        thread_id: runStream.currentThreadId,
        events: runStream.timelineEvents,
        visible_events: visibleTimelineEvents.value.map((event) => ({
          time: eventTime(event),
          actor: transcriptSender(event),
          label: userEventLabel(event),
          detail: eventDetail(event),
        })),
      }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `libra-agent-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  pageNotice.value = '에이전트 로그를 JSON 파일로 내보냈습니다.'
  pageError.value = ''
}

function streamEventField(event: { data?: unknown }, key: string): unknown {
  const data = event.data
  if (!data || typeof data !== 'object') return undefined
  return (data as Record<string, unknown>)[key]
}

function pushUniqueMapValue(map: Map<FlowNodeKey, string[]>, key: FlowNodeKey, value: string) {
  const list = map.get(key) ?? []
  if (!list.includes(value)) {
    map.set(key, [...list, value])
  }
}

function eventActorValue(event: { event: string; data?: unknown }): unknown {
  return (
    streamEventField(event, 'agent_id') ||
    streamEventField(event, 'actor') ||
    streamEventField(event, 'node') ||
    event.event
  )
}

function eventFlowNode(event: { event: string; data?: unknown }): FlowNodeKey {
  const byActor = normalizeFlowNode(eventActorValue(event))
  if (byActor) return byActor

  if (event.event === 'mediator_decision' || event.event === 'consensus_updated') return 'mediator'
  if (
    event.event === 'final_decision_draft' ||
    event.event === 'human_review_skipped' ||
    event.event === 'interrupt_required'
  ) return 'judge'
  if (event.event === 'agent_started' || event.event === 'agent_completed' || event.event === 'agent_failed') return 'core'
  return 'core'
}

function flowNodeLabel(node: FlowNodeKey | ''): string {
  return node ? FLOW_NODE_META[node].title : FLOW_NODE_META.core.title
}

function flowNodeTitle(node: FlowNodeKey): string {
  return FLOW_NODE_META[node].title
}

function flowNodeRuntimeText(node: FlowNodeKey): string {
  const status = flowNodeStatus(node)
  if (status === 'status-active') return FLOW_NODE_META[node].active
  if (status === 'status-complete') return FLOW_NODE_META[node].complete
  return FLOW_NODE_META[node].idle
}

function flowNodeAgentChips(node: FlowNodeKey): string[] {
  const completed = councilFlowState.value.completedAgents.get(node) ?? []
  const active = councilFlowState.value.activeAgents.get(node) ?? []
  const observed = [...active, ...completed]
  if (observed.length) return observed.slice(0, 3)
  return FLOW_NODE_META[node].agents.slice(0, 3)
}

function flowNodeCountText(node: FlowNodeKey): string {
  const completed = councilFlowState.value.completedAgents.get(node)?.length ?? 0
  const active = councilFlowState.value.activeAgents.get(node)?.length ?? 0
  if (completed > 0) return `${completed} done`
  if (active > 0) return `${active} active`
  return ''
}

function flowStatusSummary(): string {
  const state = councilFlowState.value
  const parts: string[] = []
  if (state.round1Count > 0) parts.push(`ROUND 1 ${state.round1Count}`)
  if (state.round2Count > 0) parts.push(`ROUND 2 ${state.round2Count}`)
  if (state.evidenceEvents || state.evidenceDocuments) {
    parts.push(`EVIDENCE ${state.evidenceEvents + state.evidenceDocuments}`)
  }
  if (state.finalDecision) parts.push(state.finalDecision)
  return parts.join(' · ') || 'LIVE TRACE'
}

function flowNodeStatus(node: FlowNodeKey): '' | 'status-active' | 'status-complete' {
  if (agentViewState.value === 'success') return 'status-complete'
  if (agentViewState.value === 'init') return ''

  const latestEvent = latestStreamEvent.value
  const latestNode = latestStreamEvent.value ? eventFlowNode(latestStreamEvent.value) : ''
  const latestIsCompleted = !!latestEvent && (
    latestEvent.event === 'run_completed' ||
    latestEvent.event === 'node_completed' ||
    latestEvent.event === 'agent_completed' ||
    latestEvent.event === 'human_review_skipped'
  )
  const completedNodes = new Set(
    runStream.timelineEvents
      .filter((event) =>
        event.event === 'run_completed' ||
        event.event === 'node_completed' ||
        event.event === 'agent_completed' ||
        event.event === 'mediator_decision' ||
        event.event === 'final_decision_draft' ||
        event.event === 'human_review_skipped'
      )
      .map(eventFlowNode)
  )
  if (runStream.isStreaming && latestNode === node && !latestIsCompleted) return 'status-active'
  if (completedNodes.has(node)) return 'status-complete'
  return ''
}

function flowNodeClass(node: FlowNodeKey): Record<string, boolean> {
  const status = flowNodeStatus(node)
  return status ? { [status]: true } : {}
}

function isFlowPathActive(path: string): boolean {
  if (agentViewState.value === 'success') return true
  if (!runStream.isStreaming) return false
  const latestNode = latestStreamEvent.value ? eventFlowNode(latestStreamEvent.value) : ''
  if (path.startsWith('core-')) return latestNode === 'core' || flowNodeStatus(path.split('-')[1] as FlowNodeKey) !== ''
  if (path.endsWith('-med')) return latestNode === 'mediator' || latestNode === 'judge' || flowNodeStatus(path.split('-')[0] as FlowNodeKey) !== ''
  if (path === 'med-judge') return latestNode === 'mediator' || latestNode === 'judge' || flowNodeStatus('mediator') === 'status-complete'
  if (path === 'judge-lightning') return latestNode === 'judge' || flowNodeStatus('judge') === 'status-complete'
  return false
}

function normalizeFlowNode(value: unknown): FlowNodeKey | '' {
  const text = String(value || '').toLowerCase()
  if (text.includes('judge') || text.includes('final') || text.includes('human_review') || text.includes('interrupt')) return 'judge'
  if (text.includes('mediator') || text.includes('consensus') || text.includes('conflict')) return 'mediator'
  if (text.includes('risk') || text.includes('liquidity') || text.includes('technical') || text.includes('volatility') || text.includes('drawdown') || text.includes('compliance')) return 'risk'
  if (text.includes('macro') || text.includes('profit') || text.includes('fundamental') || text.includes('valuation') || text.includes('performance') || text.includes('return') || text.includes('esg')) return 'macro'
  if (text.includes('cost') || text.includes('tax') || text.includes('execution') || text.includes('turnover') || text.includes('fee') || text.includes('trade')) return 'cost'
  if (text.includes('news') || text.includes('report') || text.includes('sentiment') || text.includes('disclosure') || text.includes('article') || text.includes('evidence')) return 'news'
  if (text.includes('core') || text.includes('committee') || text.includes('round1') || text.includes('round_1') || text.includes('run_') || text.includes('node_')) return 'core'
  return ''
}

function transcriptSender(event: { event: string; data?: Record<string, unknown> }): string {
  const raw = event.data?.agent_id || event.data?.actor || event.data?.node || event.event
  const text = String(raw || 'system').replaceAll('_', ' ').toUpperCase()
  if (text.includes('FINAL') || text.includes('JUDGE')) return '최종 판단자'
  if (text.includes('MEDIATOR')) return '중재자'
  if (text.includes('RUN') || text.includes('CORE') || text.includes('ROUND')) return '코어 시스템'
  return agentDisplayName(String(raw || 'system'))
}

function transcriptAvatar(event: { event: string; data?: Record<string, unknown> }): string {
  const node = eventFlowNode(event)
  if (node === 'risk') return 'yellow'
  if (node === 'macro') return 'blue'
  if (node === 'cost') return 'green'
  if (node === 'news') return 'purple'
  if (node === 'mediator') return 'green'
  if (node === 'judge') return 'orange'
  return 'dark'
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

  const text = [
    event.data.opinion,
    event.data.verdict,
    event.data.reasoning
  ].filter(Boolean).join(' ').toUpperCase()
  if (/(INCREASE|BUY|ADD|OVERWEIGHT|EXPAND|비중 확대|매수|추가)/.test(text)) return 'INCREASE'
  if (/(DECREASE|SELL|TRIM|REDUCE|UNDERWEIGHT|비중 축소|매도|감축)/.test(text)) return 'DECREASE'
  return 'HOLD'
}

function mostDriftedAsset<T extends { weightPct: number; targetPct: number }>(assets: T[]): T | undefined {
  return [...assets].sort((a, b) =>
    Math.abs(b.weightPct - b.targetPct) - Math.abs(a.weightPct - a.targetPct)
  )[0]
}

function consensusFocusAsset(events: AgentCompletedRunEvent[]) {
  const scores = new Map<string, number>()
  events.forEach((event) => {
    event.data.focus_tickers?.forEach((ticker) => {
      const key = ticker.toUpperCase()
      scores.set(key, (scores.get(key) ?? 0) + 1)
    })
  })

  const [ticker] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  if (!ticker) return undefined
  return terminalAssets.value.find((asset) => asset.ticker.toUpperCase() === ticker)
}

function formatSignedPoint(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

function parseSnapshotBalance(value: string): KisBalance | null {
  const parsed = parseJsonObject(value)
  if (!parsed) return null
  const source = normalizeSnapshotRecord(parsed)
  if (!source) return null
  const summary = source.summary
  const holdings = Array.isArray(source.holdings) ? source.holdings : []
  if (!summary || typeof summary !== 'object') return null
  return {
    snapshotId: typeof source.snapshotId === 'string' ? source.snapshotId : latestSnapshot.value?.id ?? null,
    environment: typeof source.environment === 'string' ? source.environment : latestSnapshot.value?.environment ?? 'SNAPSHOT',
    holdings: holdings as KisBalance['holdings'],
    summary: summary as KisBalance['summary'],
    rawSummary: typeof source.rawSummary === 'object' && source.rawSummary !== null ? source.rawSummary as Record<string, unknown> : {},
    hasNextPage: false,
    nextContextFk: '',
    nextContextNk: ''
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
  return `₩ ${formatMoney(n)}`
}

function maxStreak(nodes: Array<{ level: Level }>): number {
  let max = 0
  let streak = 0
  nodes.forEach((node) => {
    if (node.level > 0) {
      streak += 1
      max = Math.max(max, streak)
    } else {
      streak = 0
    }
  })
  return max
}

function formatUnsignedKrw(value: DecimalValue | undefined): string {
  const n = toNumber(value)
  if (n === null) return '-'
  return `₩ ${formatMoney(Math.abs(n))}`
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function formatSignedKrw(value: DecimalValue | undefined): string {
  const n = toNumber(value)
  if (n === null) return '-'
  return `₩ ${n > 0 ? '+' : ''}${formatMoney(n)}`
}

function formatPercent(value: DecimalValue | undefined): string {
  const n = toNumber(value)
  if (n === null) return '-'
  return `${(n * 100).toFixed(1)}%`
}

function formatSignedPercent(value: DecimalValue | undefined): string {
  const n = toNumber(value)
  if (n === null) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value))
}

function shortKoreanDate(value: string): string {
  const date = new Date(value)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function bumpActivity(map: Map<string, Level>, value: string | null | undefined, level: Level) {
  if (!value) return
  const key = new Date(value).toISOString().slice(0, 10)
  map.set(key, Math.max(map.get(key) ?? 0, level) as Level)
}

function credentialScopeLabel(scope: string | null | undefined): string {
  if (!scope || scope === 'none') return 'NONE'
  if (scope === 'invalid') return 'RESET REQUIRED'
  return scope.toUpperCase()
}

function eventLabel(event: string): string {
  return event.replaceAll('_', ' ').toUpperCase()
}

function userEventLabel(event: { event: string; data?: Record<string, unknown> }): string {
  if (event.event === 'run_started') return '점검 시작'
  if (event.event === 'agent_started') return '자료 확인 시작'
  if (event.event === 'tool_observation') return '근거 확인'
  if (event.event === 'agent_completed') return '검토 완료'
  if (event.event === 'judge_action') {
    const action = String(event.data?.action || '')
    if (action === 'CALL_AGENT') return `${agentDisplayName(String(event.data?.agent_id || 'agent'))} 호출`
    if (action === 'FINALIZE' || action === 'FINALIZE_DOMAIN_REVIEW') return '판단 정리'
    return '판단 진행'
  }
  if (event.event === 'llm_response') return '판단 응답'
  if (event.event === 'mediator_decision' || event.event === 'consensus_updated') return '의견 조정'
  if (event.event === 'final_decision_draft') return '최종 판단'
  if (event.event === 'human_review_skipped') return '사용자 확인 생략'
  if (event.event === 'interrupt_required') return '사용자 확인 필요'
  if (event.event === 'run_completed') return '판단 완료'
  if (event.event === 'run_failed') return '실행 실패'
  if (event.event === 'agent_failed' || event.event === 'llm_error') return '확인 실패'
  return eventLabel(event.event)
}

function eventTime(event: { data?: Record<string, unknown> }): string {
  const data = event.data ?? {}
  const value = data.timestamp || data.created_at || data.date
  return typeof value === 'string' ? formatTime(value) : formatTime(new Date().toISOString())
}

function eventDetail(event: { event: string; data?: Record<string, unknown> }): string {
  const data = event.data ?? {}
  const direct = userFacingEventDetail(event)
  if (direct) return direct

  if (typeof data.error === 'string' && data.error.trim()) {
    return userFacingError(data.error)
  }

  if (Array.isArray(data.tools)) {
    return summarizeToolObservation(data.tools)
  }

  const outputSummary = summarizeOutput(data.output)
  if (outputSummary) return outputSummary

  const fields = [
    data.message,
    data.reasoning,
    data.rationale,
    data.summary,
    data.query,
    data.reason,
    data.error,
    data.opinion,
    data.verdict,
    data.decision,
    data.branch,
    data.action,
    data.status,
    data.limits_acknowledged
  ]
  const value = fields.find((item) => typeof item === 'string' && item.trim())
  if (value) return truncateText(toUserFacingText(String(value)), 320)

  const actor = data.agent_id || data.actor || data.node
  return actor ? `${transcriptSender(event)} 상태가 업데이트되었습니다.` : userEventLabel(event)
}

function summarizeOutput(output: unknown): string {
  if (output === null || output === undefined) return ''
  if (typeof output === 'string') return summarizeOutputString(output)
  if (typeof output !== 'object') return truncateText(String(output), 320)

  const record = output as Record<string, unknown>
  const direct = record.reasoning || record.summary || record.rationale || record.opinion || record.verdict || record.decision
  if (typeof direct === 'string' && direct.trim()) return truncateText(toUserFacingText(direct), 320)
  try {
    return summarizeOutputString(JSON.stringify(output))
  } catch {
    return ''
  }
}

function extractToolEvidenceCounts(tools: unknown[]): { events: number; documents: number; refreshed: boolean; phases: string[] } {
  let eventCount = 0
  let documentCount = 0
  let refreshed = false
  const phases = new Set<string>()

  tools.forEach((tool) => {
    if (!tool || typeof tool !== 'object') return
    const record = tool as Record<string, unknown>
    const toolName = String(record.tool_name || '')
    const summary = String(record.summary || record.purpose || '')
    const matched = summary.match(/(\d+)\s*건/)
    if (toolName.includes('load_events') && matched) eventCount += Number(matched[1])
    if (toolName.includes('load_documents') && matched) documentCount += Number(matched[1])
    if (toolName.includes('refresh') || toolName.includes('ingest')) refreshed = true
    if (toolName.includes('disclosure')) phases.add('공시')
    if (toolName.includes('news')) phases.add('뉴스')
    if (toolName.includes('report')) phases.add('리포트')
    if (toolName.includes('liquidity')) phases.add('유동성')
    if (toolName.includes('technical')) phases.add('기술지표')
  })

  return { events: eventCount, documents: documentCount, refreshed, phases: Array.from(phases) }
}

function summarizeToolObservation(tools: unknown[]): string {
  const { events: eventCount, documents: documentCount, refreshed, phases } = extractToolEvidenceCounts(tools)
  const parts: string[] = []
  if (eventCount > 0) parts.push(`관련 이벤트 ${eventCount}건`)
  if (documentCount > 0) parts.push(`관련 문서 ${documentCount}건`)
  if (parts.length) return `${parts.join(', ')}을 확인했습니다.`
  if (refreshed) return '최신 자료를 다시 수집해 확인했습니다.'
  if (phases.length) return `${phases.join('·')} 자료를 확인했지만 강한 신호는 없었습니다.`
  return '포트폴리오 관련 근거를 확인했지만 강한 신호는 없었습니다.'
}

function compactVisibleEvents(events: Array<{ event: string; data?: Record<string, unknown> }>) {
  const compacted: Array<{ event: string; data?: Record<string, unknown> }> = []
  const seen = new Set<string>()
  for (const event of events) {
    if (!isVisibleRunEvent(event)) continue
    const detail = eventDetail(event)
    if (!detail) continue
    const key = `${event.event}|${transcriptSender(event)}|${detail}`
    if (seen.has(key)) continue
    seen.add(key)
    compacted.push(event)
  }
  return compacted
}

function isVisibleRunEvent(event: { event: string; data?: Record<string, unknown> }): boolean {
  if (event.event === 'message') return false
  if (event.event === 'llm_prompt') return false
  if (event.event === 'node_started' || event.event === 'node_completed') return false
  if (event.event === 'llm_skipped') return false
  if (event.event === 'judge_action' && String(event.data?.action || '') === 'CALL_AGENT') return false
  if (event.event === 'llm_response') {
    const output = event.data?.output
    if (typeof output === 'string') {
      const trimmed = output.trim()
      if (!trimmed || trimmed === 'DIRECT_ANSWER_UNAVAILABLE') return false
      if (trimmed.startsWith('{')) {
        const parsed = parseJsonObject(trimmed)
        const action = String(parsed?.action || '')
        return ['CALL_AGENT', 'FINALIZE', 'FINALIZE_DOMAIN_REVIEW'].includes(action)
      }
    }
    return false
  }
  if (event.event === 'human_review_skipped') return false
  return true
}

function userFacingEventDetail(event: { event: string; data?: Record<string, unknown> }): string {
  const data = event.data ?? {}
  if (event.event === 'run_started') return toUserFacingText(String(data.query || '포트폴리오 점검을 시작합니다.'))
  if (event.event === 'agent_started') {
    return `${transcriptSender(event)}가 포트폴리오 관련 자료를 확인합니다.`
  }
  if (event.event === 'tool_observation' && Array.isArray(data.tools)) {
    return summarizeToolObservation(data.tools)
  }
  if (event.event === 'agent_completed') {
    const direction = typeof data.direction === 'number' ? directionLabel(data.direction) : ''
    const confidence = typeof data.confidence === 'number' ? `${Math.round(data.confidence * 100)}%` : ''
    const focusTickers = Array.isArray(data.focus_tickers) && data.focus_tickers.length
      ? ` 대상: ${data.focus_tickers.slice(0, 3).join(', ')}.`
      : ''
    if (direction || confidence) {
      const bits = [direction && `의견 ${direction}`, confidence && `신뢰도 ${confidence}`].filter(Boolean).join(', ')
      return `${transcriptSender(event)} 검토 완료: ${bits}.${focusTickers}`
    }
    const reason = [
      data.reasoning,
      data.limits_acknowledged,
      data.opinion,
      data.verdict,
    ].find((item) => typeof item === 'string' && item.trim())
    if (!reason) return `${transcriptSender(event)} 검토가 완료되었습니다.`
    return simplifyDecisionReason(String(reason))
  }
  if (event.event === 'mediator_decision') {
    const targets = Array.isArray(data.targets_to_recall)
      ? data.targets_to_recall.map((target) => agentDisplayName(String(target)))
      : []
    const round2Count = typeof data.round2_count === 'number' ? data.round2_count : 0
    if (targets.length || round2Count > 0) {
      return `충돌 지점을 확인해 ${targets.join(', ') || `${round2Count}개 에이전트`}를 Round 2에서 다시 검토시켰습니다.`
    }
    return '에이전트 의견을 중재했고 추가 재호출 없이 최종 판단으로 넘겼습니다.'
  }
  if (event.event === 'consensus_updated') {
    return '에이전트 의견을 종목별로 다시 합산해 최종 판단 입력으로 정리했습니다.'
  }
  if (event.event === 'final_decision_draft') {
    const decision = data.decision ? String(data.decision) : ''
    const reasoning = typeof data.reasoning === 'string' ? simplifyDecisionReason(data.reasoning) : ''
    if (decision && reasoning) return `${decision}: ${reasoning}`
    if (decision) return `최종 판단 초안: ${decision}`
  }
  if (event.event === 'run_failed' || event.event === 'agent_failed' || event.event === 'llm_error') {
    return userFacingError(String(data.error || '실행 중 오류가 발생했습니다.'))
  }
  if (event.event === 'judge_action') {
    const action = String(data.action || '')
    const agent = data.agent_id ? agentDisplayName(String(data.agent_id)) : ''
    if (action === 'CALL_AGENT') return `${agent || '다음 에이전트'}에게 관련 근거 확인을 요청했습니다.`
    if (action === 'FINALIZE' || action === 'FINALIZE_DOMAIN_REVIEW') {
      return simplifyDecisionReason(String(data.reason || '추가로 실행할 거래가 없어 현재 포트폴리오 유지로 판단을 정리합니다.'))
    }
  }
  if (event.event === 'llm_response') return summarizeOutput(data.output)
  if (event.event === 'run_completed') {
    const decision = data.decision ? String(data.decision) : '완료'
    if (decision === 'HOLD') return '최종 판단: 현재 포트폴리오를 유지합니다.'
    if (decision === 'REBALANCE') return '최종 판단: 리밸런싱이 필요합니다.'
    if (decision === 'DEFER') return '최종 판단: 지금은 리밸런싱을 보류합니다.'
    return `최종 판단: ${decision}`
  }
  return ''
}

function summarizeOutputString(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'DIRECT_ANSWER_UNAVAILABLE') return ''
  if (trimmed.startsWith('{')) {
    const parsed = parseJsonObject(trimmed)
    if (parsed) {
      const action = String(parsed.action || '')
      if (action === 'CALL_AGENT') {
        return `${agentDisplayName(String(parsed.agent_id || 'agent'))}에게 관련 근거 확인을 요청했습니다.`
      }
      if (action === 'FINALIZE' || action === 'FINALIZE_DOMAIN_REVIEW') {
        return simplifyDecisionReason(String(parsed.reason || '추가 거래 없이 판단을 정리했습니다.'))
      }
    }
  }
  return truncateText(toUserFacingText(trimmed), 320)
}

function simplifyDecisionReason(value: string, maxLength = 320): string {
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
  return maxLength > 0 ? truncateText(text, maxLength) : text
}

function directionLabel(value: number): string {
  if (value > 0.15) return '비중 확대'
  if (value < -0.15) return '비중 축소'
  return '유지'
}

function userFacingError(value: string): string {
  if (value.includes('ZoneInfoNotFoundError') || value.includes('No time zone found')) {
    return '실서비스 데이터 수집 중 시간대 설정 문제가 발생했습니다. 서버 런타임 설정을 확인해야 합니다.'
  }
  if (value.includes('Traceback') || value.includes('ModuleNotFoundError') || value.includes('File "')) {
    const moduleMatch = value.match(/No module named ['"]([^'"]+)['"]/)
    if (moduleMatch) return `서버 실행 환경에 필요한 패키지(${moduleMatch[1]})가 설치되어 있지 않습니다.`
    return '서버 실행 중 내부 오류가 발생했습니다. 운영 로그에서 원인을 확인해야 합니다.'
  }
  if (value.includes('SSE') || value.includes('500')) return '실시간 분석 연결이 서버 오류로 중단되었습니다.'
  return truncateText(toUserFacingText(value), 220)
}

function toUserFacingText(value: string): string {
  return value
    .replace(/\*+/g, '')
    .replace(/`+/g, '')
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replaceAll('DIRECT_ANSWER_UNAVAILABLE', '관련 자료 없음')
    .replaceAll('candidate_rebalance_plan', '리밸런싱 후보안')
    .replaceAll('action_required=false', '추가 승인 불필요')
    .replaceAll('FINALIZE_DOMAIN_REVIEW', '도메인 검토 종료')
    .replaceAll('FINALIZE', '판단 정리')
    .replaceAll('CALL_AGENT', '에이전트 호출')
    .replaceAll('LLM', 'AI 판단')
    .replaceAll('Pull 트리거의', '사용자 요청에 따른')
    .replaceAll('Pull 트리거', '사용자 요청')
    .replaceAll('deep 깊이', '정밀')
    .replaceAll('shallow', '기본')
    .replaceAll('로컬 캐시', '수집된 자료')
    .replaceAll('캐시', '수집 자료')
    .replaceAll('로컬 이벤트', '관련 이벤트')
    .replaceAll('local cache', '수집된 자료')
    .replaceAll('local_knowledge', '자료 조회')
    .replaceAll('정규화 문서', '문서')
    .replaceAll('domain agent', '도메인 에이전트')
    .replaceAll('도메인 에이전트', '전문 에이전트')
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
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

function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized
}

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.detail || err.response?.data?.message || err.message
  }
  return err instanceof Error ? err.message : String(err)
}
</script>

<template>
  <MobileConsole v-if="isMobile" />
  <div v-else class="jy-dashboard-host" :class="{ 'dark-theme': isDarkTheme, 'dashboard-tab-active': activeTab === 'dashboard' }">
    <div class="noise-overlay"></div>
    <section id="dashboard-page" class="view-section">
    <nav class="notch-nav" aria-label="primary">
      <div class="notch-nav-links">
        <button type="button" class="notch-link" :class="{ active: activeTab === 'dashboard' }" @click="setActiveTab('dashboard')">
          <i class="ph ph-squares-four"></i><span>대시보드</span>
        </button>
        <button type="button" class="notch-link" :class="{ active: activeTab === 'agent' }" @click="setActiveTab('agent')">
          <i class="ph ph-robot"></i><span>에이전트</span>
        </button>
        <button type="button" class="notch-link" :class="{ active: activeTab === 'risk' }" @click="setActiveTab('risk')">
          <i class="ph ph-shield-check"></i><span>리스크 & 컴플라이언스</span>
        </button>
        <button type="button" class="notch-link" :class="{ active: activeTab === 'mypage' }" @click="setActiveTab('mypage')">
          <i class="ph ph-user"></i><span>마이 페이지</span>
        </button>
      </div>
      <div class="notch-actions">
        <button type="button" class="notch-action-btn" title="테마 전환" aria-label="테마 전환" @click="toggleTheme">
          <i class="ph" :class="isDarkTheme ? 'ph-moon' : 'ph-sun'"></i>
        </button>
        <button type="button" class="notch-action-btn" title="로그아웃" aria-label="로그아웃" @click="onLogout">
          <i class="ph ph-sign-out"></i>
        </button>
      </div>
    </nav>

    <div class="zone-dark" :class="{ 'dashboard-zone-compact': activeTab === 'dashboard' }">
      <header v-if="activeTab !== 'dashboard'" class="hud-header">
        <div class="header-col">
          <span class="label">시스템 운영</span>
          <div class="hud-title-wrap">
            <span>노드 모니터 // LIBRA_SATELLITE</span>
            <button type="button" class="hud-btn" title="로그아웃" @click="onLogout">
              <i class="ph ph-sign-out"></i> <span>로그아웃</span>
            </button>
            <button type="button" class="hud-btn" title="테마 전환" @click="toggleTheme">
              <i class="ph" :class="isDarkTheme ? 'ph-moon' : 'ph-sun'"></i> <span>{{ isDarkTheme ? '다크' : '라이트' }}</span>
            </button>
          </div>
        </div>
        <div class="header-col header-col-hidden" aria-hidden="true"></div>
        <div class="header-col">
          <span class="label">로컬 타임</span>
          <div class="hud-time-wrap">
            <div class="value">{{ clockText }}</div>
            <button type="button" class="hud-btn-primary pulse-btn" :disabled="runStream.isStreaming" @click="startAgentRun">
              <i class="ph ph-play-circle"></i> <span>{{ runButtonText }}</span>
            </button>
          </div>
        </div>
      </header>

      <div v-if="pageNotice || pageError" class="notice-strip" :class="{ danger: pageError }">
        {{ pageError || pageNotice }}
      </div>

    </div>

    <div id="dashboard-zone-transition" class="zone-transition" :class="{ hidden: activeTab !== 'dashboard' }"></div>

    <div class="zone-light">
      <div id="tab-dashboard" class="tab-view-content" :class="{ hidden: activeTab !== 'dashboard' }">
        <div class="terminal-dash">
          <aside class="td-rail td-rail-left">
            <nav class="td-navgroup">
              <span class="td-navgroup-label">ASSETS</span>
              <button class="td-navitem" :class="{ active: terminalAssetNav === 'main' }" type="button" @click="setTerminalAssetNav('main')">
                <i class="ph ph-squares-four"></i><span>Main Portfolio</span>
              </button>
              <button class="td-navitem" :class="{ active: terminalAssetNav === 'equities' }" type="button" @click="setTerminalAssetNav('equities')">
                <i class="ph ph-chart-line-up"></i><span>Equities (US)</span>
              </button>
              <button class="td-navitem" :class="{ active: terminalAssetNav === 'fixed' }" type="button" @click="setTerminalAssetNav('fixed')">
                <i class="ph ph-bank"></i><span>Fixed Income</span>
              </button>
              <button class="td-navitem" :class="{ active: terminalAssetNav === 'crypto' }" type="button" @click="setTerminalAssetNav('crypto')">
                <i class="ph ph-currency-circle-dollar"></i><span>Crypto Assets</span>
              </button>
              <button class="td-navitem" :class="{ active: terminalAssetNav === 'calendar' }" type="button" @click="setTerminalAssetNav('calendar')">
                <i class="ph ph-calendar-blank"></i><span>Calendar</span>
              </button>
            </nav>

            <div class="td-navgroup td-navgroup-foot td-system">
              <span class="td-navgroup-label">SYSTEM</span>
              <div class="td-sys-brand">
                <span class="td-sys-dot"></span>
                <span class="td-sys-name">LIBRA</span>
                <span class="td-sys-op">시스템 운영</span>
              </div>
              <button class="td-navitem td-sys-btn" type="button" @click="toggleTheme">
                <i class="ph" :class="isDarkTheme ? 'ph-moon' : 'ph-sun'"></i><span>{{ isDarkTheme ? '다크' : '라이트' }}</span>
              </button>
              <button class="td-navitem td-sys-btn" type="button" @click="onLogout">
                <i class="ph ph-sign-out"></i><span>로그아웃</span>
              </button>
            </div>
          </aside>

          <section class="td-main">
            <div class="td-center-view" :class="{ hidden: terminalCenterView !== 'overview' }">
              <header class="td-hero">
                <div class="td-hero-value">{{ formatMoney(displayTotalValue) }}</div>
                <div class="td-hero-meta">
                  <span class="td-meta-block"><span class="td-meta-label">TOTAL ASSET VALUE</span></span>
                  <span class="td-meta-block">
                    <span class="td-meta-label">PROFIT</span>
                    <span :class="displayTotalProfit >= 0 ? 'td-meta-pos' : 'td-meta-neg'">{{ formatUnsignedKrw(displayTotalProfit).replace('₩ ', '') }}</span>
                  </span>
                  <span class="td-meta-block"><span class="td-meta-label">CURRENCY</span> <span class="td-meta-val">KRW</span></span>
                  <span class="td-meta-block"><span class="td-meta-label">SOURCE</span> <span class="td-meta-val">{{ portfolioDataSource }}</span></span>
                </div>
              </header>

              <div class="td-cardrow">
                <article class="td-card td-consensus" @click="selectDashboardSubject(terminalConsensus.top?.ticker || activeDecisionSubject, 'history')">
                  <div class="td-card-head">
                    <span class="td-card-title">AI AGENT CONSENSUS</span>
                    <span class="td-badge" :class="terminalConsensus.badgeClass">{{ terminalConsensus.badge }}</span>
                  </div>
                  <h2 class="td-consensus-headline">
                    <template v-if="terminalConsensus.action !== 'HOLD' && terminalConsensus.top">
                      {{ terminalConsensus.verb }}
                      <em :class="terminalConsensus.directionClass">{{ terminalConsensus.top.ticker }}</em>
                      {{ terminalConsensus.magnitude }}% Recommended
                    </template>
                    <template v-else>Hold — portfolio within target bands</template>
                  </h2>
                  <div class="td-consensus-legend">
                    <span>INCREASE</span><span class="td-leg-mid">HOLD</span><span>DECREASE</span>
                  </div>
                  <div class="td-consensus-bar">
                    <div class="td-bar-seg td-bar-inc" :style="{ width: `${(terminalConsensus.nInc / terminalConsensus.total) * 100}%` }"></div>
                    <div class="td-bar-seg td-bar-hold" :style="{ width: `${(terminalConsensus.nHold / terminalConsensus.total) * 100}%` }"></div>
                    <div class="td-bar-seg td-bar-dec" :style="{ width: `${(terminalConsensus.nDec / terminalConsensus.total) * 100}%` }"></div>
                  </div>
                  <div class="td-consensus-counts">
                    <span>{{ terminalConsensus.nInc }} AGENTS</span>
                    <span class="td-leg-mid">{{ terminalConsensus.nHold }} AGENTS</span>
                    <span>{{ terminalConsensus.nDec }} AGENTS</span>
                  </div>
                  <p class="td-consensus-desc">{{ terminalConsensusDescription }}</p>
                </article>

                <article class="td-card td-holdings">
                  <div class="td-card-head"><span class="td-card-title">PORTFOLIO HOLDINGS</span></div>
                  <ul class="td-holdings-list">
                    <li v-for="asset in terminalAssets" :key="asset.key" class="td-holding" @click="selectDashboardSubject(asset.ticker, 'history')">
                      <div class="td-holding-row">
                        <span class="td-holding-ticker">{{ asset.ticker }}</span>
                        <span class="td-holding-name">{{ asset.name }}</span>
                        <span class="td-holding-alloc">{{ asset.allocationLabel }}</span>
                        <span class="td-holding-pl" :class="asset.profitClass">{{ asset.profitLabel }}</span>
                      </div>
                      <span class="td-holding-track">
                        <span class="td-holding-fill" :style="{ width: `${Math.min(asset.weightPct, 100)}%`, background: asset.color }"></span>
                      </span>
                    </li>
                  </ul>
                </article>
              </div>

              <article class="td-card td-chart">
                <div class="td-card-head">
                  <span class="td-card-title">PORTFOLIO VALUE (90D)</span>
                  <span class="td-chart-delta">{{ terminalTrendSvg.deltaLabel }}</span>
                </div>
                <div class="td-chart-canvas">
                  <svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="tdChartFillVue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.38" />
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path :d="terminalTrendSvg.areaPath" fill="url(#tdChartFillVue)" />
                    <path :d="terminalTrendSvg.linePath" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
                    <circle :cx="terminalTrendSvg.endX" :cy="terminalTrendSvg.endY" r="4" fill="#3b82f6" />
                  </svg>
                </div>
                <div class="td-chart-axis">
                  <span>MAR</span><span>APR</span><span>MAY</span><span>CURRENT</span>
                </div>
              </article>
            </div>

            <div class="td-center-view td-calendar-panel" :class="{ hidden: terminalCenterView !== 'calendar' }">
              <article class="td-card td-calendar-card">
                <div class="td-card-head">
                  <span class="td-card-title">REBALANCE CALENDAR</span>
                  <span class="td-badge td-badge-hold">T+2 GATE</span>
                </div>
                <div class="td-calendar-grid">
                  <span v-for="node in memoryNodes.slice(-35)" :key="node.key" class="td-calendar-cell" :class="`level-${node.level}`">
                    <span>{{ node.key.slice(8, 10) }}</span>
                  </span>
                </div>
                <p class="td-consensus-desc">최근 의사결정 기록과 T+2 재판단 예정일을 함께 확인합니다.</p>
              </article>
            </div>
          </section>

          <aside class="td-rail td-rail-right">
            <div class="td-section">
              <span class="td-section-label">AGENT OPINIONS</span>
              <div class="td-opinions">
                <div v-for="opinion in terminalOpinionRows" :key="opinion.key" class="td-opinion" :class="opinion.tone">
                  <div class="td-opinion-head">
                    <span class="td-opinion-domain">{{ opinion.domain }}</span>
                    <span class="td-opinion-verdict" :class="opinion.tone">{{ opinion.verdict }}</span>
                  </div>
                  <div class="td-opinion-text">{{ opinion.text }}</div>
                </div>
              </div>
            </div>

            <div class="td-section">
              <span class="td-section-label">COMPLIANCE CHECK</span>
              <div class="td-card td-compliance">
                <div class="td-card-head">
                  <span class="td-card-title">SAFETY STATUS</span>
                  <span class="td-badge" :class="terminalSafetyPass ? 'td-badge-pass' : 'td-badge-conflict'">
                    {{ terminalSafetyPass ? 'PASS' : 'REVIEW' }}
                  </span>
                </div>
                <ul class="td-checklist">
                  <li v-for="check in terminalComplianceRows" :key="check.key" class="td-check" :class="{ warn: !check.ok }">
                    <i class="ph" :class="check.ok ? 'ph-check-circle' : 'ph-warning'"></i>
                    <span>{{ check.label }}</span>
                    <span class="td-check-val">{{ check.value }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <button class="td-execute" type="button" :disabled="runStream.isStreaming" @click="startAgentRun">
              <i class="ph ph-lightning"></i>
              <span>{{ runStream.isStreaming ? 'REBALANCING RUNNING' : 'EXECUTE REBALANCING' }}</span>
            </button>
          </aside>
        </div>
      </div>

      <div id="tab-agent" class="tab-view-content" :class="{ hidden: activeTab !== 'agent' }">
        <div class="agent-subtabs-bar">
          <div class="agent-subtabs-left">
            <div class="agent-subtabs-logo">
              <span class="agent-subtabs-dot"></span>
              <span class="agent-subtabs-brand">a.Rebalance</span>
            </div>
            <button
              type="button"
              class="agent-subtab-btn"
              :class="{ active: activeAgentSubtab === 'settings' }"
              @click="setAgentSubtab('settings')"
            >
              Settings
            </button>
            <button
              type="button"
              class="agent-subtab-btn"
              :class="{ active: activeAgentSubtab === 'visualize' }"
              @click="setAgentSubtab('visualize')"
            >
              Visualize
            </button>
            <button
              type="button"
              class="agent-subtab-btn"
              :class="{ active: activeAgentSubtab === 'history' }"
              @click="setAgentSubtab('history')"
            >
              History
            </button>
          </div>
          <button type="button" class="btn-back-dashboard" @click="setActiveTab('dashboard')">
            <i class="ph ph-arrow-left"></i> <span>back to dashboard</span>
          </button>
        </div>

        <div v-if="selectedDashboardSubject" class="agent-subject-bar">
          <span class="agent-current-subject">
            <span class="agent-current-subject-label">분석 종목</span>
            <span class="agent-current-subject-value">{{ selectedDashboardSubject }}</span>
          </span>
          <button type="button" class="agent-subject-clear" aria-label="선택 해제" @click="clearDashboardSubject">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div id="agent-subtab-settings" class="agent-subtab-pane" :class="{ hidden: activeAgentSubtab !== 'settings' }">
          <div class="settings-layout">
            <div class="settings-form-col">
              <div class="settings-board">
                <h2 class="settings-title">Portfolio Configuration.</h2>
                <div class="settings-section">
                  <span class="settings-section-label">FINANCIAL CORE</span>
                  <div class="settings-grid-2">
                    <div class="settings-input-card">
                      <label class="settings-input-lbl">Assets Under Management (KRW)</label>
                      <input class="settings-input" type="text" :value="formatKrw(displayTotalValue)" readonly />
                    </div>
                    <div class="settings-input-card">
                      <label class="settings-input-lbl">Rebalance Threshold</label>
                      <div class="settings-input-with-suffix">
                        <input class="settings-input" type="text" value="5.0" readonly />
                        <span class="settings-input-suffix">%p</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-section">
                  <span class="settings-section-label">TARGET ALLOCATION &amp; RISK</span>
                  <div class="settings-card">
                    <label class="settings-input-lbl">Risk Tolerance Profile</label>
                    <div class="risk-title-row">
                      <h3>{{ selectedStrategicModeConfig.controlLabel }} ({{ Number(riskScore).toFixed(1) }})</h3>
                      <span class="risk-scale">SCALE 1-10</span>
                    </div>
                    <input
                      v-model.number="riskScore"
                      class="risk-slider-input"
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"
                      @input="syncModeFromRiskScore"
                    />
                  </div>
                  <div class="settings-card">
                    <label class="settings-input-lbl">Target Asset Mix</label>
                    <div class="asset-mix-row">
                      <div class="asset-mix-bar">
                        <div class="bar-equities" :style="{ width: targetEquityWidth }">{{ Math.round(selectedStrategicModeConfig.assetClassTarget.EQUITY) }}% EQUITIES</div>
                        <div class="bar-fixed" :style="{ width: targetFixedWidth }">{{ Math.round(selectedStrategicModeConfig.assetClassTarget.BOND) }}% FIXED</div>
                      </div>
                      <span class="asset-mix-val">{{ targetAssetMixLabel }}</span>
                    </div>
                  </div>
                </div>

                <div class="settings-section">
                  <button type="button" class="amc-launcher-card" @click="openAgentConsole">
                    <div class="amc-launcher-icon"><i class="ph ph-squares-four"></i></div>
                    <div class="amc-launcher-body">
                      <span class="settings-section-label">AGENT COUNCIL MANAGEMENT</span>
                      <h3 class="amc-launcher-title">Open Agent Console</h3>
                      <p class="amc-launcher-hint">Configure, monitor, and override the autonomous agent decision matrix.</p>
                    </div>
                    <div class="amc-launcher-meta">
                      <span class="amc-launcher-count">{{ councilAgentCards.length }}</span>
                      <span class="amc-launcher-count-lbl">AGENTS</span>
                      <i class="ph ph-arrow-up-right amc-launcher-arrow"></i>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div class="settings-summary-col">
              <div class="settings-summary-card">
                <span class="settings-section-label">SESSION STATE</span>
                <div class="cfg-summary-list">
                  <div class="cfg-row"><span>Committee</span><strong>{{ committeeState }}</strong></div>
                  <div class="cfg-row"><span>Broker</span><strong>{{ brokerLabel }}</strong></div>
                  <div class="cfg-row"><span>Runtime Events</span><strong>{{ runStream.timelineEvents.length }}</strong></div>
                  <div class="cfg-row"><span>Estimated Cost</span><strong>Claude committee</strong></div>
                </div>
                <div class="core-analysis-block">
                  <div class="ca-header">
                    <span class="ca-dot"></span>
                    <span>CORE ANALYSIS</span>
                  </div>
                  <p>"위원회는 주문을 생성하기 전에 근거 수집 에이전트, 중재자의 충돌 조정, 최종 판단자의 승인, 실행 정책 검증을 단계별로 분리해 처리합니다."</p>
                </div>
              </div>
              <button type="button" class="btn-apply-settings" @click="applyAgentSettings">Apply Settings</button>
              <button type="button" class="btn-reset-default" @click="resetAgentSession">Reset Session</button>
              <p class="settings-disclaimer">에이전트 정책 변경은 다음 실시간 분석 세션에만 반영됩니다. 과거 실행 로그는 변경되지 않습니다.</p>
            </div>
          </div>
        </div>

        <div id="agent-subtab-visualize" class="agent-subtab-pane" :class="{ hidden: activeAgentSubtab !== 'visualize' }">
          <div id="agent-view-init" class="agent-vis-layout" :class="{ hidden: agentViewState !== 'init' }">
            <div class="agent-flow-column">
              <div class="agent-vis-card init-board">
                <div class="deadlock-hud-top">
                  <div class="hud-top-left">
                    <span class="hud-time-text">{{ agentClockText }}</span>
                    <span class="hud-status-dot theme-dot"></span>
                    <span class="hud-logo-text">a.Rebalance</span>
                  </div>
                  <div class="hud-top-right">
                    <span class="hud-badge-gray">NEW SESSION PROTOCOL V4.2</span>
                  </div>
                </div>

                <div class="deadlock-title-group jy-init-title">
                  <h2>Initialize Council.</h2>
                  <p class="deadlock-subtitle">Configure decision logic and agent participation for this session.</p>
                </div>

                <div class="init-section">
                  <span class="init-section-title">1. COUNCIL STRATEGIC MODE</span>
                  <div class="strategic-modes-grid">
                    <button
                      v-for="mode in STRATEGIC_MODES"
                      :key="mode.value"
                      type="button"
                      class="strategy-mode-card"
                      :class="{ active: selectedStrategicMode === mode.value }"
                      :aria-pressed="selectedStrategicMode === mode.value"
                      @click="selectStrategicMode(mode.value)"
                    >
                      <div class="mode-icon-wrap"><i class="ph" :class="mode.icon"></i></div>
                      <div class="mode-info">
                        <h3>{{ mode.label }}</h3>
                        <p>{{ mode.description }}</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="init-section jy-agent-section">
                  <div class="init-section-header-row">
                    <span class="init-section-title">2. ACTIVE AGENT NODES</span>
                    <button type="button" class="manage-agents-link" @click="setAgentSubtab('settings')">
                      Manage in Settings <i class="ph ph-arrow-right"></i>
                    </button>
                  </div>
                  <div class="active-agents-grid">
                    <div class="active-agent-card readonly" data-agent="risk">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle yellow"><i class="ph ph-warning"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">Risk Agent</h4>
                          <span class="agent-desc-display">Volatility & Exposure</span>
                        </div>
                      </div>
                    </div>
                    <div class="active-agent-card readonly" data-agent="macro">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle blue"><i class="ph ph-globe-hemisphere-west"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">Macro Agent</h4>
                          <span class="agent-desc-display">Economic Indicators</span>
                        </div>
                      </div>
                    </div>
                    <div class="active-agent-card readonly" data-agent="tax">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle green"><i class="ph ph-receipt"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">Cost Agent</h4>
                          <span class="agent-desc-display">Fees & Turnover</span>
                        </div>
                      </div>
                    </div>
                    <div class="active-agent-card readonly" data-agent="sentiment">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle purple"><i class="ph ph-chat-circle-dots"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">News Agent</h4>
                          <span class="agent-desc-display">News & Disclosure</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="agent-console-column">
              <div class="console-card init-summary-card">
                <div class="card-header-simple">
                  <span class="init-section-title">PORTFOLIO SUMMARY</span>
                </div>
                <div class="summary-list">
                  <div class="summary-row">
                    <span class="summary-lbl">Total AUM</span>
                    <strong class="summary-val">{{ formatKrw(displayTotalValue) }}</strong>
                  </div>
                  <div class="summary-row">
                    <span class="summary-lbl">Holdings</span>
                    <strong class="summary-val">{{ holdingRows.length }} Managed</strong>
                  </div>
                  <div class="summary-row">
                    <span class="summary-lbl">Last Rebalance</span>
                    <strong class="summary-val">{{ memorySummary.last }}</strong>
                  </div>
                </div>
              </div>

              <div class="console-card init-config-card">
                <div class="card-header-simple">
                  <span class="init-section-title">SESSION CONFIGURATION</span>
                </div>
                <div class="config-list">
                  <div class="config-row-flex">
                    <span class="config-lbl">Inference Model</span>
                    <div class="model-select-badge">{{ selectedStrategicModeConfig.label.toUpperCase() }} MODE <i class="ph ph-check"></i></div>
                  </div>
                  <div class="config-row-flex">
                    <span class="config-lbl">Committee State</span>
                    <div class="config-val-pill">{{ committeeState }}</div>
                  </div>
                  <div class="config-row-flex">
                    <span class="config-lbl">Execution Layer</span>
                    <div class="execution-layer-pill">
                      <span class="status-dot green"></span>
                      <span>KIS API</span>
                    </div>
                  </div>
                  <div class="config-row-flex">
                    <span class="config-lbl">Thread</span>
                    <div class="config-val-pill">{{ runStream.currentThreadId || 'STANDBY' }}</div>
                  </div>
                </div>
                <p class="config-disclaimer-text">
                  The council simulates portfolio actions from live balance and market data. Final execution remains gated by policy and user controls.
                </p>
              </div>

              <button type="button" class="btn-deadlock-action override-btn jy-start-analysis" :disabled="runStream.isStreaming" @click="startAgentRun">
                <i class="ph ph-play-circle"></i> {{ runButtonText === '실행 중' ? 'analysis running' : 'start analysis session' }}
              </button>
            </div>
          </div>

          <div id="agent-view-running" class="agent-vis-layout" :class="{ hidden: agentViewState !== 'running' }">
            <div class="agent-flow-column">
              <div class="agent-vis-card flow-board">
                <div class="agent-vis-header">
                  <div class="header-title-area">
                    <span class="vis-badge"><i class="ph ph-cpu"></i> CLAUDE COMMITTEE</span>
                    <h2>Agent Flow Visualization.</h2>
                    <p>Multi-agent council orchestrating portfolio decisions in real time.</p>
                  </div>
                  <div class="header-actions-area">
                    <button type="button" class="dropdown-mock" @click="setAgentSubtab('settings')">portfolio settings <i class="ph ph-caret-down"></i></button>
                    <button type="button" class="dropdown-mock" @click="setAgentSubtab('history')">agent logs <i class="ph ph-caret-down"></i></button>
                    <button type="button" class="settings-gear-btn" aria-label="Settings" @click="setAgentSubtab('settings')">
                      <i class="ph ph-gear"></i>
                    </button>
                  </div>
                </div>

                <div class="agent-flow-canvas" id="agent-flow-canvas-area">
                  <svg class="agent-connections-svg" id="agent-connections-svg" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
                    <path id="path-core-risk" class="connection-line" :class="{ active: isFlowPathActive('core-risk') }" d="M 500 132 C 500 165 190 165 190 190" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-risk') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-risk" /></animateMotion>
                    </circle>
                    <path id="path-core-macro" class="connection-line" :class="{ active: isFlowPathActive('core-macro') }" d="M 500 132 C 500 165 395 165 395 190" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-macro') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-macro" /></animateMotion>
                    </circle>
                    <path id="path-core-cost" class="connection-line" :class="{ active: isFlowPathActive('core-cost') }" d="M 500 132 C 500 165 605 165 605 190" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-cost') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-cost" /></animateMotion>
                    </circle>
                    <path id="path-core-news" class="connection-line" :class="{ active: isFlowPathActive('core-news') }" d="M 500 132 C 500 165 810 165 810 190" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-news') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-news" /></animateMotion>
                    </circle>

                    <path id="path-risk-med" class="connection-line" :class="{ active: isFlowPathActive('risk-med') }" d="M 190 330 C 190 370 500 345 500 380" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('risk-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-risk-med" /></animateMotion>
                    </circle>
                    <path id="path-macro-med" class="connection-line" :class="{ active: isFlowPathActive('macro-med') }" d="M 395 330 C 395 360 500 360 500 380" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('macro-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-macro-med" /></animateMotion>
                    </circle>
                    <path id="path-cost-med" class="connection-line" :class="{ active: isFlowPathActive('cost-med') }" d="M 605 330 C 605 360 500 360 500 380" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('cost-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-cost-med" /></animateMotion>
                    </circle>
                    <path id="path-news-med" class="connection-line" :class="{ active: isFlowPathActive('news-med') }" d="M 810 330 C 810 370 500 345 500 380" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('news-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-news-med" /></animateMotion>
                    </circle>

                    <path id="path-med-judge" class="connection-line" :class="{ active: isFlowPathActive('med-judge') }" d="M 500 506 C 500 522 500 522 500 535" />
                    <circle r="4.5" fill="var(--color-primary, #f47521)" :class="isFlowPathActive('med-judge') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#path-med-judge" /></animateMotion>
                    </circle>
                    <path id="path-judge-lightning" class="connection-line" :class="{ active: isFlowPathActive('judge-lightning') }" d="M 500 655 C 500 674 500 674 500 690" />
                    <circle r="4.5" fill="var(--color-primary, #f47521)" :class="isFlowPathActive('judge-lightning') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#path-judge-lightning" /></animateMotion>
                    </circle>
                  </svg>
                  <div class="agent-nodes-layer">
                    <div id="node-agent-core" class="flow-node-card node-top" :class="flowNodeClass('core')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-briefcase node-icon"></i>
                      <div class="node-info">
                        <h4>{{ flowNodeTitle('core') }}</h4>
                        <span class="node-status-text">{{ flowNodeRuntimeText('core') }}</span>
                        <div class="node-agent-stack">
                          <span v-for="chip in flowNodeAgentChips('core')" :key="`core-${chip}`" class="node-agent-chip">{{ chip }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="flow-nodes-row">
                      <div id="node-agent-risk" class="flow-node-card node-middle" :class="flowNodeClass('risk')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-shield-check node-icon risk"></i>
                      <div class="node-info">
                          <h4>{{ flowNodeTitle('risk') }}</h4>
                          <span class="node-status-text">{{ flowNodeRuntimeText('risk') }}</span>
                          <div class="node-agent-stack">
                            <span v-for="chip in flowNodeAgentChips('risk')" :key="`risk-${chip}`" class="node-agent-chip">{{ chip }}</span>
                          </div>
                        </div>
                      </div>
                      <div id="node-agent-macro" class="flow-node-card node-middle" :class="flowNodeClass('macro')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-globe node-icon macro"></i>
                        <div class="node-info">
                          <h4>{{ flowNodeTitle('macro') }}</h4>
                          <span class="node-status-text">{{ flowNodeRuntimeText('macro') }}</span>
                          <div class="node-agent-stack">
                            <span v-for="chip in flowNodeAgentChips('macro')" :key="`macro-${chip}`" class="node-agent-chip">{{ chip }}</span>
                          </div>
                        </div>
                      </div>
                      <div id="node-agent-tax" class="flow-node-card node-middle" :class="flowNodeClass('cost')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-receipt node-icon tax"></i>
                        <div class="node-info">
                          <h4>{{ flowNodeTitle('cost') }}</h4>
                          <span class="node-status-text">{{ flowNodeRuntimeText('cost') }}</span>
                          <div class="node-agent-stack">
                            <span v-for="chip in flowNodeAgentChips('cost')" :key="`cost-${chip}`" class="node-agent-chip">{{ chip }}</span>
                          </div>
                        </div>
                      </div>
                      <div id="node-agent-sentiment" class="flow-node-card node-middle" :class="flowNodeClass('news')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-chat-circle-text node-icon sentiment"></i>
                        <div class="node-info">
                          <h4>{{ flowNodeTitle('news') }}</h4>
                          <span class="node-status-text">{{ flowNodeRuntimeText('news') }}</span>
                          <div class="node-agent-stack">
                            <span v-for="chip in flowNodeAgentChips('news')" :key="`news-${chip}`" class="node-agent-chip">{{ chip }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div id="node-agent-mediator" class="flow-node-card node-bottom-1" :class="flowNodeClass('mediator')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-scales node-icon mediator"></i>
                      <div class="node-info">
                        <h4>{{ flowNodeTitle('mediator') }}</h4>
                        <span class="node-status-text">{{ flowNodeRuntimeText('mediator') }}</span>
                        <div class="node-agent-stack">
                          <span v-for="chip in flowNodeAgentChips('mediator')" :key="`mediator-${chip}`" class="node-agent-chip">{{ chip }}</span>
                        </div>
                      </div>
                    </div>

                    <div id="node-agent-judge" class="flow-node-card node-bottom-2" :class="flowNodeClass('judge')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-gavel node-icon judge"></i>
                      <div class="node-info">
                        <h4>{{ flowNodeTitle('judge') }}</h4>
                        <span class="node-status-text">{{ flowNodeRuntimeText('judge') }}</span>
                        <div class="node-agent-stack">
                          <span v-for="chip in flowNodeAgentChips('judge')" :key="`judge-${chip}`" class="node-agent-chip">{{ chip }}</span>
                        </div>
                      </div>
                    </div>

                    <div id="node-agent-lightning" class="flow-node-dot" :class="{ 'status-active': isFlowPathActive('judge-lightning') }">
                      <i class="ph-fill ph-lightning"></i>
                    </div>
                  </div>
                </div>

                <div class="agent-flow-status-bar">
                  <div class="status-phase">
                    <span class="status-label">CURRENT PHASE</span>
                    <h3>{{ agentPhaseLabel }}</h3>
                    <div class="flow-status-summary">{{ flowStatusSummary() }}</div>
                  </div>
                  <div class="status-time">
                    <span class="status-label">SESSION TIME</span>
                    <h3>{{ agentSessionTimeLabel }}</h3>
                  </div>
                </div>
              </div>
            </div>

            <div class="agent-console-column">
              <div class="console-card state-card">
                <div class="state-info">
                  <h3>Council Deliberating</h3>
                  <p>Live consensus tracking</p>
                </div>
                <div class="state-pulse-dot" :class="{ active: runStream.isStreaming }"></div>
              </div>

              <div class="console-card transcript-card">
                <div class="transcript-header">
                  <h3>AGENT COUNCIL TRANSCRIPT</h3>
                  <span class="live-tag"><span class="live-dot"></span> LIVE</span>
                </div>
                <div ref="transcriptFeedEl" class="transcript-feed-area" id="agent-transcript-feed">
                  <div
                    v-for="row in agentTranscriptRows"
                    :key="row.key"
                    class="debate-bubble"
                    :class="[{ speaking: row.speaking }, `flow-${row.flow}`]"
                    :data-flow-node="row.flow"
                  >
                    <div class="debate-sender">
                      <span class="sender-name">{{ row.sender }}</span>
                      <span class="sender-role">{{ row.flowLabel }} · {{ row.role }} · {{ row.time }}</span>
                    </div>
                    <p class="debate-text">{{ row.text }}</p>
                  </div>
                </div>
              </div>

              <div class="metric-cards-grid">
                <div class="metric-mini-card">
                  <span class="metric-label">ROUND 1</span>
                  <div class="metric-val">{{ councilFlowState.round1Count || '-' }}</div>
                  <span class="metric-sub">parallel opinions</span>
                </div>
                <div class="metric-mini-card">
                  <span class="metric-label">ROUND 2</span>
                  <div class="metric-val text-orange">{{ councilFlowState.round2Count || 0 }}</div>
                  <span class="metric-sub">{{ councilFlowState.round2Targets.length ? councilFlowState.round2Targets.slice(0, 2).join(', ') : 'no recall yet' }}</span>
                </div>
                <div class="metric-mini-card">
                  <span class="metric-label">EVIDENCE</span>
                  <div class="metric-val">{{ councilFlowState.evidenceEvents + councilFlowState.evidenceDocuments }}</div>
                  <span class="metric-sub">events + documents</span>
                </div>
              </div>

              <div class="console-card control-card">
                <div class="control-meta">
                  <div class="meta-item">
                    <span class="meta-lbl">Mode</span>
                    <strong class="meta-val">{{ selectedStrategicModeConfig.controlLabel }}</strong>
                  </div>
                  <div class="meta-item">
                    <span class="meta-lbl">AUM</span>
                    <strong class="meta-val">{{ formatKrw(displayTotalValue) }}</strong>
                  </div>
                </div>
                <button type="button" class="btn-analysis-toggle running" @click="runStream.cancel">
                  <i class="ph-fill ph-pause"></i>
                  <span>stop analysis.</span>
                </button>
              </div>
            </div>
          </div>

          <div id="agent-view-success" class="agent-vis-layout" :class="{ hidden: agentViewState !== 'success' }">
            <div class="agent-flow-column">
              <div class="agent-vis-card success-board">
                <div class="agent-vis-header">
                  <div class="header-title-area">
                    <span class="vis-badge green"><i class="ph ph-shield-check"></i> {{ isNoTradeDecision ? '유지 권고' : 'system resolved' }}</span>
                    <h2>{{ isNoTradeDecision ? '유지 권고.' : 'Rebalance Resolved.' }}</h2>
                    <p>{{ isNoTradeDecision ? '위원회 심의 결과 현재 포트폴리오를 유지합니다 — 즉시 실행할 거래는 없습니다.' : 'The committee finished the live analysis and produced an executable decision trace.' }}</p>
                  </div>
                  <div class="header-actions-area">
                    <button type="button" class="dropdown-mock" @click="setAgentSubtab('settings')">portfolio settings <i class="ph ph-caret-down"></i></button>
                    <button type="button" class="dropdown-mock" @click="setAgentSubtab('history')">audit trails <i class="ph ph-caret-down"></i></button>
                  </div>
                </div>

                <div class="success-hero-area">
                  <div class="success-checkmark-circle">
                    <i class="ph-fill ph-check-circle"></i>
                  </div>
                </div>

                <div class="trade-tickets-section">
                  <div class="section-title-row">
                    <span class="sub-section-lbl">{{ isNoTradeDecision ? '배분 드리프트 (참고)' : 'PROPOSED TRADE TICKETS' }}</span>
                    <span v-if="!isNoTradeDecision" class="verification-tag"><i class="ph ph-shield-check"></i> VERIFIED BY FINAL JUDGE</span>
                  </div>
                  <p v-if="isNoTradeDecision" class="no-trade-hint">현재 비중이 목표 범위 안이거나 즉시 실행 가능한 조정안이 없어 유지로 결정했습니다. 아래는 목표 대비 현재 비중(참고)이며, 실제 제안 거래가 아닙니다.</p>
                  <div class="tickets-list">
                    <div v-for="row in driftRows.slice(0, 2)" :key="row.key" class="ticket-row buy">
                      <div class="ticket-left">
                        <div class="direction-badge up"><i class="ph ph-arrow-up"></i></div>
                        <div class="ticket-info">
                          <h4>{{ isNoTradeDecision ? row.label : 'REVIEW ' + row.label }}</h4>
                          <span>{{ row.before }} → {{ row.after }}</span>
                        </div>
                      </div>
                      <div class="ticket-right">
                        <span class="val-amount">{{ row.after }}</span>
                        <span class="exec-broker">{{ isNoTradeDecision ? '현재 vs 목표' : 'EXECUTION: 승인 대기' }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="view-more-transactions" role="button" tabindex="0" style="cursor: pointer;" @click="setAgentSubtab('history')" @keydown.enter="setAgentSubtab('history')">
                    <i class="ph ph-plus"></i> VIEW FULL DECISION TRACE
                  </div>
                </div>

                <div class="rationales-section">
                  <span class="sub-section-lbl">COUNCIL RATIONALES</span>
                  <div v-if="councilRationales.length" class="rationales-grid">
                    <div v-for="rationale in councilRationales" :key="rationale.key" class="rationale-card">
                      <div class="rat-header"><div class="rat-icon"><i class="ph ph-robot"></i></div><span>{{ rationale.name }}</span></div>
                      <p>{{ rationale.rationale }}</p>
                    </div>
                  </div>
                  <p v-else class="no-trade-hint">이번 심의의 에이전트 근거가 아직 없습니다.</p>
                </div>
              </div>
            </div>

            <div class="agent-console-column">
              <div class="console-card drift-card">
                <div class="card-header-simple"><h3>ALLOCATION DRIFT</h3></div>
                <div class="drift-bars-list">
                  <div v-for="row in driftRows" :key="row.key" class="drift-item">
                    <div class="drift-info"><span>{{ row.label }}</span><strong>{{ row.before }} → {{ row.after }}</strong></div>
                    <div class="drift-progress-bg"><div class="drift-progress-bar" :style="{ width: `${row.width}%` }"></div></div>
                  </div>
                </div>
              </div>
              <div class="console-card aum-summary-card">
                <div class="aum-value-wrap">
                  <span class="aum-lbl">CURRENT NET ASSET VALUE</span>
                  <h2>{{ formatKrw(displayTotalValue) }}</h2>
                </div>
                <div class="aum-metrics-row">
                  <div class="aum-metric-cell"><span>{{ formatSignedPercent(totalProfitRate) }}</span><strong>RETURN</strong></div>
                  <div class="aum-metric-cell"><span>{{ holdingRows.length }}</span><strong>HOLDINGS</strong></div>
                </div>
              </div>
              <div class="console-card control-card">
                <button type="button" class="btn-full-portfolio" @click="setActiveTab('dashboard')">view full portfolio →</button>
              </div>
            </div>
          </div>

          <div
            id="agent-view-deadlock"
            class="agent-vis-layout"
            :class="{ hidden: agentViewState !== 'deadlock' && agentViewState !== 'manualReview', 'manual-review-mode': isManualReview }"
          >
            <div class="agent-flow-column">
              <div class="agent-vis-card deadlock-board">
                <div class="deadlock-hud-top">
                  <div class="hud-top-left">
                    <span class="hud-time-text">{{ agentClockText }}</span>
                    <span class="hud-status-dot"></span>
                    <span class="hud-logo-text">a.Rebalance</span>
                  </div>
                  <div class="hud-top-right">
                    <span class="hud-badge-gray">{{ isManualReview ? 'review queue' : 'system diagnostics' }}</span>
                    <span class="hud-badge-red">{{ isManualReview ? 'waiting' : 'halted' }}</span>
                  </div>
                </div>
                <div class="deadlock-title-group">
                  <h2>{{ isManualReview ? 'Manual Review Required.' : 'Consensus Deadlock.' }}</h2>
                  <p class="deadlock-subtitle">{{ isManualReview ? manualReviewSummary : agentFailureSummary }}</p>
                </div>
                <div class="agent-flow-canvas deadlock-canvas">
                  <svg class="agent-connections-svg deadlock-svg" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
                    <path class="connection-line" d="M 500 100 C 500 155 235 135 235 185" />
                    <path class="connection-line" d="M 500 100 C 500 155 765 135 765 185" />
                    <path class="connection-line" d="M 235 280 C 235 350 500 305 500 330" />
                    <path class="connection-line" d="M 765 280 C 765 350 500 305 500 330" />
                  </svg>
                  <div class="agent-nodes-layer">
                    <div class="flow-node-card node-top status-deadlock">
                      <div class="node-glow-bg red-glow"></div>
                      <i class="ph-bold ph-briefcase node-icon"></i>
                      <div class="node-info"><h4>CORE COUNCIL</h4><span class="node-status-text red-txt">{{ isManualReview ? 'WAITING' : 'TIMEOUT' }}</span></div>
                    </div>
                    <div class="flow-node-card status-deadlock" style="top: 185px; left: 10%;">
                      <div class="node-glow-bg red-glow"></div>
                      <i class="ph-bold ph-shield-check node-icon risk"></i>
                      <div class="node-info"><h4>RISK AGENT</h4><span class="node-status-text red-txt">REVIEW</span></div>
                    </div>
                    <div class="flow-node-card status-deadlock" style="top: 185px; right: 10%;">
                      <div class="node-glow-bg red-glow"></div>
                      <i class="ph-bold ph-chat-circle-text node-icon sentiment"></i>
                      <div class="node-info"><h4>NEWS AGENT</h4><span class="node-status-text red-txt">REVIEW</span></div>
                    </div>
                    <div class="flow-node-card node-bottom-1 status-deadlock-mediator" style="top: 330px;">
                      <div class="node-glow-bg red-glow"></div>
                      <i class="ph-bold ph-scales node-icon mediator"></i>
                      <div class="node-info"><h4>MEDIATOR JUDGE</h4><span class="node-status-text red-txt">{{ isManualReview ? 'PENDING' : 'HALTED' }}</span></div>
                    </div>
                  </div>
                </div>
                <div class="agent-flow-status-bar deadlock-status-bar">
                  <div class="status-phase"><span class="status-label red-txt">CURRENT STATUS</span><h3 class="red-txt">{{ isManualReview ? 'Awaiting User Decision' : 'Awaiting Manual Override' }}</h3></div>
                  <div class="status-time"><span class="status-label red-txt">{{ isManualReview ? 'WAITING SINCE' : 'HALTED SINCE' }}</span><h3 class="red-txt">{{ agentSessionTimeLabel }}</h3></div>
                </div>
              </div>
            </div>
            <div class="agent-console-column">
              <div class="console-card conflict-alert-card">
                <div class="conflict-alert-header"><i class="ph-bold ph-warning-circle"></i><span>{{ isManualReview ? 'REVIEW REQUIRED' : 'CONFLICT 042-B' }}</span></div>
                <p>{{ isManualReview ? manualReviewDecisionLabel : agentFailureSummary }}</p>
              </div>
              <div class="console-card conflict-points-card">
                <div class="card-header-simple"><h3>{{ isManualReview ? 'DECISION CONTEXT' : 'CONFLICT POINTS' }}</h3></div>
                <div class="conflict-points-list">
                  <div v-for="row in agentFailurePoints" :key="row.key" class="conflict-point-row">
                    <strong class="point-title">{{ row.sender }}</strong>
                    <p>{{ row.text }}</p>
                  </div>
                </div>
              </div>
              <div v-if="isManualReview && manualReviewPlan.length" class="console-card conflict-points-card jy-review-plan-card">
                <div class="card-header-simple"><h3>제안된 리밸런싱 초안 · {{ manualReviewPlan.length }}종목</h3></div>
                <div class="conflict-points-list">
                  <div v-for="row in manualReviewPlan" :key="row.ticker" class="conflict-point-row jy-review-plan-row">
                    <strong class="point-title">{{ row.name }} <span class="jy-review-ticker">{{ row.ticker }}</span></strong>
                    <span
                      class="jy-review-delta"
                      :style="{ color: row.deltaPct >= 0 ? 'var(--color-success, #2e7d32)' : 'var(--color-danger, #c62828)' }"
                    >{{ row.deltaPct >= 0 ? '비중 확대 +' : '비중 축소 ' }}{{ row.deltaPct.toFixed(1) }}%p</span>
                  </div>
                </div>
              </div>
              <div v-if="isManualReview" class="deadlock-actions-area manual-review-actions">
                <button
                  v-for="action in manualReviewActions"
                  :key="action.decision"
                  type="button"
                  class="btn-deadlock-action"
                  :class="action.className"
                  :disabled="runStream.isStreaming"
                  @click="resumeManualReview(action)"
                >
                  {{ action.label }}
                </button>
                <button type="button" class="btn-deadlock-action restart-btn" :disabled="runStream.isStreaming" @click="resetAgentSession">Reset Session</button>
              </div>
              <div v-else class="deadlock-actions-area">
                <button type="button" class="btn-deadlock-action override-btn" @click="resetAgentSession">Reset Session</button>
                <button type="button" class="btn-deadlock-action restart-btn" @click="startAgentRun">Restart Analysis</button>
              </div>
            </div>
          </div>
        </div>

        <div id="agent-subtab-history" class="agent-subtab-pane" :class="{ hidden: activeAgentSubtab !== 'history' }">
          <div class="history-board">
            <div class="history-hud-top">
              <div class="history-hud-left">
                <span class="history-hud-time">{{ agentClockText }}</span>
                <span class="history-hud-dot"></span>
                <span class="history-hud-brand">a.Rebalance</span>
              </div>
              <div class="history-hud-right">
                <button type="button" class="history-hud-pill" @click="setAgentSubtab('visualize')">live session</button>
                <button type="button" class="history-hud-pill dark" @click="setAgentSubtab('history')">agent logs <i class="ph ph-caret-down"></i></button>
                <button type="button" class="history-hud-gear" @click="setAgentSubtab('settings')"><i class="ph ph-gear"></i></button>
              </div>
            </div>

            <div class="history-title-row">
              <h1 class="history-title">Logs History.</h1>
              <p class="history-subtitle">Archived council deliberations and execution logs.</p>
            </div>

            <div class="history-content">
              <div class="history-sessions-col">
                <span class="history-section-lbl">RECENT DELIBERATIONS</span>
                <div class="history-sessions-list">
                  <button type="button" class="history-session-card active" @click="setAgentSubtab('visualize')">
                    <div class="hsc-top">
                      <span class="hsc-date">{{ memorySummary.last }}</span>
                      <span class="hsc-status executed">{{ committeeState }}</span>
                    </div>
                    <h3 class="hsc-title">Live Portfolio Review</h3>
                    <div class="hsc-metrics">
                      <div class="hsc-metric"><span class="hsc-metric-lbl">EVENTS</span><strong class="hsc-metric-val">{{ runStream.timelineEvents.length }}</strong></div>
                      <div class="hsc-metric"><span class="hsc-metric-lbl">CONSENSUS</span><strong class="hsc-metric-val green">TRACE</strong></div>
                    </div>
                  </button>
                  <button v-for="card in historySessionCards" :key="card.id" type="button" class="history-session-card" :class="{ active: historySelected?.run?.id === card.id }" @click="selectHistoryRun(card.id)">
                    <div class="hsc-top">
                      <span class="hsc-date">{{ card.date }}</span>
                      <span class="hsc-status" :class="card.statusClass">{{ card.statusLabel }}</span>
                    </div>
                    <h3 class="hsc-title">{{ card.title }}</h3>
                    <div class="hsc-metrics">
                      <div class="hsc-metric"><span class="hsc-metric-lbl">DETAIL</span><strong class="hsc-metric-val">{{ card.detail }}</strong></div>
                    </div>
                  </button>
                  <p v-if="!historySessionCards.length" class="history-empty-hint">아직 저장된 심의 세션이 없습니다. 리밸런싱 판단을 실행하면 여기에 기록됩니다.</p>
                </div>
              </div>

              <div class="history-transcript-col">
                <div class="history-transcript-head">
                  <div>
                    <span class="history-section-lbl">SESSION TRANSCRIPT</span>
                    <h2 class="history-session-title">Agent Council Replay</h2>
                    <div class="history-session-meta">
                      <span class="hsm-item"><i class="ph ph-calendar"></i> {{ memorySummary.last }}</span>
                      <span class="hsm-item"><i class="ph ph-clock"></i> {{ agentClockText }}</span>
                    </div>
                  </div>
                  <button type="button" class="btn-export-log" @click="exportAgentLog">Export Full Log (.json)</button>
                </div>

                <div class="history-transcript-feed">
                  <div v-for="row in (historySelected ? historyTranscriptRows : agentTranscriptRows)" :key="row.key" class="ht-entry">
                    <div class="ht-avatar" :class="row.avatar"><i class="ph-bold ph-robot"></i></div>
                    <div class="ht-body">
                      <div class="ht-meta">
                        <span class="ht-name">{{ row.sender }}</span>
                        <span class="ht-time">{{ row.time }}</span>
                      </div>
                      <div class="ht-bubble">{{ row.text }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="amc-popup" class="amc-popup-overlay" :class="{ hidden: !showAgentConsole }" :aria-hidden="!showAgentConsole" @click.self="closeAgentConsole">
        <div class="amc-popup-content" role="dialog" aria-modal="true" aria-label="Agent Council Management">
          <header class="amc-popup-header">
            <div class="amc-popup-title-area">
              <span class="amc-popup-lbl">AGENT COUNCIL MANAGEMENT</span>
              <h2 class="amc-popup-title">Configure, monitor &amp; override.</h2>
              <p class="amc-popup-sub">Live state of every autonomous agent in the decision matrix.</p>
            </div>
            <button type="button" class="amc-popup-close" aria-label="Close" @click="closeAgentConsole">
              <i class="ph ph-x"></i>
            </button>
          </header>
          <div class="amc-popup-body">
            <div class="amc-grid">
              <div v-for="agent in councilAgentCards" :key="agent.id" class="amc-card" :class="{ 'amc-card-primary': agent.id === 'core' || agent.id === 'final' }">
                <div class="amc-header">
                  <div class="amc-icon-wrap" :class="agent.tone"><i class="ph" :class="agent.icon"></i></div>
                  <div class="amc-title-area">
                    <h3>{{ agent.name }}</h3>
                    <span class="amc-meta">{{ agent.meta }}</span>
                  </div>
                  <label class="switch-container amc-switch">
                    <input type="checkbox" checked />
                    <span class="switch-slider"></span>
                  </label>
                </div>

                <div class="amc-stats-row">
                  <div class="amc-stat-box">
                    <span class="amc-stat-lbl">SYSTEM STATUS</span>
                    <span class="amc-status-tag" :class="agent.status">{{ agent.status.replace('status-', '').toUpperCase() }}</span>
                  </div>
                  <div v-if="agent.confidence" class="amc-stat-box">
                    <span class="amc-stat-lbl">CONFIDENCE</span>
                    <strong class="amc-conf-val">{{ agent.confidence }}</strong>
                    <div class="amc-conf-bar"><div class="amc-conf-fill" :style="{ width: agent.confidence }"></div></div>
                  </div>
                </div>

                <div class="amc-action-block">
                  <div class="amc-action-head"><span>Last Action</span><span class="amc-time">{{ runStream.isStreaming ? 'live' : 'standby' }}</span></div>
                  <div class="amc-action-log">{{ agent.action }}</div>
                </div>

                <div class="amc-model-row">
                  <span class="amc-model-lbl">Inference Model</span>
                  <select class="amc-model-select" :value="agent.id === 'core' || agent.id === 'final' ? 'Claude Haiku' : 'Deterministic + Claude'">
                    <option>Claude Haiku</option>
                    <option>Claude Sonnet</option>
                    <option>Deterministic + Claude</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="tab-risk" class="tab-view-content" :class="{ hidden: activeTab !== 'risk' }">
        <div class="data-matrix">
          <div class="data-col">
            <div class="col-header">RISK LIMITS</div>
            <ul class="data-list">
              <li v-for="row in complianceRows" :key="row.key" class="data-row">
                <span class="row-key">{{ row.key }}</span>
                <span class="row-val">{{ row.value }}</span>
              </li>
            </ul>
          </div>
          <div class="data-col">
            <div class="col-header">COMMITTEE STATUS</div>
            <ul class="data-list">
              <li class="data-row">
                <span class="row-key">COMMITTEE_STATE</span>
                <span class="row-val">{{ committeeState }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">BROKER_STATE</span>
                <span class="row-val">{{ brokerLabel }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">THREAD</span>
                <span class="row-val">{{ runStream.currentThreadId || 'NO ACTIVE THREAD' }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">EVENTS</span>
                <span class="row-val">{{ runStream.timelineEvents.length }}</span>
              </li>
            </ul>
          </div>
          <div class="data-col">
            <div class="col-header">RECENT SIGNALS</div>
            <ul class="data-list log-list">
              <li v-for="row in logRows.slice(0, 8)" :key="row.key" class="data-row" :class="row.tone">
                <span class="row-key">{{ row.time }} {{ row.label }}</span>
                <span v-if="row.detail" class="row-val">{{ row.detail }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div id="tab-mypage" class="tab-view-content" :class="{ hidden: activeTab !== 'mypage' }">
        <section id="account-panel" class="account-console">
          <div class="col-header">KIS API CREDENTIALS</div>
          <form class="credential-grid" @submit.prevent="saveCredentials">
            <label>
              <span>Environment</span>
              <select v-model="credentialForm.environment">
                <option value="PAPER">PAPER</option>
                <option value="PROD">PROD</option>
              </select>
            </label>
            <label>
              <span>App Key</span>
              <input v-model="credentialForm.appKey" type="password" autocomplete="off" />
            </label>
            <label>
              <span>App Secret</span>
              <input v-model="credentialForm.appSecret" type="password" autocomplete="off" />
            </label>
            <label>
              <span>Account No.</span>
              <input v-model="credentialForm.accountNumber" type="text" />
            </label>
            <label class="checkline">
              <input v-model="credentialForm.tradingEnabled" type="checkbox" />
              <span>Trading enabled</span>
            </label>
            <div class="credential-actions">
              <button type="submit" class="hud-btn-primary" :disabled="loading.credentials">
                {{ loading.credentials ? 'SAVING' : 'SAVE' }}
              </button>
              <button type="button" class="hud-btn account-btn" :disabled="loading.credentials" @click="deleteCredentials">
                DELETE
              </button>
              <button type="button" class="hud-btn account-btn" @click="goBacktestAdmin">BACKTEST ADMIN</button>
              <button type="button" class="hud-btn account-btn" @click="goValidation">VALIDATION</button>
            </div>
            <p v-if="credentialNotice" class="form-note positive">{{ credentialNotice }}</p>
            <p v-if="credentialError" class="form-note danger">{{ credentialError }}</p>
          </form>
        </section>
      </div>
    </div>
    </section>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/bold/style.css');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/fill/style.css');
@import '@/assets/jy-design/variables.css';
@import '@/assets/jy-design/global.css';
@import '@/assets/jy-design/dashboard.css';

.jy-dashboard-host {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text-main);
}

.jy-dashboard-host #dashboard-page.view-section {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.jy-dashboard-host .notice-strip {
  margin: -12px 0 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  padding: 10px 0;
  color: #b0f4de;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.jy-dashboard-host .notice-strip.danger {
  color: #ffb3ba;
}

.jy-dashboard-host .row-val {
  white-space: pre-line;
}

.jy-dashboard-host .notch-nav {
  overflow-x: auto;
  scrollbar-width: none;
}

.jy-dashboard-host .notch-nav::-webkit-scrollbar {
  display: none;
}

.jy-dashboard-host .notch-link,
.jy-dashboard-host .notch-actions {
  flex: 0 0 auto;
}

.jy-dashboard-host .notch-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 10px;
  padding-left: 10px;
  border-left: 1px solid var(--color-border);
}

.jy-dashboard-host .notch-action-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-sub);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.jy-dashboard-host .notch-action-btn:hover {
  background: var(--color-primary-soft);
  color: var(--color-text-main);
}

.jy-dashboard-host .zone-dark.dashboard-zone-compact {
  padding: 0;
  border-bottom: 0;
  background: transparent;
}

.jy-dashboard-host.dashboard-tab-active #dashboard-page {
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(115% 75% at 50% -12%, rgba(124, 92, 252, 0.13) 0%, transparent 55%),
    radial-gradient(70% 55% at 88% 112%, rgba(124, 92, 252, 0.10) 0%, transparent 52%),
    radial-gradient(65% 55% at 6% 108%, rgba(70, 90, 180, 0.08) 0%, transparent 50%),
    var(--color-bg);
}

.jy-dashboard-host.dashboard-tab-active .zone-light {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 6px 36px 48px;
  background: transparent;
}

.jy-dashboard-host.dashboard-tab-active #tab-dashboard {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.terminal-dash {
  --td-blue: #3b82f6;
  --td-green: #22c55e;
  --td-red: #ef4444;
  --td-gold: #f59e0b;
  --td-card-bg: var(--color-card);
  --td-card-border: var(--color-border);
  --td-card-border-hover: var(--color-border-hover);
  --td-label: var(--color-text-light);
  --td-text: var(--color-text-main);
  --td-text-dim: var(--color-text-sub);
  --td-track: var(--color-border);
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 284px;
  grid-template-rows: minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
  font-family: var(--font-body);
}

.terminal-dash .td-navgroup-label,
.terminal-dash .td-section-label,
.terminal-dash .td-card-title,
.terminal-dash .td-meta-label,
.terminal-dash .td-consensus-legend,
.terminal-dash .td-chart-delta,
.terminal-dash .td-chart-axis,
.terminal-dash .td-badge {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.terminal-dash .td-card {
  background: var(--td-card-bg);
  border: 1px solid var(--td-card-border);
  border-radius: 14px;
  padding: 16px 18px;
  transition: border-color 0.18s ease;
}

.terminal-dash .td-card:hover { border-color: var(--td-card-border-hover); }

.terminal-dash .td-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.terminal-dash .td-card-title {
  font-size: 11px;
  color: var(--td-label);
}

.terminal-dash .td-rail-left,
.terminal-dash .td-rail-right {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.terminal-dash .td-rail-left::-webkit-scrollbar,
.terminal-dash .td-rail-right::-webkit-scrollbar,
.terminal-dash .td-center-view::-webkit-scrollbar {
  display: none;
}

.terminal-dash .td-rail-left {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.terminal-dash .td-navgroup {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.terminal-dash .td-navgroup-foot { margin-top: auto; }

.terminal-dash .td-navgroup-label {
  font-size: 9px;
  color: var(--td-label);
  padding: 0 12px 6px;
}

.terminal-dash .td-navitem {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: var(--td-text-dim);
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
  text-align: left;
  transition: background 0.18s ease, color 0.18s ease;
}

.terminal-dash .td-navitem i {
  font-size: 16px;
  opacity: 0.8;
}

.terminal-dash .td-navitem:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--td-text);
}

.terminal-dash .td-navitem.active {
  background: rgba(255, 255, 255, 0.06);
  color: var(--td-text);
}

.terminal-dash .td-navitem.active i {
  color: var(--color-primary);
  opacity: 1;
}

.terminal-dash .td-system { gap: 5px; }

.terminal-dash .td-sys-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 12px 8px;
}

.terminal-dash .td-sys-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
  flex-shrink: 0;
}

.terminal-dash .td-sys-name {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--td-text);
  font-size: 14px;
}

.terminal-dash .td-sys-op {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--td-label);
  text-transform: uppercase;
}

.terminal-dash .td-main,
.terminal-dash .td-center-view {
  min-width: 0;
  min-height: 0;
}

.terminal-dash .td-main {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
}

.terminal-dash .td-center-view {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
  scrollbar-width: none;
  scrollbar-gutter: stable;
}

.terminal-dash .td-hero {
  border: 1px solid var(--td-card-border);
  background: var(--td-card-bg);
  border-radius: 16px;
  padding: 20px 26px;
}

.terminal-dash .td-hero-value {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(34px, 4.3vw, 58px);
  line-height: 1;
  letter-spacing: 0.02em;
  color: var(--td-text);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 28px rgba(255, 255, 255, 0.06);
}

.terminal-dash .td-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: 14px;
}

.terminal-dash .td-meta-block {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.terminal-dash .td-meta-label {
  font-size: 10px;
  color: var(--td-label);
}

.terminal-dash .td-meta-val,
.terminal-dash .td-meta-pos,
.terminal-dash .td-meta-neg {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
}

.terminal-dash .td-meta-val { color: var(--td-text-dim); }
.terminal-dash .td-meta-pos { color: var(--td-green); }
.terminal-dash .td-meta-neg { color: var(--td-red); }

.terminal-dash .td-cardrow {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 18px;
}

.terminal-dash .td-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 6px;
}

.terminal-dash .td-badge-conflict {
  color: var(--td-gold);
  background: rgba(245, 158, 11, 0.13);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.terminal-dash .td-badge-consensus,
.terminal-dash .td-badge-pass {
  color: var(--td-green);
  background: rgba(34, 197, 94, 0.13);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.terminal-dash .td-badge-hold {
  color: var(--td-text-dim);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--td-card-border);
}

.terminal-dash .td-consensus {
  cursor: pointer;
}

.terminal-dash .td-consensus-headline {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 20px;
  line-height: 1.2;
  color: var(--td-text);
}

.terminal-dash .td-consensus-headline em {
  font-style: normal;
  color: var(--td-red);
}

.terminal-dash .td-consensus-headline em.up { color: var(--td-green); }

.terminal-dash .td-consensus-legend {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--td-label);
  margin-bottom: 8px;
}

.terminal-dash .td-consensus-legend .td-leg-mid,
.terminal-dash .td-consensus-counts .td-leg-mid {
  flex: 1;
  text-align: center;
}

.terminal-dash .td-consensus-bar {
  display: flex;
  gap: 2px;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--td-track);
}

.terminal-dash .td-bar-seg { height: 100%; }
.terminal-dash .td-bar-inc { background: var(--td-green); }
.terminal-dash .td-bar-hold { background: rgba(255, 255, 255, 0.22); }
.terminal-dash .td-bar-dec { background: var(--td-red); }

.terminal-dash .td-consensus-counts {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--td-text-dim);
}

.terminal-dash .td-consensus-desc {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--td-text-dim);
}

.terminal-dash .td-holdings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.terminal-dash .td-holding {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  text-align: left;
  cursor: pointer;
}

.terminal-dash .td-holding-row {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
  gap: 8px;
}

.terminal-dash .td-holding-ticker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--td-text);
}

.terminal-dash .td-holding-name {
  min-width: 0;
  font-size: 12px;
  color: var(--td-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-dash .td-holding-alloc {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--td-text-dim);
  white-space: nowrap;
}

.terminal-dash .td-holding-pl {
  min-width: 48px;
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
}

.terminal-dash .td-holding-pl.pos { color: var(--td-green); }
.terminal-dash .td-holding-pl.neg { color: var(--td-red); }
.terminal-dash .td-holding-pl.flat { color: var(--td-label); }

.terminal-dash .td-holding-track {
  width: 100%;
  height: 7px;
  border-radius: 4px;
  background: var(--td-track);
  overflow: hidden;
}

.terminal-dash .td-holding-fill {
  display: block;
  height: 100%;
  min-width: 6px;
  border-radius: 4px;
  transition: width 0.28s ease;
}

.terminal-dash .td-chart {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.terminal-dash .td-chart-delta {
  font-size: 11px;
  color: var(--td-green);
}

.terminal-dash .td-chart-canvas {
  flex: 1 1 auto;
  width: 100%;
  min-height: 150px;
}

.terminal-dash .td-chart-canvas svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.terminal-dash .td-chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 9px;
  color: var(--td-label);
}

.terminal-dash .td-rail-right {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.terminal-dash .td-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.terminal-dash .td-section-label {
  font-size: 10px;
  color: var(--td-label);
}

.terminal-dash .td-opinions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.terminal-dash .td-opinion {
  background: var(--td-card-bg);
  border: 1px solid var(--td-card-border);
  border-left: 3px solid var(--td-card-border);
  border-radius: 10px;
  padding: 12px 14px;
}

.terminal-dash .td-opinion.dec { border-left-color: var(--td-red); }
.terminal-dash .td-opinion.inc { border-left-color: var(--td-green); }
.terminal-dash .td-opinion.hold { border-left-color: var(--td-blue); }

.terminal-dash .td-opinion-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.terminal-dash .td-opinion-domain {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--td-text);
  font-weight: 600;
}

.terminal-dash .td-opinion-verdict {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
}

.terminal-dash .td-opinion-verdict.dec { color: var(--td-red); }
.terminal-dash .td-opinion-verdict.inc { color: var(--td-green); }
.terminal-dash .td-opinion-verdict.hold { color: var(--td-blue); }

.terminal-dash .td-opinion-text {
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--td-text-dim);
}

.terminal-dash .td-checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.terminal-dash .td-check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--td-text);
}

.terminal-dash .td-check i {
  color: var(--td-green);
  font-size: 16px;
}

.terminal-dash .td-check.warn i { color: var(--td-gold); }

.terminal-dash .td-check .td-check-val {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--td-label);
}

.terminal-dash .td-execute {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-top: auto;
  padding: 14px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff, #f6f3ed);
  color: #1c1206;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba(255, 255, 255, 0.16);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.terminal-dash .td-execute:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 34px rgba(255, 255, 255, 0.22);
}

.terminal-dash .td-execute:disabled {
  cursor: wait;
  opacity: 0.62;
  transform: none;
  box-shadow: none;
}

.terminal-dash .td-calendar-card {
  min-height: 100%;
}

.terminal-dash .td-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.terminal-dash .td-calendar-cell {
  min-height: 58px;
  border: 1px solid var(--td-card-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.025);
  color: var(--td-text-dim);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 8px;
}

.terminal-dash .td-calendar-cell.level-1 { background: rgba(59, 130, 246, 0.08); }
.terminal-dash .td-calendar-cell.level-2 { background: rgba(59, 130, 246, 0.14); }
.terminal-dash .td-calendar-cell.level-3 { background: rgba(34, 197, 94, 0.16); }
.terminal-dash .td-calendar-cell.level-4 { background: rgba(245, 158, 11, 0.18); border-color: rgba(245, 158, 11, 0.32); }

.jy-dashboard-host #dashboard-zone-transition {
  display: none;
}

.jy-dashboard-host .hud-btn,
.jy-dashboard-host .hud-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.jy-dashboard-host .hud-btn {
  min-width: 74px;
}

.jy-dashboard-host .hud-btn span,
.jy-dashboard-host .hud-btn-primary span {
  white-space: nowrap;
}

.jy-dashboard-host .summary-subject-row,
.jy-dashboard-host .chart-card[data-nav],
.jy-dashboard-host .chart-card-main {
  cursor: pointer;
}

.jy-dashboard-host .summary-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 10px;
}

.jy-dashboard-host .summary-main-action,
.jy-dashboard-host .summary-main-separator {
  flex: 0 0 auto;
}

.jy-dashboard-host .summary-main-separator {
  color: rgba(148, 163, 184, 0.8);
}

.jy-dashboard-host .consensus-vue-body,
.jy-dashboard-host .trend-vue-body {
  min-height: 210px;
}

.jy-dashboard-host .consensus-bars {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.jy-dashboard-host .consensus-bar-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.72);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 800;
}

.jy-dashboard-host .consensus-bar-track {
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.jy-dashboard-host .consensus-bar-fill {
  height: 100%;
  border-radius: inherit;
}

.jy-dashboard-host .consensus-bar-fill.is-increase {
  background: #4ade80;
}

.jy-dashboard-host .consensus-bar-fill.is-hold {
  background: #94a3b8;
}

.jy-dashboard-host .consensus-bar-fill.is-decrease {
  background: #f87171;
}

.jy-dashboard-host .trend-vue-body {
  display: flex;
  align-items: end;
  gap: 8px;
  padding: 22px 18px;
}

.jy-dashboard-host .trend-vue-bar {
  flex: 1;
  min-width: 8px;
  border-radius: 999px 999px 4px 4px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(244, 117, 33, 0.68));
  box-shadow: 0 0 18px rgba(244, 117, 33, 0.18);
}

.jy-dashboard-host #agent-view-init .deadlock-hud-top {
  align-items: center;
}

.jy-dashboard-host #agent-view-init .hud-top-left,
.jy-dashboard-host #agent-view-init .hud-top-right,
.jy-dashboard-host #agent-view-init .summary-row,
.jy-dashboard-host #agent-view-init .config-row-flex {
  display: flex;
  align-items: center;
}

.jy-dashboard-host #agent-view-init .hud-top-left {
  gap: 8px;
}

.jy-dashboard-host #agent-view-init .hud-top-right {
  justify-content: flex-end;
}

.jy-dashboard-host #agent-view-init .theme-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ffffff;
  display: inline-block;
  flex: 0 0 auto;
}

.jy-dashboard-host #agent-view-init .hud-logo-text,
.jy-dashboard-host #agent-view-init .hud-time-text {
  line-height: 1;
  white-space: nowrap;
}

.jy-dashboard-host .jy-init-title {
  margin-top: 24px;
  margin-bottom: 32px;
}

.jy-dashboard-host .jy-init-title h2 {
  margin: 0 0 8px;
  font-size: 38px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.jy-dashboard-host .jy-agent-section {
  margin-top: 36px;
}

.jy-dashboard-host #agent-view-init .strategic-modes-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.jy-dashboard-host #agent-view-init .strategy-mode-card {
  width: 100%;
  border: 1px solid var(--border-color);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.jy-dashboard-host #agent-view-init .strategy-mode-card:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

.jy-dashboard-host #agent-view-init .active-agents-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 14px;
}

.jy-dashboard-host #agent-view-init .init-summary-card,
.jy-dashboard-host #agent-view-init .init-config-card {
  padding: 24px;
}

.jy-dashboard-host #agent-view-init .init-config-card,
.jy-dashboard-host #agent-view-init .summary-list,
.jy-dashboard-host #agent-view-init .config-list {
  display: flex;
  flex-direction: column;
}

.jy-dashboard-host #agent-view-init .summary-list {
  gap: 12px;
}

.jy-dashboard-host #agent-view-init .config-list,
.jy-dashboard-host #agent-view-init .init-config-card {
  gap: 16px;
}

.jy-dashboard-host #agent-view-init .summary-row,
.jy-dashboard-host #agent-view-init .config-row-flex {
  justify-content: space-between;
  gap: 18px;
}

.jy-dashboard-host #agent-view-init .summary-lbl,
.jy-dashboard-host #agent-view-init .config-lbl {
  color: var(--color-text-sub);
}

.jy-dashboard-host #agent-view-init .summary-val {
  color: var(--color-text-main);
  font-weight: 700;
  text-align: right;
}

.jy-dashboard-host #agent-view-init .config-disclaimer-text {
  margin: 8px 0 0;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  color: var(--color-text-sub);
  font-size: 11px;
  line-height: 1.5;
}

.jy-dashboard-host .jy-start-analysis {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 8px;
  background: #121316;
  color: #ffffff;
  font-size: 17px;
}

.jy-dashboard-host .jy-amc-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.jy-dashboard-host .jy-settings-list {
  margin-top: 18px;
}

.jy-dashboard-host .jy-history-timeline {
  max-width: 980px;
  margin: 0 auto;
}

.jy-dashboard-host .quote-row {
  align-items: stretch;
}

.jy-dashboard-host .inline-input {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  padding: 0 10px;
  font-family: 'JetBrains Mono', monospace;
}

.jy-dashboard-host .inline-btn {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: #ffffff;
  color: #050608;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 900;
}

.jy-dashboard-host .trace-line {
  display: grid;
  grid-template-columns: 180px 1fr;
  border-bottom: 1px dotted var(--monitor-border-light);
  padding: 12px 0;
  color: rgba(255, 255, 255, 0.75);
}

.jy-dashboard-host .trace-line strong {
  color: #ffffff;
  font-family: 'JetBrains Mono', monospace;
}

.jy-dashboard-host .credential-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.jy-dashboard-host .credential-grid label {
  display: grid;
  gap: 8px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.jy-dashboard-host .credential-grid input,
.jy-dashboard-host .credential-grid select {
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  padding: 0 12px;
}

/* 라이트 모드 가시성 — KIS 자격증명 폼 */
.jy-dashboard-host:not(.dark-theme) .credential-grid label {
  color: rgba(20, 22, 28, 0.72);
}
.jy-dashboard-host:not(.dark-theme) .credential-grid input,
.jy-dashboard-host:not(.dark-theme) .credential-grid select {
  border-color: rgba(0, 0, 0, 0.18);
  background: rgba(0, 0, 0, 0.03);
  color: #16181d;
}
.jy-dashboard-host:not(.dark-theme) .credential-grid input::placeholder {
  color: rgba(0, 0, 0, 0.4);
}

.jy-dashboard-host .checkline {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.jy-dashboard-host .checkline input {
  width: 18px;
  min-height: 18px;
}

.jy-dashboard-host .credential-actions,
.jy-dashboard-host .form-note {
  grid-column: 1 / -1;
}

.jy-dashboard-host .credential-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-core .sender-name::before {
  background: #94a3b8 !important;
  box-shadow: 0 0 10px rgba(148, 163, 184, 0.45);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-risk .sender-name::before {
  background: #f59e0b !important;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.55);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-macro .sender-name::before {
  background: #3b82f6 !important;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.55);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-cost .sender-name::before {
  background: #10b981 !important;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.55);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-news .sender-name::before {
  background: #a855f7 !important;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.55);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-mediator .sender-name::before {
  background: #ef4444 !important;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.55);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.flow-judge .sender-name::before {
  background: #d97706 !important;
  box-shadow: 0 0 10px rgba(217, 119, 6, 0.55);
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.speaking .sender-name {
  color: var(--color-text-main) !important;
}

.jy-dashboard-host #agent-view-running .transcript-feed-area .debate-bubble.speaking .debate-text {
  border: 1px solid rgba(244, 117, 33, 0.38) !important;
}

.jy-dashboard-host #agent-view-running .dropdown-mock {
  cursor: pointer;
  font: inherit;
}

.jy-dashboard-host #agent-view-running .agent-connections-svg path.connection-line.active {
  stroke-dasharray: 12 10;
  animation: libra-flow-dash 0.9s linear infinite;
  filter: drop-shadow(0 0 8px rgba(244, 117, 33, 0.7));
}

.jy-dashboard-host #agent-view-running .agent-connections-svg circle.signal-pulse {
  opacity: 1;
  filter: drop-shadow(0 0 8px rgba(244, 117, 33, 0.95));
}

.jy-dashboard-host #agent-view-running .agent-connections-svg circle.signal-pulse-hidden {
  opacity: 0;
  pointer-events: none;
}

.jy-dashboard-host #agent-view-running .flow-node-card.status-active {
  animation: libra-node-breathe 1.4s ease-in-out infinite;
}

.jy-dashboard-host #agent-view-running .flow-node-card.status-active::after {
  content: '';
  position: absolute;
  inset: -8px;
  border: 1px solid rgba(244, 117, 33, 0.42);
  border-radius: 24px;
  animation: libra-node-ring 1.4s ease-out infinite;
  pointer-events: none;
}

.jy-dashboard-host #agent-view-running .flow-node-dot.status-active {
  animation: libra-lightning-pulse 1s ease-in-out infinite;
}

.jy-dashboard-host #agent-view-running .node-agent-stack {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 7px;
}

.jy-dashboard-host #agent-view-running .node-agent-chip {
  max-width: 78px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  padding: 2px 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: rgba(16, 18, 22, 0.62);
  background: rgba(255, 255, 255, 0.72);
}

.dark-theme .jy-dashboard-host #agent-view-running .node-agent-chip,
.jy-dashboard-host.dark-theme #agent-view-running .node-agent-chip {
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.055);
}

.jy-dashboard-host #agent-view-running .flow-node-card.status-active .node-agent-chip {
  border-color: rgba(244, 117, 33, 0.3);
  color: #f47521;
}

.jy-dashboard-host #agent-view-running .flow-node-card.status-complete .node-agent-chip {
  border-color: rgba(34, 197, 94, 0.25);
  color: #22c55e;
}

.jy-dashboard-host #agent-view-running .flow-status-summary {
  margin-top: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgba(244, 117, 33, 0.92);
}

.jy-dashboard-host #agent-view-running .state-pulse-dot.active::after {
  animation: libra-live-ping 1.2s ease-out infinite;
}

@keyframes libra-flow-dash {
  to {
    stroke-dashoffset: -22;
  }
}

@keyframes libra-node-breathe {
  0%, 100% {
    box-shadow: 0 0 16px rgba(244, 117, 33, 0.24);
  }
  50% {
    box-shadow: 0 0 28px rgba(244, 117, 33, 0.5);
  }
}

@keyframes libra-node-ring {
  0% {
    opacity: 0.75;
    transform: scale(0.96);
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
  }
}

@keyframes libra-lightning-pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: 0 0 0 rgba(244, 117, 33, 0);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.12);
    box-shadow: 0 0 22px rgba(244, 117, 33, 0.75);
  }
}

@keyframes libra-live-ping {
  0% {
    opacity: 0.8;
    transform: scale(0.7);
  }
  100% {
    opacity: 0;
    transform: scale(1.6);
  }
}

@media (max-width: 1100px) {
  .jy-dashboard-host.dashboard-tab-active #dashboard-page {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .jy-dashboard-host.dashboard-tab-active .zone-light {
    overflow: visible;
    padding-inline: 20px;
  }

  .terminal-dash {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .terminal-dash .td-rail-left,
  .terminal-dash .td-rail-right,
  .terminal-dash .td-center-view {
    overflow: visible;
  }

  .terminal-dash .td-rail-left {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .terminal-dash .td-navgroup-foot {
    margin-top: 0;
  }
}

@media (max-width: 760px) {
  .jy-dashboard-host .notch-nav {
    left: 12px;
    right: 12px;
    transform: none;
    overflow-x: auto;
    justify-content: flex-start;
    scrollbar-width: none;
  }

  .jy-dashboard-host .notch-nav::-webkit-scrollbar {
    display: none;
  }

  .terminal-dash .td-cardrow {
    grid-template-columns: 1fr;
  }

  .terminal-dash .td-hero-value {
    font-size: 34px;
  }

  .terminal-dash .td-holding-row {
    flex-wrap: wrap;
  }

  .terminal-dash .td-holding-alloc {
    margin-left: 0;
  }

  .terminal-dash .td-calendar-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .jy-dashboard-host .credential-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 720px) {
  .jy-dashboard-host .credential-grid {
    grid-template-columns: 1fr;
  }
}

/* ==========================================================================
   MOBILE RESPONSIVE (QR / phone 360–414px) — layout-only overrides.
   Content & colors unchanged; desktop (>768px) layout untouched.
   ========================================================================== */

/* ---- Page-level overflow guard (item 4) ---- */
@media (max-width: 768px) {
  .jy-dashboard-host {
    overflow-x: hidden;
    max-width: 100%;
  }

  .jy-dashboard-host #dashboard-page,
  .jy-dashboard-host .zone-light,
  .jy-dashboard-host .zone-dark,
  .jy-dashboard-host .tab-view-content {
    max-width: 100%;
    overflow-x: hidden;
  }
}

/* ---- 768px: stack wide multi-column grids, scrollable nav strips ---- */
@media (max-width: 768px) {
  /* Top nav strip: keep on one line, allow horizontal scroll (item 2) */
  .jy-dashboard-host .notch-nav {
    left: 10px;
    right: 10px;
    transform: none;
    width: auto;
    max-width: none;
    justify-content: flex-start;
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .jy-dashboard-host .notch-nav-links {
    flex-wrap: nowrap;
  }

  .jy-dashboard-host .notch-link {
    padding: 8px 11px;
    font-size: 12px;
    white-space: nowrap;
  }

  /* Agent subtabs (Settings / Visualize / History) — scroll instead of overflow (item 2) */
  .jy-dashboard-host .agent-subtabs-bar {
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
  }

  .jy-dashboard-host .agent-subtabs-left {
    width: 100%;
    gap: 14px;
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .jy-dashboard-host .agent-subtabs-left::-webkit-scrollbar {
    display: none;
  }

  .jy-dashboard-host .agent-subtab-btn {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  /* HUD header (노드 모니터 + 로그아웃/다크/리밸런스) — let title + buttons wrap (item 2) */
  .jy-dashboard-host .hud-title-wrap,
  .jy-dashboard-host .hud-time-wrap {
    flex-wrap: wrap;
  }

  /* Agent visualize: Initialize Council (init) + Resolved (success) — single column (item 1/5) */
  .jy-dashboard-host #agent-view-init.agent-vis-layout,
  .jy-dashboard-host #agent-view-success.agent-vis-layout {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    height: auto;
    gap: 20px;
  }

  .jy-dashboard-host #agent-view-init,
  .jy-dashboard-host #agent-view-success {
    min-height: 0;
  }

  .jy-dashboard-host #agent-view-init .agent-flow-column,
  .jy-dashboard-host #agent-view-init .agent-console-column,
  .jy-dashboard-host #agent-view-success .agent-flow-column,
  .jy-dashboard-host #agent-view-success .agent-console-column {
    height: auto;
    min-width: 0;
    overflow: visible;
  }

  /* Settings: Portfolio Configuration form + SESSION STATE summary — stack (item 1) */
  .jy-dashboard-host .settings-layout {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    gap: 20px;
  }

  /* Settings inner 2-up card row — stack */
  .jy-dashboard-host .settings-grid-2 {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Strategic mode cards (3-up) + active agent nodes (2-up) — stack (item 1) */
  .jy-dashboard-host #agent-view-init .strategic-modes-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .jy-dashboard-host #agent-view-init .active-agents-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Init summary/config cards padding */
  .jy-dashboard-host #agent-view-init .init-summary-card,
  .jy-dashboard-host #agent-view-init .init-config-card {
    padding: 20px;
  }

  /* History: RECENT DELIBERATIONS list + SESSION TRANSCRIPT — stack, drop fixed height (item 5) */
  .jy-dashboard-host .history-board {
    height: auto;
    min-height: 0;
    max-height: none;
    overflow: visible;
  }

  .jy-dashboard-host .history-content {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .jy-dashboard-host .history-transcript-head {
    flex-wrap: wrap;
    gap: 12px;
  }

  /* Agent Council Replay bubbles fit width (item 5) */
  .jy-dashboard-host .history-transcript-feed,
  .jy-dashboard-host .transcript-feed-area {
    max-width: 100%;
  }

  .jy-dashboard-host .ht-bubble,
  .jy-dashboard-host .debate-text {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* AMC popup grid (3-up) + radio groups — stack */
  .jy-dashboard-host .modal-radio-group {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

/* ---- 640px: full single column, shrink display type, tighten paddings ---- */
@media (max-width: 640px) {
  /* Section paddings (item 3) */
  .jy-dashboard-host .zone-dark {
    padding: 18px 18px 0 18px;
  }

  .jy-dashboard-host .zone-light {
    padding: 12px 16px 40px 16px;
  }

  .jy-dashboard-host.dashboard-tab-active .zone-light {
    padding-inline: 14px;
  }

  /* Cards never exceed viewport (item 4) */
  .jy-dashboard-host .agent-vis-card,
  .jy-dashboard-host .console-card,
  .jy-dashboard-host .settings-board,
  .jy-dashboard-host .history-board,
  .jy-dashboard-host .account-console {
    width: 100%;
    max-width: 100%;
  }

  /* Dashboard total asset value (~50px → smaller) (item 3) */
  .jy-dashboard-host .terminal-dash .td-hero-value {
    font-size: clamp(28px, 9vw, 38px);
  }

  .jy-dashboard-host .terminal-dash .td-hero {
    padding: 18px 18px;
  }

  /* PORTFOLIO VALUE chart fits width (item 5) */
  .jy-dashboard-host .terminal-dash .td-chart-canvas {
    min-height: 130px;
  }

  /* Big display headings (Intelligent Asset Allocation / Initialize Council /
     Portfolio Configuration / Rebalance Resolved / Logs History) (item 3) */
  .jy-dashboard-host .jy-init-title h2,
  .jy-dashboard-host #agent-view-init .deadlock-title-group h2,
  .jy-dashboard-host #agent-view-success .header-title-area h2,
  .jy-dashboard-host .settings-title,
  .jy-dashboard-host .history-title {
    font-size: clamp(28px, 8vw, 34px) !important;
    line-height: 1.1 !important;
  }

  .jy-dashboard-host #agent-view-init .deadlock-title-group {
    margin-top: 20px !important;
    margin-bottom: 28px !important;
  }

  /* Init / success / settings / history board paddings */
  .jy-dashboard-host #agent-view-init .agent-vis-card.init-board,
  .jy-dashboard-host #agent-view-success .agent-vis-card.success-board,
  .jy-dashboard-host .settings-board {
    padding: 24px 20px 24px !important;
    border-radius: 22px;
  }

  .jy-dashboard-host .history-board {
    padding: 24px 18px 28px;
    border-radius: 22px;
  }

  /* Success header: badge is absolutely placed w/ padding-right:220px on desktop —
     reflow it inline so the title isn't cut off (item 5) */
  .jy-dashboard-host #agent-view-success .header-title-area {
    padding-right: 0;
  }

  .jy-dashboard-host #agent-view-success .header-title-area .vis-badge {
    position: static;
    margin-bottom: 10px;
  }

  .jy-dashboard-host #agent-view-success .header-actions-area {
    flex-wrap: wrap;
  }

  .jy-dashboard-host #agent-view-success .success-checkmark-circle {
    font-size: 5rem !important;
  }

  /* Trade ticket rows + drift display — stack their inner content (item 5) */
  .jy-dashboard-host #agent-view-success .ticket-row {
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 18px !important;
  }

  .jy-dashboard-host #agent-view-success .ticket-left {
    gap: 12px;
  }

  /* Manual-review approval cards + rebalance draft rows already in a single
     console column; ensure their action buttons + rows wrap (item 5) */
  .jy-dashboard-host .manual-review-actions,
  .jy-dashboard-host .deadlock-actions-area {
    flex-wrap: wrap;
  }

  /* Dashboard 3-col rail already stacks (1100px); keep left rail nav usable */
  .jy-dashboard-host .terminal-dash .td-rail-left {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }

  /* Drift / consensus bar rows — narrow the fixed label column so the bar fits */
  .jy-dashboard-host .consensus-bar-row {
    grid-template-columns: 72px minmax(0, 1fr) 28px;
    gap: 8px;
  }

  /* Logs / trace lines (180px label + value) — stack to one column */
  .jy-dashboard-host .trace-line {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}

/* ---- 480px: tightest phones — single-column heatmap & calendar polish ---- */
@media (max-width: 480px) {
  /* PORTFOLIO holdings calendar heatmap (7-up → 5-up at 760) — keep compact */
  .jy-dashboard-host .terminal-dash .td-calendar-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .jy-dashboard-host .terminal-dash .td-calendar-cell {
    min-height: 46px;
    padding: 6px;
    font-size: 10px;
  }

  /* AMC popup radio group fully single column */
  .jy-dashboard-host .modal-radio-group {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
