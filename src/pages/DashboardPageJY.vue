<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { brokerApi } from '@/api/broker'
import type { RunStartBody } from '@/api/sse'
import { useAuthStore } from '@/stores/auth'
import { useRunStreamStore } from '@/stores/runStream'
import type {
  DecimalValue,
  KisBalance,
  KisCredentialRequest,
  KisOrderAudit,
  KisQuote,
  KisStatus,
  PortfolioSnapshot
} from '@/types/api'

type Level = 0 | 1 | 2 | 3 | 4
type Tone = 'positive' | 'danger' | 'neutral'
type DashboardTab = 'dashboard' | 'agent' | 'risk' | 'mypage'
type AgentSubtab = 'settings' | 'visualize' | 'history'
type AgentViewState = 'init' | 'running' | 'success' | 'deadlock'
type FlowNodeKey = 'core' | 'risk' | 'macro' | 'cost' | 'news' | 'mediator' | 'judge'
type StrategicModeKey = 'conservative' | 'balanced' | 'aggressive'

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

const router = useRouter()
const auth = useAuthStore()
const runStream = useRunStreamStore()

const status = ref<KisStatus | null>(null)
const balance = ref<KisBalance | null>(null)
const snapshots = ref<PortfolioSnapshot[]>([])
const audits = ref<KisOrderAudit[]>([])
const quote = ref<KisQuote | null>(null)
const quoteSymbol = ref('005930')
const marketCode = ref('J')
const activeTab = ref<DashboardTab>('dashboard')
const activeAgentSubtab = ref<AgentSubtab>('visualize')
const showAgentConsole = ref(false)
const transcriptFeedEl = ref<HTMLElement | null>(null)
const activeLanguage = ref<'KO' | 'EN'>('KO')
const isDarkTheme = ref(true)
const selectedStrategicMode = ref<StrategicModeKey>('balanced')
const riskScore = ref(5.5)

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

const visibleSummary = computed(() => balance.value?.summary ?? snapshots.value[0] ?? null)
const holdings = computed(() => balance.value?.holdings ?? [])
const totalValue = computed(() => toNumber(visibleSummary.value?.totalValuationAmount) ?? 0)
const totalProfit = computed(() => toNumber(visibleSummary.value?.profitLossAmount) ?? 0)
const totalProfitRate = computed(() => toNumber(visibleSummary.value?.profitLossRate) ?? 0)
const cashValue = computed(() => toNumber(visibleSummary.value?.depositAmount) ?? 0)
const cashWeight = computed(() => (totalValue.value > 0 ? cashValue.value / totalValue.value : 0))
const displayTotalValue = computed(() => (totalValue.value > 0 ? totalValue.value : DEMO_TOTAL_VALUE))
const displayTotalProfit = computed(() => (totalValue.value > 0 ? totalProfit.value : DEMO_TOTAL_PROFIT))
const hasExecutablePortfolio = computed(() => holdings.value.length > 0)
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

const heroValue = computed(() => formatMoney(displayTotalValue.value))
const profitClass = computed(() => (displayTotalProfit.value >= 0 ? 'positive' : 'danger'))
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
  if (runStream.phase === 'failed' || runStream.phase === 'interrupted') return 'deadlock'
  return 'init'
})

