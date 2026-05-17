<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
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
  PortfolioSnapshot,
  ProblemDetail
} from '@/types/api'
import type { RunEvent } from '@/types/events'

type AgentCompletedRunEvent = Extract<RunEvent, { event: 'agent_completed' }>
type RunNodeEvent = Extract<RunEvent, { event: 'node_started' | 'node_completed' }>

const router = useRouter()
const auth = useAuthStore()
const runStream = useRunStreamStore()

const status = ref<KisStatus | null>(null)
const balance = ref<KisBalance | null>(null)
const snapshots = ref<PortfolioSnapshot[]>([])
const audits = ref<KisOrderAudit[]>([])
const quote = ref<KisQuote | null>(null)
const quoteSymbol = ref('005930')
const credentialMessage = ref('')
const agentQuery = ref('현재 포트폴리오를 점검하고 유지/조정 필요성을 판단해줘.')
const agentMessage = ref('')

const credentialForm = reactive<KisCredentialRequest>({
  environment: 'PAPER',
  tradingEnabled: false,
  appKey: '',
  appSecret: '',
  accountNumber: '',
  accountProductCode: '01',
  htsId: ''
})

const loading = reactive({
  profile: false,
  credentials: false,
  status: false,
  balance: false,
  snapshots: false,
  audits: false,
  quote: false,
  agent: false
})

const errors = reactive({
  credentials: '',
  status: '',
  balance: '',
  snapshots: '',
  audits: '',
  quote: '',
  agent: ''
})

const latestSnapshot = computed(() => snapshots.value[0] ?? null)

const visibleSummary = computed(() => {
  if (balance.value) {
    return balance.value.summary
  }
  return latestSnapshot.value
})

const summaryCards = computed(() => [
  {
    label: '총 평가',
    value: visibleSummary.value?.totalValuationAmount,
    tone: 'default'
  },
  {
    label: '순자산',
    value: visibleSummary.value?.netAssetAmount,
    tone: 'default'
  },
  {
    label: '예수금',
    value: visibleSummary.value?.depositAmount,
    tone: 'default'
  },
  {
    label: '손익',
    value: visibleSummary.value?.profitLossAmount,
    tone: toneFor(visibleSummary.value?.profitLossAmount)
  }
])

const runStageDefinitions = [
  { node: 'compliance_before', label: 'Compliance', description: '사전 정책 검증' },
  { node: 'round1', label: 'Round 1', description: 'Core 에이전트 1차 의견' },
  { node: 'mediator', label: 'Mediator', description: '충돌 식별과 재호출 판단' },
  { node: 'final_judge', label: 'Final Judge', description: '최종 분기와 판단 생성' },
  { node: 'human_review', label: 'Human Review', description: '승인 또는 생략 처리' }
]

const runStartedEvent = computed(() => runStream.events.find((event) => event.event === 'run_started'))
const finalDecisionDraft = computed(() => {
  const event = [...runStream.events].reverse().find((item) => item.event === 'final_decision_draft')
  return event?.event === 'final_decision_draft' ? event.data : null
})
const lastJudgeAction = computed(() => {
  const event = [...runStream.events].reverse().find((item) => item.event === 'judge_action')
  return event?.event === 'judge_action' ? event.data : null
})
const humanReviewSkipped = computed(() => runStream.events.some((event) => event.event === 'human_review_skipped'))
const hasRunActivity = computed(() => runStream.timelineEvents.length > 0)

const runHeadline = computed(() => {
  if (runStream.phase === 'connecting') return '판단을 연결하고 있습니다'
  if (runStream.phase === 'streaming') return '에이전트들이 판단 중입니다'
  if (runStream.phase === 'interrupted') return '사용자 확인이 필요합니다'
  if (runStream.phase === 'completed') return '판단이 완료되었습니다'
  if (runStream.phase === 'failed') return '판단이 실패했습니다'
  if (runStream.phase === 'cancelled') return '판단이 중단되었습니다'
  if (runStream.phase === 'ignored') return '재개 요청이 무시되었습니다'
  return '포트폴리오 판단 대기'
})

const runSubtext = computed(() => {
  if (runStream.completion) {
    return [runStream.completion.decision, runStream.completion.branch, runStream.completion.run_status]
      .filter(Boolean)
      .join(' · ')
  }
  if (finalDecisionDraft.value?.summary) return finalDecisionDraft.value.summary
  if (runStream.pendingInterrupt) {
    return runStream.pendingInterrupt.message || runStream.pendingInterrupt.decision || '최종 결정 적용 전 확인이 필요합니다.'
  }
  if (runStartedEvent.value?.event === 'run_started') return runStartedEvent.value.data.query
  return '질문을 입력하고 판단 시작을 누르면 실제 SSE 이벤트가 이 화면에 반영됩니다.'
})

const runStageCards = computed(() => {
  const completedNodes = new Set(
    runStream.events
      .filter((event): event is RunNodeEvent => event.event === 'node_completed')
      .map((event) => event.data.node)
  )
  const startedNodes = new Set(
    runStream.events
      .filter((event): event is RunNodeEvent => event.event === 'node_started')
      .map((event) => event.data.node)
  )
  const activeNode = [...runStream.events]
    .reverse()
    .find(
      (event): event is RunNodeEvent =>
        event.event === 'node_started' && !completedNodes.has(event.data.node)
    )?.data.node

  return runStageDefinitions.map((stage) => {
    let status: 'pending' | 'active' | 'completed' = 'pending'
    if (completedNodes.has(stage.node) || (stage.node === 'human_review' && humanReviewSkipped.value)) {
      status = 'completed'
    } else if (activeNode === stage.node || startedNodes.has(stage.node)) {
      status = 'active'
    }
    return { ...stage, status }
  })
})

const runProgressPercent = computed(() => {
  if (!runStageCards.value.length) return 0
  const completed = runStageCards.value.filter((stage) => stage.status === 'completed').length
  return Math.round((completed / runStageCards.value.length) * 100)
})

const agentCompletedEvents = computed(() =>
  runStream.events.filter((event): event is AgentCompletedRunEvent => event.event === 'agent_completed')
)
const coreAgentCompletedEvents = computed(() =>
  agentCompletedEvents.value.filter((event) => event.data.layer === 'core')
)
const domainAgentCompletedEvents = computed(() =>
  agentCompletedEvents.value.filter((event) => event.data.layer === 'domain')
)
const otherAgentCompletedEvents = computed(() =>
  agentCompletedEvents.value.filter((event) => event.data.layer !== 'core' && event.data.layer !== 'domain')
)