const latestStreamEvent = computed(() => [...runStream.timelineEvents].reverse()[0] ?? null)
const visibleTimelineEvents = computed(() => compactVisibleEvents(runStream.timelineEvents))
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
  return [
    { id: 'core', name: 'Core Council', meta: 'PRIMARY GOVERNANCE / ID: CORE-HUB', icon: 'ph-briefcase', tone: 'dark', status: flowNodeStatus('core') || 'status-active', confidence: '99.1%', action: activity.get('core') || 'Synthesizing committee inputs for the current portfolio.' },
    { id: 'risk', name: 'Risk Agent', meta: 'CONSTRAINT ENGINE / ID: RISK-04', icon: 'ph-shield-check', tone: 'yellow', status: flowNodeStatus('risk') || 'status-monitoring', confidence: '88.5%', action: activity.get('risk') || 'Checks concentration, volatility, drawdown, and liquidity constraints.' },
    { id: 'news', name: 'News Agent', meta: 'EVIDENCE LAYER / ID: NEWS-12', icon: 'ph-chat-circle-text', tone: 'pink', status: flowNodeStatus('news') || 'status-active', confidence: '82.0%', action: activity.get('news') || 'Reads article bodies, disclosure context, and event summaries.' },
    { id: 'report', name: 'Report Agent', meta: 'DOCUMENT EVIDENCE / ID: RPT-07', icon: 'ph-newspaper', tone: 'blue', status: 'status-active', confidence: '76.4%', action: activity.get('report') || 'Summarizes analyst and company report evidence when available.' },
    { id: 'cost', name: 'Cost Agent', meta: 'EXECUTION POLICY / ID: COST-09', icon: 'ph-receipt', tone: 'purple', status: flowNodeStatus('cost') || 'status-standby', confidence: '91.3%', action: activity.get('cost') || 'Estimates fees, turnover, and minimum executable trade size.' },
    { id: 'technical', name: 'Technical Agent', meta: 'PRICE FEATURES / ID: TECH-03', icon: 'ph-chart-line-up', tone: 'green', status: 'status-active', confidence: '84.8%', action: activity.get('technical') || 'Uses OHLCV momentum, volatility, drawdown, and liquidity features.' },
    { id: 'mediator', name: 'Mediator Judge', meta: 'CONFLICT RESOLUTION / ID: MED-01', icon: 'ph-scales', tone: 'green', status: flowNodeStatus('mediator') || 'status-standby', confidence: '92.4%', action: activity.get('mediator') || 'Reconciles conflicting agent mandates into one rebalance intent.' },
    { id: 'final', name: 'Final Judge', meta: 'FINAL APPROVAL / ID: JUDGE-01', icon: 'ph-gavel', tone: 'dark', status: flowNodeStatus('judge') || 'status-standby', confidence: '94.6%', action: activity.get('final_judge') || 'Approves HOLD, DEFER, REBALANCE, or manual review.' }
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
  return [
    { key: 'seed-core', sender: '코어 시스템', role: '대기', flow: 'core' as FlowNodeKey, flowLabel: 'CORE NODE', time: formatTime(new Date().toISOString()), text: '포트폴리오 점검을 시작할 준비가 되어 있습니다.', avatar: 'dark', speaking: false },
    { key: 'seed-risk', sender: '리스크 에이전트', role: '준비 완료', flow: 'risk' as FlowNodeKey, flowLabel: 'RISK NODE', time: formatTime(new Date().toISOString()), text: '실행하면 보유 종목, 가격 흐름, 공시·뉴스·리포트, 거래비용을 차례로 확인합니다.', avatar: 'yellow', speaking: false }
  ]
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

const driftRows = computed(() => {
  const demo = DEMO_PORTFOLIO.slice(0, 4).map((asset) => ({
    key: asset.key,
    label: asset.ticker,
    before: `${asset.weight.toFixed(1)}%`,
    after: `${asset.target.toFixed(1)}%`,
    width: Math.max(6, Math.min(100, asset.target))
  }))
  if (!holdings.value.length || totalValue.value <= 0) return demo
  return holdings.value.slice(0, 4).map((holding) => {
    const valuation = toNumber(holding.valuationAmount) ?? 0
    const weight = totalValue.value > 0 ? (valuation / totalValue.value) * 100 : 0
    return {
      key: holding.symbol,
      label: holding.name || holding.symbol,
      before: `${weight.toFixed(1)}%`,
      after: `${Math.min(30, Math.max(5, weight)).toFixed(1)}%`,
      width: Math.max(6, Math.min(100, weight))
    }
  })
})

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
    const events = [
      'RISK_EVAL_PASS [0x37BA]',
      'PORTFOLIO_SYNC_OK [0x11A4]',
      'COMPLIANCE_PASS [0x2F90]',
      'WEIGHTS_CALCULATED [0x55CC]',
      'LIMIT_CHECK_PASS [0x8D31]',
      'REST_API_PING [0x1AF0]',
      'WS_TICK_RCV [0x0A21]',
      'ORDER_SIMULATED [0x51F2]',
      'REBALANCE_NOT_REQUIRED [0x71DD]',
      'SEQ_INIT [0x02B4]'
    ]
    return events.map((event, index) => ({
      key: `demo-${index}`,
      time: formatTime(new Date(Date.now() - index * 18_000).toISOString()),
      label: event,
      detail: '',
      tone: 'neutral' as Tone
    }))
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
  const tasks: Promise<void>[] = [loadSnapshots()]
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
    const tasks: Promise<void>[] = [loadSnapshots()]
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
    pageNotice.value = 'KIS 잔고를 먼저 동기화해야 리밸런싱 판단을 실행할 수 있습니다.'
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
      approval_required: false,
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
    await Promise.allSettled([loadBalance(true), loadSnapshots(), loadAudits()])
  } catch (err) {
    pageError.value = errorMessage(err)
  }
}

function currentPortfolioPayload(): Record<string, unknown> {
  return {
    source: 'kis_live_balance',
    as_of: new Date().toISOString(),
    summary: visibleSummary.value,
    holdings: holdings.value.map((holding) => {
      const valuation = toNumber(holding.valuationAmount) ?? 0
      return {
        symbol: holding.symbol,
        name: holding.name,
        quantity: toNumber(holding.quantity),
        valuation_amount: valuation,
        weight: totalValue.value > 0 ? valuation / totalValue.value : null,
        profit_loss_amount: toNumber(holding.profitLossAmount),
        profit_loss_rate: toNumber(holding.profitLossRate)
      }
    })
  }
}

function currentGovernancePayload(): Record<string, unknown> {
  const mode = selectedStrategicModeConfig.value
  return {
    enabled: true,
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

function setAgentSubtab(tab: AgentSubtab) {
  activeAgentSubtab.value = tab
}

function setLanguage(language: 'KO' | 'EN') {
  activeLanguage.value = language
  pageNotice.value = language === 'KO' ? '한국어 화면으로 표시합니다.' : 'English UI preview is selected.'
  pageError.value = ''
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

function exportAgentLog() {
  const payload = {
    exported_at: new Date().toISOString(),
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
  switch (node) {
    case 'risk':
      return 'RISK NODE'
    case 'macro':
      return 'PROFIT NODE'
    case 'cost':
      return 'COST NODE'
    case 'news':
      return 'EVIDENCE NODE'
    case 'mediator':
      return 'MEDIATOR NODE'
    case 'judge':
      return 'FINAL JUDGE NODE'
    case 'core':
    default:
      return 'CORE NODE'
  }
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
  if (text.includes('risk') || text.includes('liquidity') || text.includes('technical') || text.includes('volatility') || text.includes('drawdown')) return 'risk'
  if (text.includes('macro') || text.includes('profit') || text.includes('fundamental') || text.includes('valuation') || text.includes('performance') || text.includes('return')) return 'macro'
  if (text.includes('cost') || text.includes('tax') || text.includes('execution') || text.includes('turnover') || text.includes('fee')) return 'cost'
  if (text.includes('news') || text.includes('report') || text.includes('sentiment') || text.includes('disclosure') || text.includes('article') || text.includes('evidence')) return 'news'
  if (text.includes('core') || text.includes('committee') || text.includes('compliance') || text.includes('round1') || text.includes('round_1') || text.includes('run_') || text.includes('node_')) return 'core'
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
  return event.replaceAll('_', '_').toUpperCase()
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

function summarizeToolObservation(tools: unknown[]): string {
  let eventCount = 0
  let documentCount = 0
  let refreshed = false
  const phases = new Set<string>()

  tools.forEach((tool) => {
    if (!tool || typeof tool !== 'object') return
    const record = tool as Record<string, unknown>
    const toolName = String(record.tool_name || '')
    const summary = String(record.summary || record.purpose || '')
    if (toolName.includes('load_events')) {
      const matched = summary.match(/(\d+)\s*건/)
      if (matched) eventCount += Number(matched[1])
    }
    if (toolName.includes('load_documents')) {
      const matched = summary.match(/(\d+)\s*건/)
      if (matched) documentCount += Number(matched[1])
    }
    if (toolName.includes('refresh') || toolName.includes('ingest')) refreshed = true
    if (toolName.includes('disclosure')) phases.add('공시')
    if (toolName.includes('news')) phases.add('뉴스')
    if (toolName.includes('report')) phases.add('리포트')
  })

  const parts: string[] = []
  if (eventCount > 0) parts.push(`관련 이벤트 ${eventCount}건`)
  if (documentCount > 0) parts.push(`관련 문서 ${documentCount}건`)
  if (parts.length) return `${parts.join(', ')}을 확인했습니다.`
  if (refreshed) return '최신 자료를 다시 수집해 확인했습니다.'
  if (phases.size) return `${Array.from(phases).join('·')} 자료를 확인했습니다.`
  return '포트폴리오 관련 근거 자료를 확인했습니다.'
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
    const reason = [
      data.reasoning,
      data.limits_acknowledged,
      data.opinion,
      data.verdict,
    ].find((item) => typeof item === 'string' && item.trim())
    if (!reason) return `${transcriptSender(event)} 검토가 완료되었습니다.`
    return simplifyDecisionReason(String(reason))
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
  return truncateText(text, 320)
}

function toUserFacingText(value: string): string {
  return value
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
  <div class="jy-dashboard-host" :class="{ 'dark-theme': isDarkTheme }">
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
      <div class="notch-lang-toggle" role="group" aria-label="Language">
        <button type="button" class="notch-lang-btn" :class="{ active: activeLanguage === 'KO' }" @click="setLanguage('KO')">KO</button>
        <button type="button" class="notch-lang-btn" :class="{ active: activeLanguage === 'EN' }" @click="setLanguage('EN')">EN</button>
      </div>
    </nav>

    <div class="zone-dark">
      <header class="hud-header">
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

      <div class="primary-vis-layout" :class="{ hidden: activeTab !== 'dashboard' }">
        <div>
          <span class="label">코어 사용량 (AUM 단위 x10M)</span>
          <div id="hero-value" class="dot-hero">{{ heroValue }}</div>
          <div class="core-sub-value">
            <div>
              <span class="label">총 자산 가치</span>
                <span id="val-total-assets" class="value">{{ formatKrw(displayTotalValue) }}</span>
            </div>
            <div>
              <span class="label">총 순이익</span>
              <span id="val-total-profit" class="value" :class="profitClass">
                {{ formatUnsignedKrw(displayTotalProfit) }}
              </span>
            </div>
          </div>
        </div>

        <div class="sensor-container">
          <div style="display: flex; justify-content: space-between;">
            <span class="label">메모리 매트릭스 (리밸런싱 이력)</span>
            <span id="mm-allocated-text" class="value">ALLOCATED / 192 DAYS</span>
          </div>
          <div id="sensorGrid" class="sensor-grid" aria-label="Memory matrix">
            <span
              v-for="node in memoryNodes"
              :key="node.key"
              class="sensor-node"
              :data-level="node.level"
              :title="node.key"
            />
          </div>
          <div class="mm-hud-summary">
            <div>
              <span class="label">총 횟수</span>
              <span id="mm-total-count" class="value">{{ memorySummary.count }}</span>
            </div>
            <div>
              <span class="label">최대 연속</span>
              <span id="mm-streak-count" class="value">{{ memorySummary.streak }}</span>
            </div>
            <div>
              <span class="label">최근 리밸런스</span>
              <span id="mm-last-date" class="value">{{ memorySummary.last }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="dashboard-zone-transition" class="zone-transition" :class="{ hidden: activeTab !== 'dashboard' }"></div>

    <div class="zone-light">
      <div id="tab-dashboard" class="tab-view-content" :class="{ hidden: activeTab !== 'dashboard' }">
        <div class="data-matrix">
          <div class="data-col">
            <div class="col-header">활성 포트폴리오</div>
            <ul id="holdings-table-body" class="data-list">
              <li v-for="row in holdingRows" :key="row.key" class="data-row" :class="row.tone">
                <span class="holding-badge">
                  <span class="holding-name">{{ row.name }}</span>
                  <span class="holding-ticker">{{ row.ticker }}</span>
                </span>
                <span class="row-val">{{ row.value }}</span>
              </li>
            </ul>
          </div>

          <div class="data-col">
            <div class="col-header">프로토콜 통합</div>
            <ul class="data-list">
              <li v-for="row in protocolRows" :key="row.key" class="data-row" :data-status="row.status">
                <span class="row-key">{{ row.key }}</span>
                <span class="row-val">{{ row.value }}</span>
              </li>
              <li class="data-row quote-row">
                <input v-model="quoteSymbol" class="inline-input" type="text" aria-label="Quote symbol" />
                <button type="button" class="inline-btn" :disabled="loading.quote" @click="loadQuote">
                  {{ loading.quote ? 'FETCH' : 'QUOTE' }}
                </button>
              </li>
              <li v-if="quote" class="data-row positive">
                <span class="row-key">{{ quote.name || quote.symbol }}</span>
                <span class="row-val">{{ formatKrw(quote.price) }} / {{ formatSignedPercent(quote.changeRate) }}</span>
              </li>
            </ul>
          </div>

          <div id="risk-anchor" class="data-col">
            <div class="col-header">규제 준수</div>
            <ul class="data-list">
              <li v-for="row in complianceRows" :key="row.key" class="data-row">
                <span class="row-key">{{ row.key }}</span>
                <span class="row-val">{{ row.value }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">COMMITTEE_STATE</span>
                <span class="row-val">{{ committeeState }}</span>
              </li>
              <li class="data-row">
                <span class="row-key">BROKER_STATE</span>
                <span class="row-val">{{ brokerLabel }}</span>
              </li>
            </ul>
          </div>

          <div class="data-col">
            <div class="col-header">자동 리밸런스 로그</div>
            <ul id="log-list" class="data-list log-list">
              <li v-for="row in logRows" :key="row.key" class="data-row" :class="row.tone">
                <span class="row-key">{{ row.time }} {{ row.label }}</span>
                <span v-if="row.detail" class="row-val">{{ row.detail }}</span>
              </li>
            </ul>
          </div>
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
                  <p>"The council separates evidence agents, mediator conflict resolution, final judge approval, and execution policy validation before any order is created."</p>
                </div>
              </div>
              <button type="button" class="btn-apply-settings" @click="applyAgentSettings">Apply Settings</button>
              <button type="button" class="btn-reset-default" @click="resetAgentSession">Reset Session</button>
              <p class="settings-disclaimer">Changing agent policy affects the next live analysis session only. Historical run logs remain immutable.</p>
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
                      <div class="agent-card-status"><span class="status-dot green"></span> Active</div>
                    </div>
                    <div class="active-agent-card readonly" data-agent="macro">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle blue"><i class="ph ph-globe-hemisphere-west"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">Macro Agent</h4>
                          <span class="agent-desc-display">Economic Indicators</span>
                        </div>
                      </div>
                      <div class="agent-card-status"><span class="status-dot green"></span> Active</div>
                    </div>
                    <div class="active-agent-card readonly" data-agent="tax">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle green"><i class="ph ph-receipt"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">Cost Agent</h4>
                          <span class="agent-desc-display">Fees & Turnover</span>
                        </div>
                      </div>
                      <div class="agent-card-status"><span class="status-dot green"></span> Active</div>
                    </div>
                    <div class="active-agent-card readonly" data-agent="sentiment">
                      <div class="agent-card-left">
                        <div class="agent-icon-circle purple"><i class="ph ph-chat-circle-dots"></i></div>
                        <div class="agent-card-info">
                          <h4 class="agent-name-display">News Agent</h4>
                          <span class="agent-desc-display">News & Disclosure</span>
                        </div>
                      </div>
                      <div class="agent-card-status"><span class="status-dot green"></span> Active</div>
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
                  <svg class="agent-connections-svg" id="agent-connections-svg" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
                    <path id="path-core-risk" class="connection-line" :class="{ active: isFlowPathActive('core-risk') }" d="M 500 92 C 500 115 150 105 150 130" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-risk') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-risk" /></animateMotion>
                    </circle>
                    <path id="path-core-macro" class="connection-line" :class="{ active: isFlowPathActive('core-macro') }" d="M 500 92 C 500 115 380 105 380 130" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-macro') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-macro" /></animateMotion>
                    </circle>
                    <path id="path-core-cost" class="connection-line" :class="{ active: isFlowPathActive('core-cost') }" d="M 500 92 C 500 115 620 105 620 130" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-cost') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-cost" /></animateMotion>
                    </circle>
                    <path id="path-core-news" class="connection-line" :class="{ active: isFlowPathActive('core-news') }" d="M 500 92 C 500 115 850 105 850 130" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('core-news') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-core-news" /></animateMotion>
                    </circle>

                    <path id="path-risk-med" class="connection-line" :class="{ active: isFlowPathActive('risk-med') }" d="M 150 224 C 150 260 500 225 500 260" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('risk-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-risk-med" /></animateMotion>
                    </circle>
                    <path id="path-macro-med" class="connection-line" :class="{ active: isFlowPathActive('macro-med') }" d="M 380 224 C 380 250 500 240 500 260" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('macro-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-macro-med" /></animateMotion>
                    </circle>
                    <path id="path-cost-med" class="connection-line" :class="{ active: isFlowPathActive('cost-med') }" d="M 620 224 C 620 250 500 240 500 260" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('cost-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-cost-med" /></animateMotion>
                    </circle>
                    <path id="path-news-med" class="connection-line" :class="{ active: isFlowPathActive('news-med') }" d="M 850 224 C 850 260 500 225 500 260" />
                    <circle r="4.5" fill="var(--color-accent, #ef4444)" :class="isFlowPathActive('news-med') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.8s" repeatCount="indefinite"><mpath href="#path-news-med" /></animateMotion>
                    </circle>

                    <path id="path-med-judge" class="connection-line" :class="{ active: isFlowPathActive('med-judge') }" d="M 500 352 C 500 372 500 372 500 390" />
                    <circle r="4.5" fill="var(--color-primary, #f47521)" :class="isFlowPathActive('med-judge') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#path-med-judge" /></animateMotion>
                    </circle>
                    <path id="path-judge-lightning" class="connection-line" :class="{ active: isFlowPathActive('judge-lightning') }" d="M 500 482 C 500 500 500 500 500 520" />
                    <circle r="4.5" fill="var(--color-primary, #f47521)" :class="isFlowPathActive('judge-lightning') ? 'signal-pulse' : 'signal-pulse-hidden'">
                      <animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#path-judge-lightning" /></animateMotion>
                    </circle>
                  </svg>
                  <div class="agent-nodes-layer">
                    <div id="node-agent-core" class="flow-node-card node-top" :class="flowNodeClass('core')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-briefcase node-icon"></i>
                      <div class="node-info">
                        <h4>CORE COUNCIL</h4>
                        <span class="node-status-text">Orchestrating</span>
                      </div>
                    </div>

                    <div class="flow-nodes-row">
                      <div id="node-agent-risk" class="flow-node-card node-middle" :class="flowNodeClass('risk')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-shield-check node-icon risk"></i>
                        <div class="node-info">
                          <h4>RISK AGENT</h4>
                          <span class="node-status-text">Risk & Liquidity</span>
                        </div>
                      </div>
                      <div id="node-agent-macro" class="flow-node-card node-middle" :class="flowNodeClass('macro')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-globe node-icon macro"></i>
                        <div class="node-info">
                          <h4>PROFIT AGENT</h4>
                          <span class="node-status-text">Return Signals</span>
                        </div>
                      </div>
                      <div id="node-agent-tax" class="flow-node-card node-middle" :class="flowNodeClass('cost')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-receipt node-icon tax"></i>
                        <div class="node-info">
                          <h4>COST AGENT</h4>
                          <span class="node-status-text">Turnover Gate</span>
                        </div>
                      </div>
                      <div id="node-agent-sentiment" class="flow-node-card node-middle" :class="flowNodeClass('news')">
                        <div class="node-glow-bg"></div>
                        <i class="ph-bold ph-chat-circle-text node-icon sentiment"></i>
                        <div class="node-info">
                          <h4>EVIDENCE NODE</h4>
                          <span class="node-status-text">News / Reports / DART</span>
                        </div>
                      </div>
                    </div>

                    <div id="node-agent-mediator" class="flow-node-card node-bottom-1" :class="flowNodeClass('mediator')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-scales node-icon mediator"></i>
                      <div class="node-info">
                        <h4>MEDIATOR JUDGE</h4>
                        <span class="node-status-text">Resolving Conflicts</span>
                      </div>
                    </div>

                    <div id="node-agent-judge" class="flow-node-card node-bottom-2" :class="flowNodeClass('judge')">
                      <div class="node-glow-bg"></div>
                      <i class="ph-bold ph-gavel node-icon judge"></i>
                      <div class="node-info">
                        <h4>FINAL JUDGE</h4>
                        <span class="node-status-text">Approving Strategy</span>
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
                  <span class="metric-label">TARGET ALLOC</span>
                  <div class="metric-val">{{ holdingRows.length }} ASSETS</div>
                  <span class="metric-sub">KIS live balance</span>
                </div>
                <div class="metric-mini-card">
                  <span class="metric-label">RISK SCORE</span>
                  <div class="metric-val text-orange">{{ totalProfitRate >= 0 ? 'WATCH' : 'RISK' }}</div>
                  <span class="metric-sub">Policy constraints</span>
                </div>
                <div class="metric-mini-card">
                  <span class="metric-label">REBALANCE</span>
                  <div class="metric-val">{{ committeeState }}</div>
                  <span class="metric-sub">Consensus</span>
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
                    <span class="vis-badge green"><i class="ph ph-shield-check"></i> system resolved</span>
                    <h2>Rebalance Resolved.</h2>
                    <p>The committee finished the live analysis and produced an executable decision trace.</p>
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
                    <span class="sub-section-lbl">APPROVED TRADE TICKETS</span>
                    <span class="verification-tag"><i class="ph ph-shield-check"></i> VERIFIED BY FINAL JUDGE</span>
                  </div>
                  <div class="tickets-list">
                    <div v-for="row in driftRows.slice(0, 2)" :key="row.key" class="ticket-row buy">
                      <div class="ticket-left">
                        <div class="direction-badge up"><i class="ph ph-arrow-up"></i></div>
                        <div class="ticket-info">
                          <h4>REVIEW {{ row.label }}</h4>
                          <span>{{ row.before }} → {{ row.after }}</span>
                        </div>
                      </div>
                      <div class="ticket-right">
                        <span class="val-amount">{{ row.after }}</span>
                        <span class="exec-broker">EXECUTION: POLICY GATED</span>
                      </div>
                    </div>
                  </div>
                  <div class="view-more-transactions">
                    <i class="ph ph-plus"></i> VIEW FULL DECISION TRACE
                  </div>
                </div>

                <div class="rationales-section">
                  <span class="sub-section-lbl">COUNCIL RATIONALES</span>
                  <div class="rationales-grid">
                    <div class="rationale-card">
                      <div class="rat-header"><div class="rat-icon risk"><i class="ph ph-shield-check"></i></div><span>RISK AGENT</span></div>
                      <p>Validated exposure limits, concentration policy, liquidity coverage, and drawdown state.</p>
                    </div>
                    <div class="rationale-card">
                      <div class="rat-header"><div class="rat-icon macro"><i class="ph ph-globe-hemisphere-west"></i></div><span>PROFIT AGENT</span></div>
                      <p>Compared recent performance and portfolio drift before authorizing a rebalance intent.</p>
                    </div>
                    <div class="rationale-card">
                      <div class="rat-header"><div class="rat-icon tax"><i class="ph ph-receipt"></i></div><span>COST AGENT</span></div>
                      <p>Checked turnover, trading cost, and minimum order constraints before execution.</p>
                    </div>
                    <div class="rationale-card">
                      <div class="rat-header"><div class="rat-icon sentiment"><i class="ph ph-chat-circle-text"></i></div><span>NEWS AGENT</span></div>
                      <p>Used article-body evidence and disclosure context as qualitative confirmation signals.</p>
                    </div>
                  </div>
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

          <div id="agent-view-deadlock" class="agent-vis-layout" :class="{ hidden: agentViewState !== 'deadlock' }">
            <div class="agent-flow-column">
              <div class="agent-vis-card deadlock-board">
                <div class="deadlock-hud-top">
                  <div class="hud-top-left">
                    <span class="hud-time-text">{{ agentClockText }}</span>
                    <span class="hud-status-dot"></span>
                    <span class="hud-logo-text">a.Rebalance</span>
                  </div>
                  <div class="hud-top-right">
                    <span class="hud-badge-gray">system diagnostics</span>
                    <span class="hud-badge-red">halted</span>
                  </div>
                </div>
                <div class="deadlock-title-group">
                  <h2>Consensus Deadlock.</h2>
                  <p class="deadlock-subtitle">{{ agentFailureSummary }}</p>
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
                      <div class="node-info"><h4>CORE COUNCIL</h4><span class="node-status-text red-txt">TIMEOUT</span></div>
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
                      <div class="node-info"><h4>MEDIATOR JUDGE</h4><span class="node-status-text red-txt">HALTED</span></div>
                    </div>
                  </div>
                </div>
                <div class="agent-flow-status-bar deadlock-status-bar">
                  <div class="status-phase"><span class="status-label red-txt">CURRENT STATUS</span><h3 class="red-txt">Awaiting Manual Override</h3></div>
                  <div class="status-time"><span class="status-label red-txt">HALTED SINCE</span><h3 class="red-txt">{{ agentSessionTimeLabel }}</h3></div>
                </div>
              </div>
            </div>
            <div class="agent-console-column">
              <div class="console-card conflict-alert-card">
                <div class="conflict-alert-header"><i class="ph-bold ph-warning-circle"></i><span>CONFLICT 042-B</span></div>
                <p>{{ agentFailureSummary }}</p>
              </div>
              <div class="console-card conflict-points-card">
                <div class="card-header-simple"><h3>CONFLICT POINTS</h3></div>
                <div class="conflict-points-list">
                  <div v-for="row in agentFailurePoints" :key="row.key" class="conflict-point-row">
                    <strong class="point-title">{{ row.sender }}</strong>
                    <p>{{ row.text }}</p>
                  </div>
                </div>
              </div>
              <div class="deadlock-actions-area">
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
                  <button v-for="row in logRows.slice(0, 3)" :key="row.key" type="button" class="history-session-card" @click="setAgentSubtab('visualize')">
                    <div class="hsc-top">
                      <span class="hsc-date">{{ row.time }}</span>
                      <span class="hsc-status" :class="row.tone === 'danger' ? 'aborted' : 'executed'">{{ row.tone.toUpperCase() }}</span>
                    </div>
                    <h3 class="hsc-title">{{ row.label }}</h3>
                    <div class="hsc-metrics">
                      <div class="hsc-metric"><span class="hsc-metric-lbl">DETAIL</span><strong class="hsc-metric-val">{{ row.detail || 'runtime' }}</strong></div>
                    </div>
                  </button>
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
                  <div v-for="row in agentTranscriptRows" :key="row.key" class="ht-entry">
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
                  <div class="amc-stat-box">
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
  background: #141517;
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
</style>