const runTraceStats = computed(() => {
  const tools = runStream.events
    .filter((event) => event.event === 'tool_observation')
    .reduce((sum, event) => sum + (event.event === 'tool_observation' ? event.data.tools.length : 0), 0)
  return {
    events: runStream.timelineEvents.length,
    agents: agentCompletedEvents.value.length,
    tools,
    llmSkipped: runStream.events.filter((event) => event.event === 'llm_skipped').length
  }
})

onMounted(async () => {
  await loadInitial()
})

async function loadInitial() {
  loading.profile = true
  try {
    await auth.loadProfile()
  } catch {
    // 401 interceptor handles redirect.
  } finally {
    loading.profile = false
  }
  await Promise.allSettled([loadKisStatus(), loadSnapshots(), loadAudits()])
}

async function refreshAll() {
  await Promise.allSettled([loadKisStatus(), loadSnapshots(), loadAudits()])
}

async function loadKisStatus() {
  errors.status = ''
  loading.status = true
  try {
    const res = await brokerApi.kisStatus()
    status.value = res.data
    syncCredentialFormFromStatus()
  } catch (e) {
    errors.status = errorMessage(e, 'KIS 상태를 불러오지 못했습니다')
  } finally {
    loading.status = false
  }
}

function syncCredentialFormFromStatus() {
  if (!status.value) return
  credentialForm.environment = status.value.environment === 'prod' ? 'PROD' : 'PAPER'
  credentialForm.tradingEnabled = status.value.tradingEnabled
}

async function saveCredentials() {
  errors.credentials = ''
  credentialMessage.value = ''
  const payload: KisCredentialRequest = {
    ...credentialForm,
    appKey: credentialForm.appKey.trim(),
    appSecret: credentialForm.appSecret.trim(),
    accountNumber: credentialForm.accountNumber.trim(),
    accountProductCode: credentialForm.accountProductCode.trim(),
    htsId: credentialForm.htsId?.trim() || undefined
  }
  if (!payload.appKey || !payload.appSecret || !payload.accountNumber || !payload.accountProductCode) {
    errors.credentials = '필수 값을 입력하세요'
    return
  }
  loading.credentials = true
  try {
    await brokerApi.saveKisCredentials(payload)
    credentialForm.appKey = ''
    credentialForm.appSecret = ''
    credentialForm.htsId = ''
    credentialMessage.value = '저장됨'
    await loadKisStatus()
  } catch (e) {
    errors.credentials = errorMessage(e, 'KIS 키를 저장하지 못했습니다')
  } finally {
    loading.credentials = false
  }
}

async function deleteCredentials() {
  if (!window.confirm('등록된 KIS 키를 삭제할까요?')) return
  errors.credentials = ''
  credentialMessage.value = ''
  loading.credentials = true
  try {
    await brokerApi.deleteKisCredentials()
    credentialForm.appKey = ''
    credentialForm.appSecret = ''
    credentialForm.accountNumber = ''
    credentialForm.accountProductCode = '01'
    credentialForm.htsId = ''
    credentialForm.tradingEnabled = false
    credentialMessage.value = '삭제됨'
    await loadKisStatus()
  } catch (e) {
    errors.credentials = errorMessage(e, 'KIS 키를 삭제하지 못했습니다')
  } finally {
    loading.credentials = false
  }
}

async function loadBalance(saveSnapshot = true) {
  errors.balance = ''
  loading.balance = true
  try {
    const res = await brokerApi.kisBalance(saveSnapshot)
    balance.value = res.data
    if (saveSnapshot) {
      await loadSnapshots()
    }
  } catch (e) {
    errors.balance = errorMessage(e, '잔고를 불러오지 못했습니다')
  } finally {
    loading.balance = false
  }
}

async function loadSnapshots() {
  errors.snapshots = ''
  loading.snapshots = true
  try {
    const res = await brokerApi.portfolioSnapshots(20)
    snapshots.value = res.data
  } catch (e) {
    errors.snapshots = errorMessage(e, 'Snapshot을 불러오지 못했습니다')
  } finally {
    loading.snapshots = false
  }
}

async function loadAudits() {
  errors.audits = ''
  loading.audits = true
  try {
    const res = await brokerApi.orderAudits(20)
    audits.value = res.data
  } catch (e) {
    errors.audits = errorMessage(e, '주문 audit을 불러오지 못했습니다')
  } finally {
    loading.audits = false
  }
}

async function loadQuote() {
  const symbol = quoteSymbol.value.trim().toUpperCase()
  quoteSymbol.value = symbol
  quote.value = null
  errors.quote = ''
  if (!/^[A-Z0-9]{5,12}$/.test(symbol)) {
    errors.quote = '종목 코드를 확인하세요'
    return
  }
  loading.quote = true
  try {
    const res = await brokerApi.kisQuote(symbol)
    quote.value = res.data
  } catch (e) {
    errors.quote = errorMessage(e, '현재가를 불러오지 못했습니다')
  } finally {
    loading.quote = false
  }
}

async function startAgentRun() {
  errors.agent = ''
  agentMessage.value = ''
  loading.agent = true
  try {
    const portfolio = await currentAgentPortfolio()
    const body: RunStartBody = {
      query: agentQuery.value.trim() || '현재 포트폴리오를 점검해줘.',
      portfolio,
      trigger: 'user_request',
      depth: 'shallow',
      deadline_seconds: 300,
      approval_required: true,
      enable_human_interrupts: true
    }
    await runStream.start(body)
  } catch (e) {
    errors.agent = errorMessage(e, '에이전트 실행을 시작하지 못했습니다')
  } finally {
    loading.agent = false
  }
}

async function resumeAgent(approved: boolean, decision: 'APPROVE' | 'REJECT' | 'REVISE') {
  errors.agent = ''
  agentMessage.value = ''
  try {
    await runStream.resume({
      approved,
      decision,
      option_index: decision === 'APPROVE' ? 0 : decision === 'REJECT' ? 1 : 2,
      note: `frontend:${decision}`
    })
  } catch (e) {
    errors.agent = errorMessage(e, '에이전트 실행을 재개하지 못했습니다')
  }
}

async function currentAgentPortfolio() {
  if (balance.value) {
    return portfolioFromBalance(balance.value)
  }
  try {
    const latest = await brokerApi.latestPortfolioSnapshot()
    const parsed = JSON.parse(latest.data.snapshotJson) as KisBalance
    return portfolioFromBalance(parsed)
  } catch {
    throw new Error('먼저 잔고를 동기화하거나 snapshot을 만들어야 합니다')
  }
}

function portfolioFromBalance(source: KisBalance): Record<string, unknown> {
  const totalValue = toNumber(source.summary.totalValuationAmount)
    ?? toNumber(source.summary.netAssetAmount)
    ?? source.holdings.reduce((sum, item) => sum + (toNumber(item.valuationAmount) ?? 0), 0)
  const safeTotal = totalValue && totalValue > 0 ? totalValue : 1
  return {
    generated_at: new Date().toISOString(),
    total_value_krw: totalValue,
    cash_weight: Math.max(0, Math.min(1, (toNumber(source.summary.depositAmount) ?? 0) / safeTotal)),
    holdings: source.holdings
      .map((holding) => {
        const valuation = toNumber(holding.valuationAmount) ?? 0
        return {
          ticker: holding.symbol,
          company_name: holding.name || holding.symbol,
          weight: Math.max(0, Math.min(1, valuation / safeTotal)),
          aliases: [holding.symbol, holding.name].filter(Boolean),
          shares: toNumber(holding.quantity),
          last_price: toNumber(holding.currentPrice),
          average_price: toNumber(holding.averagePrice),
          market_value_krw: valuation,
          unrealized_pnl_krw: toNumber(holding.profitLossAmount)
        }
      })
      .filter((holding) => holding.ticker && (holding.weight > 0 || Number(holding.shares ?? 0) > 0)),
    user_preferences: ['모의투자 기준', '무리한 회전율 회피', '리스크 우선']
  }
}

function onLogout() {
  auth.logout()
  router.replace('/login')
}

function errorMessage(e: unknown, fallback: string) {
  if (axios.isAxiosError<ProblemDetail>(e)) {
    return e.response?.data?.detail || e.message || fallback
  }
  if (e instanceof Error) {
    return e.message
  }
  return fallback
}

function statusText() {
  if (!status.value) return '확인 전'
  if (!status.value.enabled) return '비활성'
  if (!status.value.restConfigured || !status.value.accountConfigured) return '설정 필요'
  return '연결됨'
}

function statusClass(ok: boolean | undefined) {
  if (ok) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-red-200 bg-red-50 text-red-700'
}

function boolLabel(value: boolean | undefined) {
  return value ? 'ON' : 'OFF'
}

function environmentLabel(value: string | undefined) {
  if (!value) return '-'
  return value === 'paper' ? '모의' : value
}

function credentialScopeLabel(value: string | undefined) {
  if (value === 'user') return '계정'
  if (value === 'server') return '서버'
  return '미등록'
}

function toNumber(value: DecimalValue | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(value: DecimalValue | undefined) {
  const parsed = toNumber(value)
  if (parsed === null) return '-'
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0
  }).format(parsed)
}

function formatQuantity(value: DecimalValue | undefined) {
  const parsed = toNumber(value)
  if (parsed === null) return '-'
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 4
  }).format(parsed)
}

function formatRate(value: DecimalValue | undefined) {
  const parsed = toNumber(value)
  if (parsed === null) return '-'
  return `${parsed.toFixed(2)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function toneFor(value: DecimalValue | undefined) {
  const parsed = toNumber(value)
  if (parsed === null || parsed === 0) return 'default'
  return parsed > 0 ? 'up' : 'down'
}

function toneClass(value: DecimalValue | undefined) {
  const tone = toneFor(value)
  if (tone === 'up') return 'text-emerald-700'
  if (tone === 'down') return 'text-red-700'
  return 'text-gray-900'
}

function statusPillClass(statusValue: KisOrderAudit['status']) {
  if (statusValue === 'SUBMITTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (statusValue === 'REJECTED') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (statusValue === 'FAILED') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-gray-200 bg-gray-50 text-gray-700'
}

function agentLabel(agentId: string | null | undefined) {
  const labels: Record<string, string> = {
    judge: 'Judge',
    mediator: 'Mediator',
    final_judge: 'Final Judge',
    disclosure: '공시',
    news: '뉴스',
    report: '리포트',
    profit: '수익',
    cost: '비용',
    risk: '리스크',
    tax: '세금',
    macro: '매크로',
    sentiment: '심리',
    execution: '실행',
    esg: 'ESG',
    liquidity: '유동성',
    technical: '기술'
  }
  if (!agentId) return 'Judge'
  return labels[agentId] ?? agentId
}

function phaseLabel(phase: string | null | undefined) {
  const labels: Record<string, string> = {
    agent_tool_loop: '도구 관찰',
    agent_response: '에이전트 응답',
    agent_response_repair: '에이전트 응답 보정',
    core_routing: 'Core 라우팅',
    core_routing_repair: 'Core 라우팅 보정',
    domain_routing: 'Domain 라우팅',
    domain_agent_response: 'Domain Agent 응답',
    domain_router_primary: 'Domain LLM 호출',
    domain_router_cross_validate: 'Domain 교차검증',
    round2_target_selection: 'Round 2 표적 선택',
    final_explanation: '최종 설명',
    final_decision_preliminary: '최종 판단',
    final_decision_final: '최종 판단'
  }
  if (!phase) return ''
  return labels[phase] ?? phase
}

function nodeLabel(node: string | null | undefined) {
  const labels: Record<string, string> = {
    compliance_before: '사전 컴플라이언스',
    round1: '1차 에이전트 의견',
    mediator: 'Mediator 조정',
    final_judge: '최종 Judge',
    human_review: '사용자 확인'
  }
  if (!node) return '노드'
  return labels[node] ?? node
}

function debateTitle(event: RunEvent) {
  switch (event.event) {
    case 'run_started':
      return '판단 시작'
    case 'node_started':
      return `${nodeLabel(event.data.node)} 시작`
    case 'node_completed':
      return `${nodeLabel(event.data.node)} 완료`
    case 'judge_action':
      return event.data.action === 'CALL_AGENT'
        ? `${agentLabel(event.data.agent_id)} 호출`
        : 'Judge 판단'
    case 'agent_started':
      return `${agentLabel(event.data.agent_id)} 분석 시작`
    case 'agent_completed':
      return `${agentLabel(event.data.agent_id)} 의견 제출`
    case 'agent_failed':
      return `${agentLabel(event.data.agent_id)} 실패`
    case 'tool_observation':
      return `${agentLabel(event.data.actor)} 도구 관찰`
    case 'llm_prompt':
      return `${agentLabel(event.data.actor)} 프롬프트 입력`
    case 'llm_response':
      return `${agentLabel(event.data.actor)} LLM 응답`
    case 'llm_error':
      return `${agentLabel(event.data.actor)} LLM 실패`
    case 'llm_skipped':
      if (event.data.phase === 'core_routing') return 'Core fast-path 적용'
      if (event.data.phase === 'final_decision_final') return 'Final decision fast-path 적용'
      return `${agentLabel(event.data.actor)} LLM 생략`
    case 'mediator_decision':
      return 'Mediator 조정'
    case 'consensus_updated':
      return '합의 갱신'
    case 'final_decision_draft':
      return '최종 판단 초안'
    case 'human_review_skipped':
      return '사용자 확인 생략'
    case 'interrupt_required':
      return '사용자 확인 필요'
    case 'resume_received':
      return '사용자 응답 수신'
    case 'resume_ignored':
      return '재개 무시'
    case 'run_completed':
      return '판단 완료'
    case 'run_failed':
      return '판단 실패'
    default:
      return '이벤트'
  }
}

function debateDetail(event: RunEvent) {
  switch (event.event) {
    case 'run_started':
      return event.data.query
    case 'node_started':
      return `${nodeLabel(event.data.node)} 단계에 진입했습니다.`
    case 'node_completed':
      return `${nodeLabel(event.data.node)} 단계가 끝났습니다.`
    case 'judge_action':
      return event.data.reason || event.data.query || event.data.action
    case 'agent_started':
      return event.data.query || event.data.depth || ''
    case 'agent_completed':
      return event.data.reasoning || event.data.limits_acknowledged || event.data.opinion || ''
    case 'agent_failed':
      return event.data.error
    case 'tool_observation':
      return `${event.data.tools.length}개 도구 관찰 결과를 LLM 컨텍스트에 반영했습니다.`
    case 'llm_prompt':
      return `${phaseLabel(event.data.phase)} 단계에서 ${event.data.model || 'LLM'}에 보낸 실제 입력입니다.`
    case 'llm_response':
      return `${phaseLabel(event.data.phase)} 단계에서 받은 원본 응답입니다.`
    case 'llm_error':
      return event.data.error
    case 'llm_skipped':
      return event.data.reason
    case 'mediator_decision':
      return event.data.rationale
    case 'final_decision_draft':
      return event.data.summary || event.data.reasoning || event.data.decision || ''
    case 'human_review_skipped':
      return event.data.message || event.data.reason || ''
    case 'consensus_updated':
      return '도메인 의견과 충돌 지표를 다시 계산했습니다.'
    case 'interrupt_required':
      return event.data.message || event.data.reason || event.data.decision || ''
    case 'resume_received':
      return event.data.approved ? '승인 응답을 agent에 전달했습니다.' : '거절/수정 응답을 agent에 전달했습니다.'
    case 'resume_ignored':
      return event.data.reason
    case 'run_completed':
      return event.data.approval_response?.note || event.data.run_status
    case 'run_failed':
      return event.data.error
    default:
      return ''
  }
}

function debateMeta(event: RunEvent) {
  if (event.event === 'run_started') {
    return [event.data.trigger, event.data.approval_required ? '사용자 확인 ON' : null].filter(Boolean).join(' · ')
  }
  if (event.event === 'node_started' || event.event === 'node_completed') {
    return event.data.node
  }
  if (event.event === 'agent_completed') {
    const confidence = typeof event.data.confidence === 'number'
      ? `${Math.round(event.data.confidence * 100)}%`
      : null
    return [event.data.layer, event.data.opinion, confidence].filter(Boolean).join(' · ')
  }
  if (event.event === 'judge_action') {
    return [event.data.layer, event.data.depth, event.data.response_count !== undefined ? `${event.data.response_count} 의견` : null]
      .filter(Boolean)
      .join(' · ')
  }
  if (event.event === 'final_decision_draft') {
    return [event.data.decision, event.data.urgency].filter(Boolean).join(' · ')
  }
  if (event.event === 'human_review_skipped') {
    return [event.data.decision, event.data.branch].filter(Boolean).join(' · ')
  }
  if (event.event === 'tool_observation') {
    return phaseLabel(event.data.phase)
  }
  if (event.event === 'llm_prompt' || event.event === 'llm_response' || event.event === 'llm_error') {
    return [phaseLabel(event.data.phase), event.data.model, event.data.tool_name].filter(Boolean).join(' · ')
  }
  if (event.event === 'llm_skipped') {
    return phaseLabel(event.data.phase)
  }
  if (event.event === 'interrupt_required') {
    return [event.data.decision, event.data.branch].filter(Boolean).join(' · ')
  }
  if (event.event === 'resume_received') {
    return event.data.option_index !== undefined && event.data.option_index !== null
      ? `option ${event.data.option_index}`
      : ''
  }
  if (event.event === 'run_completed') {
    return [event.data.decision, event.data.branch, event.data.run_status].filter(Boolean).join(' · ')
  }
  return ''
}

function debateToneClass(event: RunEvent) {
  if (event.event === 'run_failed' || event.event === 'agent_failed' || event.event === 'llm_error') return 'border-red-200 bg-red-50'
  if (event.event === 'interrupt_required') return 'border-amber-200 bg-amber-50'
  if (event.event === 'run_completed') return 'border-emerald-200 bg-emerald-50'
  if (event.event === 'human_review_skipped') return 'border-gray-200 bg-gray-50'
  if (event.event === 'llm_prompt') return 'border-violet-200 bg-violet-50'
  if (event.event === 'llm_response') return 'border-cyan-200 bg-cyan-50'
  if (event.event === 'llm_skipped') return 'border-gray-200 bg-gray-100'
  if (event.event === 'tool_observation') return 'border-indigo-200 bg-indigo-50'
  if (event.event === 'node_completed') return 'border-gray-200 bg-white'
  if (event.event === 'node_started' || event.event === 'run_started' || event.event === 'resume_received') return 'border-blue-200 bg-blue-50'
  if (event.event === 'final_decision_draft') return 'border-gray-900 bg-gray-50'
  if (event.event === 'agent_completed') return 'border-emerald-200 bg-emerald-50'
  if (event.event === 'agent_started') return 'border-blue-200 bg-blue-50'
  return 'border-gray-200 bg-white'
}

function stagePillClass(status: 'pending' | 'active' | 'completed') {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'active') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-gray-200 bg-gray-50 text-gray-400'
}

function stageDotClass(status: 'pending' | 'active' | 'completed') {
  if (status === 'completed') return 'bg-emerald-500 text-white'
  if (status === 'active') return 'bg-blue-500 text-white ring-4 ring-blue-100'
  return 'bg-gray-200 text-gray-400'
}

function decisionToneClass(decision: string | null | undefined) {
  if (!decision) return 'border-gray-200 bg-white text-gray-700'
  const normalized = decision.toUpperCase()
  if (normalized.includes('REBALANCE') || normalized.includes('APPROVE')) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (normalized.includes('USER_DECISION') || normalized.includes('REJECT')) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (normalized.includes('DEFER') || normalized.includes('HOLD')) return 'border-gray-200 bg-gray-50 text-gray-700'
  return 'border-gray-200 bg-white text-gray-700'
}

function agentSignalLabel(event: AgentCompletedRunEvent) {
  if (event.data.opinion) return event.data.opinion
  const direction = event.data.direction
  if (typeof direction !== 'number') return event.data.verdict || 'INFO'
  if (direction > 0.05) return 'BUY_BIAS'
  if (direction < -0.05) return 'SELL_BIAS'
  return 'NEUTRAL'
}

function agentSignalClass(event: AgentCompletedRunEvent) {
  const direction = event.data.direction ?? 0
  const opinion = (event.data.opinion || '').toUpperCase()
  if (direction > 0.05 || opinion.includes('BUY') || opinion.includes('INCREASE')) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (direction < -0.05 || opinion.includes('SELL') || opinion.includes('DECREASE')) return 'border-red-200 bg-red-50 text-red-700'
  return 'border-gray-200 bg-gray-50 text-gray-700'
}

function agentCardClass(event: AgentCompletedRunEvent) {
  const direction = event.data.direction ?? 0
  const opinion = (event.data.opinion || '').toUpperCase()
  if (direction > 0.05 || opinion.includes('BUY') || opinion.includes('INCREASE')) return 'border-blue-100 bg-blue-50/70'
  if (direction < -0.05 || opinion.includes('SELL') || opinion.includes('DECREASE')) return 'border-red-100 bg-red-50/70'
  return 'border-gray-200 bg-white'
}

function agentStrengthWidth(event: AgentCompletedRunEvent) {
  const strength = typeof event.data.strength === 'number' ? event.data.strength : Math.abs(event.data.direction ?? 0)
  return `${Math.max(4, Math.min(100, Math.round(strength * 100)))}%`
}

function agentConfidenceLabel(event: AgentCompletedRunEvent) {
  if (typeof event.data.confidence !== 'number') return '-'
  return `${Math.round(event.data.confidence * 100)}%`
}

function eventMarkerClass(event: RunEvent) {
  if (event.event === 'run_failed' || event.event === 'agent_failed' || event.event === 'llm_error') return 'bg-red-500'
  if (event.event === 'run_completed') return 'bg-emerald-500'
  if (event.event === 'interrupt_required') return 'bg-amber-500'
  if (event.event === 'final_decision_draft') return 'bg-gray-900'
  if (event.event === 'llm_skipped') return 'bg-gray-400'
  if (event.event === 'agent_completed') return 'bg-blue-500'
  return 'bg-gray-300'
}

function formatUnknown(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#f6f7f9] text-gray-950">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <h1 class="text-2xl font-semibold tracking-normal">Libra</h1>
          <p class="mt-1 text-sm text-gray-500">
            {{ auth.user?.email || '계정 확인 중' }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="h-9 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            :disabled="loading.status || loading.snapshots || loading.audits"
            @click="refreshAll"
          >
            새로고침
          </button>
          <button
            type="button"
            class="h-9 rounded bg-gray-900 px-3 text-sm text-white hover:bg-gray-800"
            @click="onLogout"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section class="grid gap-4 lg:grid-cols-4">
        <div class="rounded border border-gray-200 bg-white p-4">
          <p class="text-xs font-medium uppercase text-gray-500">KIS</p>
          <div class="mt-3 flex items-center justify-between">
            <p class="text-lg font-semibold">{{ statusText() }}</p>
            <span
              class="rounded border px-2 py-1 text-xs font-medium"
              :class="statusClass(status?.enabled && status?.restConfigured && status?.accountConfigured)"
            >
              {{ loading.status ? '확인 중' : environmentLabel(status?.environment) }}
            </span>
          </div>
          <p v-if="errors.status" class="mt-3 text-sm text-red-600">{{ errors.status }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-4 lg:col-span-3 sm:grid-cols-3 xl:grid-cols-7">
          <div>
            <p class="text-xs text-gray-500">REST</p>
            <p class="mt-1 text-sm font-semibold">{{ boolLabel(status?.restConfigured) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">계좌</p>
            <p class="mt-1 text-sm font-semibold">{{ boolLabel(status?.accountConfigured) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">주문전송</p>
            <p class="mt-1 text-sm font-semibold">{{ boolLabel(status?.tradingEnabled) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">WebSocket</p>
            <p class="mt-1 text-sm font-semibold">{{ boolLabel(status?.webSocketConfigured) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">최대수량</p>
            <p class="mt-1 text-sm font-semibold">{{ status?.maxOrderQuantity ?? '-' }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">최대금액</p>
            <p class="mt-1 text-sm font-semibold">{{ formatMoney(status?.maxOrderAmount) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">허용종목</p>
            <p class="mt-1 text-sm font-semibold">
              {{ status?.symbolAllowListEnabled ? `${status?.allowedSymbolsCount ?? 0}개` : '전체' }}
            </p>
          </div>
        </div>
      </section>

      <section class="mt-5 rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-5 py-5">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0">
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                  :class="runStream.isStreaming ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600'"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="runStream.isStreaming ? 'animate-pulse bg-blue-500' : 'bg-gray-400'"
                  ></span>
                  {{ runStream.phase }}
                </span>
                <span v-if="runStream.currentThreadId" class="font-mono text-xs text-gray-400">
                  {{ runStream.currentThreadId }}
                </span>
              </div>
              <h2 class="text-2xl font-semibold tracking-normal text-gray-950">{{ runHeadline }}</h2>
              <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{{ runSubtext }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-if="runStream.isStreaming"
                type="button"
                class="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
                @click="runStream.cancel"
              >
                중단
              </button>
              <button
                type="button"
                class="h-9 rounded-md bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                :disabled="loading.agent || runStream.isStreaming"
                @click="startAgentRun"
              >
                판단 시작
              </button>
            </div>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p class="text-xs text-gray-500">이벤트</p>
              <p class="mt-1 text-xl font-semibold font-mono text-gray-950">{{ runTraceStats.events }}</p>
            </div>
            <div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p class="text-xs text-gray-500">에이전트 의견</p>
              <p class="mt-1 text-xl font-semibold font-mono text-gray-950">{{ runTraceStats.agents }}</p>
            </div>
            <div class="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p class="text-xs text-gray-500">도구 관찰</p>
              <p class="mt-1 text-xl font-semibold font-mono text-gray-950">{{ runTraceStats.tools }}</p>
            </div>
            <div class="rounded-lg border p-3" :class="decisionToneClass(finalDecisionDraft?.decision || runStream.completion?.decision)">
              <p class="text-xs opacity-75">최종 판단</p>
              <p class="mt-1 text-xl font-semibold">
                {{ finalDecisionDraft?.decision || runStream.completion?.decision || '-' }}
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div class="space-y-4">
            <label class="block">
              <span class="text-xs font-medium text-gray-500">요청</span>
              <textarea
                v-model="agentQuery"
                rows="5"
                class="mt-1 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-gray-900 focus:outline-none"
              />
            </label>
            <p v-if="errors.agent" class="text-sm text-red-600">{{ errors.agent }}</p>

            <div class="rounded-lg border border-gray-200 bg-white p-4">
              <div class="mb-4 flex items-center justify-between">
                <span class="text-xs font-medium tracking-wider text-gray-500">진행 단계</span>
                <span class="font-mono text-xs text-gray-400">{{ runProgressPercent }}%</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="(stage, index) in runStageCards"
                  :key="stage.node"
                  class="flex items-start gap-3 rounded-lg border px-3 py-3"
                  :class="stagePillClass(stage.status)"
                >
                  <div class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" :class="stageDotClass(stage.status)">
                    <svg
                      v-if="stage.status === 'completed'"
                      class="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span v-else>{{ index + 1 }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold">{{ stage.label }}</p>
                    <p class="mt-0.5 text-xs opacity-75">{{ stage.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="runStream.pendingInterrupt" class="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p class="text-sm font-semibold text-amber-900">사용자 확인 필요</p>
              <p class="mt-2 text-sm leading-6 text-amber-800">
                {{ runStream.pendingInterrupt.message || runStream.pendingInterrupt.decision || '최종 결정 적용 전 확인이 필요합니다.' }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="h-8 rounded-md bg-gray-900 px-3 text-xs text-white hover:bg-gray-800"
                  @click="resumeAgent(true, 'APPROVE')"
                >
                  승인
                </button>
                <button
                  type="button"
                  class="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
                  @click="resumeAgent(false, 'REJECT')"
                >
                  거절
                </button>
                <button
                  type="button"
                  class="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
                  @click="resumeAgent(false, 'REVISE')"
                >
                  수정 요청
                </button>
              </div>
            </div>

            <div v-if="runStream.completion" class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p class="text-xs text-gray-500">완료 결과</p>
              <p class="mt-1 text-base font-semibold text-gray-950">
                {{ runStream.completion.decision || '-' }}
                <span class="ml-2 text-sm font-normal text-gray-500">{{ runStream.completion.branch }}</span>
              </p>
            </div>
          </div>

          <div class="space-y-5">
            <div v-if="!hasRunActivity" class="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
              판단을 시작하면 실제 Core 라우팅, 에이전트 의견, 최종 판단 이벤트가 이 화면에 표시됩니다.
            </div>

            <div v-else class="space-y-5">
              <div class="grid gap-4 lg:grid-cols-2">
                <section class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div class="mb-3 flex items-baseline justify-between">
                    <h3 class="text-xs font-semibold tracking-[0.14em] text-gray-700">CORE</h3>
                    <span class="text-xs text-gray-400">{{ coreAgentCompletedEvents.length }} 의견</span>
                  </div>
                  <div v-if="!coreAgentCompletedEvents.length" class="rounded-md border border-dashed border-gray-200 bg-white px-3 py-8 text-center text-sm text-gray-400">
                    아직 Core 의견이 없습니다.
                  </div>
                  <div v-else class="grid gap-3 sm:grid-cols-2">
                    <article
                      v-for="event in coreAgentCompletedEvents"
                      :key="`${event.data.agent_id}-${event.data.turn_number}`"
                      class="rounded-lg border p-3"
                      :class="agentCardClass(event)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-semibold text-gray-950">{{ agentLabel(event.data.agent_id) }}</p>
                          <p class="mt-1 text-xs text-gray-500">{{ event.data.verdict || event.data.urgency || '-' }}</p>
                        </div>
                        <span class="rounded-full border px-2 py-0.5 text-[11px] font-medium" :class="agentSignalClass(event)">
                          {{ agentSignalLabel(event) }}
                        </span>
                      </div>
                      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                        <div class="h-full rounded-full bg-gray-900" :style="{ width: agentStrengthWidth(event) }"></div>
                      </div>
                      <p class="mt-3 line-clamp-3 text-xs leading-5 text-gray-700">
                        {{ event.data.reasoning || event.data.limits_acknowledged || '-' }}
                      </p>
                      <div class="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                        <span>confidence {{ agentConfidenceLabel(event) }}</span>
                        <span>{{ event.data.risk_level || event.data.layer || '' }}</span>
                      </div>
                    </article>
                  </div>
                </section>

                <section class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div class="mb-3 flex items-baseline justify-between">
                    <h3 class="text-xs font-semibold tracking-[0.14em] text-gray-700">DOMAIN</h3>
                    <span class="text-xs text-gray-400">{{ domainAgentCompletedEvents.length }} 의견</span>
                  </div>
                  <div v-if="!domainAgentCompletedEvents.length" class="rounded-md border border-dashed border-gray-200 bg-white px-3 py-8 text-center text-sm text-gray-400">
                    도메인 심의 대상이 없거나 아직 호출되지 않았습니다.
                  </div>
                  <div v-else class="grid gap-3 sm:grid-cols-2">
                    <article
                      v-for="event in domainAgentCompletedEvents"
                      :key="`${event.data.agent_id}-${event.data.turn_number}`"
                      class="rounded-lg border p-3"
                      :class="agentCardClass(event)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-semibold text-gray-950">{{ agentLabel(event.data.agent_id) }}</p>
                          <p class="mt-1 text-xs text-gray-500">{{ event.data.verdict || event.data.urgency || '-' }}</p>
                        </div>
                        <span class="rounded-full border px-2 py-0.5 text-[11px] font-medium" :class="agentSignalClass(event)">
                          {{ agentSignalLabel(event) }}
                        </span>
                      </div>
                      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                        <div class="h-full rounded-full bg-gray-900" :style="{ width: agentStrengthWidth(event) }"></div>
                      </div>
                      <p class="mt-3 line-clamp-3 text-xs leading-5 text-gray-700">
                        {{ event.data.reasoning || event.data.limits_acknowledged || '-' }}
                      </p>
                      <div class="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                        <span>confidence {{ agentConfidenceLabel(event) }}</span>
                        <span>{{ event.data.risk_level || event.data.layer || '' }}</span>
                      </div>
                    </article>
                  </div>
                </section>
              </div>

              <section v-if="otherAgentCompletedEvents.length" class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div class="mb-3 flex items-baseline justify-between">
                  <h3 class="text-xs font-semibold tracking-[0.14em] text-gray-700">OTHER</h3>
                  <span class="text-xs text-gray-400">{{ otherAgentCompletedEvents.length }} 의견</span>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <article
                    v-for="event in otherAgentCompletedEvents"
                    :key="`${event.data.agent_id}-${event.data.turn_number}`"
                    class="rounded-lg border p-3"
                    :class="agentCardClass(event)"
                  >
                    <p class="text-sm font-semibold text-gray-950">{{ agentLabel(event.data.agent_id) }}</p>
                    <p class="mt-2 text-xs leading-5 text-gray-700">{{ event.data.reasoning || event.data.limits_acknowledged || '-' }}</p>
                  </article>
                </div>
              </section>

              <section class="rounded-lg border border-gray-200 bg-white">
                <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-950">실시간 판단 로그</h3>
                    <p class="mt-1 text-xs text-gray-500">원본 LLM 입출력과 도구 관찰은 펼쳐서 확인합니다.</p>
                  </div>
                  <span v-if="lastJudgeAction?.action" class="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    {{ lastJudgeAction.action }}
                  </span>
                </div>
                <ol class="max-h-[720px] space-y-3 overflow-auto bg-gray-50 p-3">
                  <li
                    v-for="(event, index) in runStream.timelineEvents"
                    :key="`${event.event}-${index}`"
                    class="rounded-lg border bg-white p-3"
                    :class="debateToneClass(event)"
                  >
                    <div class="flex gap-3">
                      <span class="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" :class="eventMarkerClass(event)"></span>
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <p class="text-sm font-semibold">{{ debateTitle(event) }}</p>
                          <p v-if="debateMeta(event)" class="text-xs text-gray-500">{{ debateMeta(event) }}</p>
                        </div>
                        <p v-if="debateDetail(event)" class="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {{ debateDetail(event) }}
                        </p>
                        <div v-if="event.event === 'tool_observation'" class="mt-3 space-y-2">
                          <div
                            v-for="(tool, toolIndex) in event.data.tools"
                            :key="`${tool.tool_name}-${toolIndex}`"
                            class="rounded-md border border-gray-100 bg-white px-3 py-2 text-xs text-gray-700"
                          >
                            <p class="font-semibold text-gray-900">{{ tool.tool_name }}</p>
                            <p v-if="tool.purpose" class="mt-1">{{ tool.purpose }}</p>
                            <p v-if="tool.summary" class="mt-1 whitespace-pre-wrap">{{ tool.summary }}</p>
                          </div>
                        </div>
                        <div v-if="event.event === 'llm_prompt'" class="mt-3 space-y-3">
                          <details class="rounded-md border border-gray-100 bg-white">
                            <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">System prompt</summary>
                            <pre class="max-h-[360px] overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-gray-800">{{ event.data.system_prompt }}</pre>
                          </details>
                          <details class="rounded-md border border-gray-100 bg-white">
                            <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">User prompt</summary>
                            <pre class="max-h-[520px] overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-gray-800">{{ event.data.user_prompt }}</pre>
                          </details>
                          <details v-if="event.data.input_schema" class="rounded-md border border-gray-100 bg-white">
                            <summary class="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">Tool schema</summary>
                            <pre class="max-h-[300px] overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-5 text-gray-800">{{ formatUnknown(event.data.input_schema) }}</pre>
                          </details>
                        </div>
                        <div v-if="event.event === 'llm_response'" class="mt-3">
                          <pre class="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-gray-100 bg-white p-3 text-xs leading-5 text-gray-800">{{ formatUnknown(event.data.output) }}</pre>
                        </div>
                        <div v-if="event.event === 'llm_skipped' && event.data.context" class="mt-3">
                          <pre class="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-md border border-gray-100 bg-white p-3 text-xs leading-5 text-gray-800">{{ formatUnknown(event.data.context) }}</pre>
                        </div>
                        <div v-if="event.event === 'agent_completed' && event.data.focus_tickers?.length" class="mt-2 flex flex-wrap gap-1">
                          <span
                            v-for="ticker in event.data.focus_tickers"
                            :key="ticker"
                            class="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600"
                          >
                            {{ ticker }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                </ol>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-5 rounded border border-gray-200 bg-white">
        <div class="flex flex-col gap-2 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-semibold">KIS API 키</h2>
            <p class="mt-1 text-sm text-gray-500">
              {{ credentialScopeLabel(status?.credentialScope) }}
              <span v-if="status?.maskedAccountNumber"> · {{ status.maskedAccountNumber }}</span>
              <span v-if="status?.maskedAppKey"> · {{ status.maskedAppKey }}</span>
            </p>
          </div>
          <span
            class="w-fit rounded border px-2 py-1 text-xs font-medium"
            :class="statusClass(status?.registered && status?.restConfigured && status?.accountConfigured)"
          >
            {{ status?.registered ? '등록됨' : '미등록' }}
          </span>
        </div>

        <form class="grid gap-3 p-4 lg:grid-cols-6" autocomplete="off" @submit.prevent="saveCredentials">
          <label class="block lg:col-span-1">
            <span class="text-xs text-gray-500">환경</span>
            <select
              v-model="credentialForm.environment"
              class="mt-1 h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="PAPER">모의</option>
              <option value="PROD">실전</option>
            </select>
          </label>
          <label class="block lg:col-span-1">
            <span class="text-xs text-gray-500">계좌번호</span>
            <input
              v-model="credentialForm.accountNumber"
              inputmode="numeric"
              maxlength="12"
              class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="12345678"
            />
          </label>
          <label class="block lg:col-span-1">
            <span class="text-xs text-gray-500">상품코드</span>
            <input
              v-model="credentialForm.accountProductCode"
              inputmode="numeric"
              maxlength="2"
              class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="01"
            />
          </label>
          <label class="block lg:col-span-1">
            <span class="text-xs text-gray-500">App Key</span>
            <input
              v-model="credentialForm.appKey"
              type="password"
              class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none"
            />
          </label>
          <label class="block lg:col-span-1">
            <span class="text-xs text-gray-500">App Secret</span>
            <input
              v-model="credentialForm.appSecret"
              type="password"
              class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none"
            />
          </label>
          <label class="block lg:col-span-1">
            <span class="text-xs text-gray-500">HTS ID</span>
            <input
              v-model="credentialForm.htsId"
              class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none"
            />
          </label>

          <div class="flex flex-col gap-3 lg:col-span-6 sm:flex-row sm:items-center sm:justify-between">
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input v-model="credentialForm.tradingEnabled" type="checkbox" class="h-4 w-4 rounded border-gray-300" />
              주문전송 허용
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <span v-if="credentialMessage" class="text-sm text-emerald-700">{{ credentialMessage }}</span>
              <span v-if="errors.credentials" class="text-sm text-red-600">{{ errors.credentials }}</span>
              <button
                type="button"
                class="h-9 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                :disabled="loading.credentials || !status?.registered"
                @click="deleteCredentials"
              >
                삭제
              </button>
              <button
                type="submit"
                class="h-9 rounded bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                :disabled="loading.credentials"
              >
                저장
              </button>
            </div>
          </div>
        </form>
      </section>

      <section class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div class="rounded border border-gray-200 bg-white">
          <div class="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-semibold">Portfolio</h2>
              <p class="mt-1 text-sm text-gray-500">
                {{ balance?.snapshotId ? `snapshot ${balance.snapshotId.slice(0, 8)}` : latestSnapshot ? `latest ${latestSnapshot.id.slice(0, 8)}` : 'snapshot 없음' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="h-9 rounded bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                :disabled="loading.balance"
                @click="loadBalance(true)"
              >
                잔고 동기화
              </button>
              <button
                type="button"
                class="h-9 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                :disabled="loading.balance"
                @click="loadBalance(false)"
              >
                조회만
              </button>
            </div>
          </div>

          <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="card in summaryCards"
              :key="card.label"
              class="rounded border border-gray-200 bg-gray-50 p-3"
            >
              <p class="text-xs text-gray-500">{{ card.label }}</p>
              <p class="mt-2 text-lg font-semibold" :class="card.tone === 'up' ? 'text-emerald-700' : card.tone === 'down' ? 'text-red-700' : 'text-gray-950'">
                {{ formatMoney(card.value) }}
              </p>
            </div>
          </div>

          <p v-if="errors.balance" class="px-4 pb-3 text-sm text-red-600">{{ errors.balance }}</p>

          <div class="overflow-x-auto border-t border-gray-200">
            <table class="min-w-[820px] w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th class="px-4 py-3 font-medium">종목</th>
                  <th class="px-4 py-3 text-right font-medium">수량</th>
                  <th class="px-4 py-3 text-right font-medium">주문가능</th>
                  <th class="px-4 py-3 text-right font-medium">평균가</th>
                  <th class="px-4 py-3 text-right font-medium">현재가</th>
                  <th class="px-4 py-3 text-right font-medium">평가금액</th>
                  <th class="px-4 py-3 text-right font-medium">손익률</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="!balance?.holdings.length">
                  <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    아직 조회된 잔고가 없습니다.
                  </td>
                </tr>
                <tr v-for="holding in balance?.holdings" :key="holding.symbol" class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <p class="font-medium">{{ holding.symbol }}</p>
                    <p class="text-xs text-gray-500">{{ holding.name || '-' }}</p>
                  </td>
                  <td class="px-4 py-3 text-right">{{ formatQuantity(holding.quantity) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatQuantity(holding.orderableQuantity) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatMoney(holding.averagePrice) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatMoney(holding.currentPrice) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatMoney(holding.valuationAmount) }}</td>
                  <td class="px-4 py-3 text-right font-medium" :class="toneClass(holding.profitLossRate)">
                    {{ formatRate(holding.profitLossRate) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="space-y-5">
          <section class="rounded border border-gray-200 bg-white">
            <div class="border-b border-gray-200 px-4 py-4">
              <h2 class="text-base font-semibold">Quote</h2>
            </div>
            <form class="flex gap-2 p-4" @submit.prevent="loadQuote">
              <input
                v-model="quoteSymbol"
                maxlength="12"
                class="h-9 min-w-0 flex-1 rounded border border-gray-300 px-3 text-sm uppercase focus:border-gray-900 focus:outline-none"
                placeholder="005930"
              />
              <button
                type="submit"
                class="h-9 rounded bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                :disabled="loading.quote"
              >
                조회
              </button>
            </form>
            <div class="px-4 pb-4">
              <p v-if="errors.quote" class="text-sm text-red-600">{{ errors.quote }}</p>
              <div v-else-if="quote" class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-semibold">{{ quote.name || quote.symbol }}</p>
                    <p class="text-xs text-gray-500">{{ quote.symbol }} · {{ quote.marketCode }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-semibold">{{ formatMoney(quote.price) }}</p>
                    <p class="text-sm" :class="toneClass(quote.change)">
                      {{ formatMoney(quote.change) }} / {{ formatRate(quote.changeRate) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded border border-gray-200 bg-white">
            <div class="flex items-center justify-between border-b border-gray-200 px-4 py-4">
              <h2 class="text-base font-semibold">Snapshots</h2>
              <button
                type="button"
                class="h-8 rounded border border-gray-300 px-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                :disabled="loading.snapshots"
                @click="loadSnapshots"
              >
                새로고침
              </button>
            </div>
            <p v-if="errors.snapshots" class="px-4 pt-3 text-sm text-red-600">{{ errors.snapshots }}</p>
            <div class="divide-y divide-gray-100">
              <div v-if="!snapshots.length" class="px-4 py-6 text-sm text-gray-500">
                저장된 snapshot이 없습니다.
              </div>
              <div v-for="snapshot in snapshots" :key="snapshot.id" class="px-4 py-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">
                      {{ snapshot.provider }} · {{ environmentLabel(snapshot.environment) }}
                    </p>
                    <p class="text-xs text-gray-500">{{ formatDate(snapshot.createdAt) }} · {{ snapshot.holdingsCount }}종목</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold">{{ formatMoney(snapshot.totalValuationAmount) }}</p>
                    <p class="text-xs" :class="toneClass(snapshot.profitLossRate)">
                      {{ formatRate(snapshot.profitLossRate) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="mt-5 rounded border border-gray-200 bg-white">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h2 class="text-base font-semibold">Order Audits</h2>
          <button
            type="button"
            class="h-8 rounded border border-gray-300 px-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            :disabled="loading.audits"
            @click="loadAudits"
          >
            새로고침
          </button>
        </div>
        <p v-if="errors.audits" class="px-4 pt-3 text-sm text-red-600">{{ errors.audits }}</p>
        <div class="overflow-x-auto">
          <table class="min-w-[900px] w-full text-left text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th class="px-4 py-3 font-medium">시간</th>
                <th class="px-4 py-3 font-medium">상태</th>
                <th class="px-4 py-3 font-medium">구분</th>
                <th class="px-4 py-3 font-medium">종목</th>
                <th class="px-4 py-3 text-right font-medium">수량</th>
                <th class="px-4 py-3 text-right font-medium">가격</th>
                <th class="px-4 py-3 font-medium">메시지</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="!audits.length">
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                  주문 audit이 없습니다.
                </td>
              </tr>
              <tr v-for="audit in audits" :key="audit.id" class="hover:bg-gray-50">
                <td class="px-4 py-3 text-gray-600">{{ formatDate(audit.createdAt) }}</td>
                <td class="px-4 py-3">
                  <span class="rounded border px-2 py-1 text-xs font-medium" :class="statusPillClass(audit.status)">
                    {{ audit.status }}
                  </span>
                </td>
                <td class="px-4 py-3">{{ audit.side }}</td>
                <td class="px-4 py-3 font-medium">{{ audit.symbol }}</td>
                <td class="px-4 py-3 text-right">{{ audit.quantity }}</td>
                <td class="px-4 py-3 text-right">{{ formatMoney(audit.price) }}</td>
                <td class="max-w-[280px] truncate px-4 py-3 text-gray-600">
                  {{ audit.brokerMessage || audit.errorMessage || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>
