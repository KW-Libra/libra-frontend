<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { backtestAdminApi } from '@/api/backtestAdmin'
import type {
  BacktestDecisionFrequency,
  BacktestRunAgentMessage,
  BacktestRunConversation,
  BacktestRunStartRequest,
  BacktestRunStatus,
  ProblemDetail
} from '@/types/api'

const router = useRouter()

const form = reactive<BacktestRunStartRequest>({
  runId: '',
  model: 'claude-haiku-4-5-20251001',
  governancePreset: 'aggressive',
  promptVariant: '',
  executionPolicyMode: 'RISK_TRIM_AND_REDISTRIBUTE',
  executionParticipationRate: '',
  executionMaxAbsDeltaPct: '',
  executionResolveTickerConflicts: true,
  issueStateEnabled: true,
  issueStateCooldownObservations: 20,
  startDate: '',
  endDate: '',
  decisionFrequency: 'daily',
  decisionInterval: 1,
  limit: undefined,
  force: false
})

const lookupRunId = ref('')
const status = ref<BacktestRunStatus | null>(null)
const starting = ref(false)
const refreshing = ref(false)
const conversation = ref<BacktestRunConversation | null>(null)
const selectedConversationDate = ref('')
const conversationLoading = ref(false)
const conversationError = ref('')
const error = ref('')
let pollTimer: number | undefined

const frequencyOptions: Array<{ value: BacktestDecisionFrequency; label: string }> = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'every-n-trading-days', label: 'N일마다' }
]

const CUSTOM_VALUE = '__custom__'

type SelectOption = {
  value: string
  label: string
  description: string
  badge?: string
}

type PeriodPreset = {
  label: string
  description: string
  startDate: string
  endDate: string
}

type RunPreset = {
  label: string
  description: string
  model: string
  governancePreset: string
  promptVariant: string
  executionPolicyMode: string
  decisionFrequency: BacktestDecisionFrequency
  decisionInterval: number
  limit?: number
  executionParticipationRate: string
  executionMaxAbsDeltaPct: string
}

const modelSelection = ref(form.model || 'claude-haiku-4-5-20251001')
const governanceSelection = ref(form.governancePreset || 'aggressive')
const promptSelection = ref('default')
const customModel = ref('')
const customGovernance = ref('')
const customPrompt = ref('')

const modelOptions: SelectOption[] = [
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    badge: '저비용',
    description: '반복 실험과 부분 검증에 우선 사용합니다.'
  },
  {
    value: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    badge: '고비용',
    description: '최종 검증용입니다. full run 전에 Haiku로 먼저 확인해야 합니다.'
  },
  {
    value: CUSTOM_VALUE,
    label: '직접 입력',
    description: '새 모델명을 수동으로 넣어야 할 때만 사용합니다.'
  }
]

const governanceOptions: SelectOption[] = [
  {
    value: 'aggressive',
    label: 'Aggressive',
    badge: '권장',
    description: '현재 v2/risk-trim 검증 기본값입니다.'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: '신호 임계값을 중간 수준으로 둡니다.'
  },
  {
    value: 'noise_resist',
    label: 'Noise resist',
    description: '작은 방향성 신호를 더 보수적으로 처리합니다.'
  },
  {
    value: 'info_expand',
    label: 'Info expand',
    description: '정보성 에이전트 발화를 더 넓게 반영합니다.'
  },
  {
    value: 'maximum_aggressive',
    label: 'Maximum aggressive',
    description: '충돌과 작은 신호도 더 적극적으로 반영합니다.'
  },
  {
    value: 'default',
    label: 'Default',
    description: '회귀 테스트용 기본 임계값입니다.'
  },
  {
    value: CUSTOM_VALUE,
    label: '직접 입력',
    description: '새 governance preset을 실험할 때만 사용합니다.'
  }
]

const promptOptions: SelectOption[] = [
  {
    value: 'default',
    label: 'Default',
    badge: '권장',
    description: '운영 기본 prompt입니다.'
  },
  {
    value: 'calibrated',
    label: 'Calibrated',
    description: '보정 prompt variant입니다.'
  },
  {
    value: CUSTOM_VALUE,
    label: '직접 입력',
    description: 'agent에 새 prompt variant가 추가된 경우만 사용합니다.'
  }
]

const executionPolicyOptions: SelectOption[] = [
  {
    value: 'RISK_TRIM_AND_REDISTRIBUTE',
    label: 'Risk trim + redistribute',
    badge: 'v2 권장',
    description: '위험/집중도 축소 신호를 underweight 종목 매수로 현금중립 보정합니다.'
  },
  {
    value: 'POLICY_TARGET',
    label: 'Policy target',
    description: 'REBALANCE 신호가 나오면 policy weight 전체 목표로 이동합니다.'
  },
  {
    value: 'PARTIAL_POLICY_TARGET',
    label: 'Partial policy target',
    description: 'policy target으로 participation 비율만큼 부분 이동합니다.'
  },
  {
    value: 'DELTA_ONLY',
    label: 'Delta only',
    description: 'candidate delta만 실행합니다. v1 비교용입니다.'
  }
]

const periodPresets: PeriodPreset[] = [
  {
    label: '2020-2023 전체',
    description: '공식 987거래일 fixture',
    startDate: '2020-01-02',
    endDate: '2023-12-28'
  },
  {
    label: '2020',
    description: '초기 코로나 충격 포함',
    startDate: '2020-01-02',
    endDate: '2020-12-30'
  },
  {
    label: '2021',
    description: '회복/정상화 구간',
    startDate: '2021-01-04',
    endDate: '2021-12-30'
  },
  {
    label: '2022',
    description: '금리 상승/약세장 구간',
    startDate: '2022-01-03',
    endDate: '2022-12-29'
  },
  {
    label: '2023',
    description: '반등 구간',
    startDate: '2023-01-02',
    endDate: '2023-12-28'
  }
]

const runPresets: RunPreset[] = [
  {
    label: 'v2 Risk-trim 공식',
    description: 'Haiku + aggressive + risk-trim. 현재 권장 full/partial 실험값입니다.',
    model: 'claude-haiku-4-5-20251001',
    governancePreset: 'aggressive',
    promptVariant: 'default',
    executionPolicyMode: 'RISK_TRIM_AND_REDISTRIBUTE',
    decisionFrequency: 'daily',
    decisionInterval: 1,
    executionParticipationRate: '',
    executionMaxAbsDeltaPct: '5'
  },
  {
    label: '빠른 smoke 20건',
    description: '설정/키/로그만 확인할 때 사용합니다. full run 전에 먼저 누르기 좋습니다.',
    model: 'claude-haiku-4-5-20251001',
    governancePreset: 'aggressive',
    promptVariant: 'default',
    executionPolicyMode: 'RISK_TRIM_AND_REDISTRIBUTE',
    decisionFrequency: 'daily',
    decisionInterval: 1,
    limit: 20,
    executionParticipationRate: '',
    executionMaxAbsDeltaPct: '5'
  },
  {
    label: '주간 저비용',
    description: '주 1회 판단으로 비용과 시간을 줄인 비교 실험입니다.',
    model: 'claude-haiku-4-5-20251001',
    governancePreset: 'balanced',
    promptVariant: 'default',
    executionPolicyMode: 'RISK_TRIM_AND_REDISTRIBUTE',
    decisionFrequency: 'weekly',
    decisionInterval: 1,
    executionParticipationRate: '',
    executionMaxAbsDeltaPct: '5'
  },
  {
    label: 'Sonnet 최종 후보',
    description: '고비용 최종 검증용입니다. Haiku full 결과가 정상일 때만 사용합니다.',
    model: 'claude-sonnet-4-6',
    governancePreset: 'aggressive',
    promptVariant: 'default',
    executionPolicyMode: 'RISK_TRIM_AND_REDISTRIBUTE',
    decisionFrequency: 'daily',
    decisionInterval: 1,
    executionParticipationRate: '',
    executionMaxAbsDeltaPct: '5'
  }
]

const limitPresets: Array<{ label: string; value?: number; description: string }> = [
  { label: '전체', value: undefined, description: '선택 기간 전체 실행' },
  { label: '1건', value: 1, description: 'API/권한 smoke' },
  { label: '20건', value: 20, description: '빠른 검증' },
  { label: '100건', value: 100, description: '부분 성능 확인' }
]

const selectedModel = computed(() => optionLabel(modelOptions, modelSelection.value, form.model || ''))
const selectedGovernance = computed(() =>
  optionLabel(governanceOptions, governanceSelection.value, form.governancePreset || '')
)
const selectedPrompt = computed(() => optionLabel(promptOptions, promptSelection.value, form.promptVariant || 'default'))
const selectedExecutionPolicy = computed(() =>
  executionPolicyOptions.find((option) => option.value === form.executionPolicyMode)
)

const progressPct = computed(() => {
  const expected = status.value?.expectedRows ?? 0
  const raw = status.value?.rawRows ?? 0
  if (!expected) return 0
  return Math.min(100, Math.round((raw / expected) * 1000) / 10)
})

const isRunning = computed(() => status.value?.status === 'RUNNING')
const decisionRows = computed(() => Object.entries(status.value?.decisionDistribution ?? {}))
const branchRows = computed(() => Object.entries(status.value?.governanceBranchDistribution ?? {}))
const cadenceHint = computed(() => {
  if (form.decisionFrequency === 'daily') return '모든 거래일마다 판단합니다.'
  if (form.decisionFrequency === 'weekly') return 'fixture 거래일 중 주 단위 대표일만 판단합니다.'
  return `${form.decisionInterval || 1}거래일마다 한 번 판단합니다.`
})

const periodSummary = computed(() => {
  if (!form.startDate && !form.endDate) return 'fixture 전체 기간'
  return `${form.startDate || 'fixture start'} → ${form.endDate || 'fixture end'}`
})

const limitSummary = computed(() => {
  if (!form.limit) return '선택 기간 전체'
  return `${formatNumber(form.limit)}개 판단만 실행`
})

onBeforeUnmount(stopPolling)

function optionLabel(options: SelectOption[], selected: string, fallback: string) {
  const option = options.find((item) => item.value === selected)
  if (option) return option.label
  return fallback || '-'
}

function selectModel(value: string = modelSelection.value) {
  modelSelection.value = value
  form.model = value === CUSTOM_VALUE ? customModel.value : value
}

function selectGovernance(value: string = governanceSelection.value) {
  governanceSelection.value = value
  form.governancePreset = value === CUSTOM_VALUE ? customGovernance.value : value
}

function selectPrompt(value: string = promptSelection.value) {
  promptSelection.value = value
  form.promptVariant = value === 'default' ? '' : value === CUSTOM_VALUE ? customPrompt.value : value
}

function syncCustomModel() {
  if (modelSelection.value === CUSTOM_VALUE) {
    form.model = customModel.value
  }
}

function syncCustomGovernance() {
  if (governanceSelection.value === CUSTOM_VALUE) {
    form.governancePreset = customGovernance.value
  }
}

function syncCustomPrompt() {
  if (promptSelection.value === CUSTOM_VALUE) {
    form.promptVariant = customPrompt.value
  }
}

function applyRunPreset(preset: RunPreset) {
  selectModel(preset.model)
  selectGovernance(preset.governancePreset)
  selectPrompt(preset.promptVariant)
  form.executionPolicyMode = preset.executionPolicyMode
  form.executionParticipationRate = preset.executionParticipationRate
  form.executionMaxAbsDeltaPct = preset.executionMaxAbsDeltaPct
  setFrequency(preset.decisionFrequency)
  form.decisionInterval = preset.decisionInterval
  form.limit = preset.limit
  form.executionResolveTickerConflicts = true
  form.issueStateEnabled = true
  form.issueStateCooldownObservations = 20
}

function applyPeriodPreset(preset: PeriodPreset) {
  form.startDate = preset.startDate
  form.endDate = preset.endDate
}

function setLimit(value?: number) {
  form.limit = value
}

function isLimitPresetActive(value?: number) {
  return (form.limit || undefined) === value
}

function isPeriodPresetActive(preset: PeriodPreset) {
  return form.startDate === preset.startDate && form.endDate === preset.endDate
}

async function startRun() {
  starting.value = true
  error.value = ''
  try {
    const response = await backtestAdminApi.startRun(payload())
    status.value = response.data
    lookupRunId.value = response.data.runId
    selectedConversationDate.value = ''
    void loadConversation()
    syncPolling()
  } catch (e) {
    error.value = errorMessage(e, '백테스트 실행을 시작하지 못했습니다.')
  } finally {
    starting.value = false
  }
}

async function refreshStatus() {
  const runId = lookupRunId.value || status.value?.runId
  if (!runId) {
    error.value = '조회할 runId가 없습니다.'
    return
  }
  refreshing.value = true
  error.value = ''
  try {
    const previousRows = status.value?.rawRows ?? null
    const response = await backtestAdminApi.status(runId)
    status.value = response.data
    lookupRunId.value = response.data.runId
    if (response.data.rawRows !== previousRows || !conversation.value) {
      void loadConversation(selectedConversationDate.value || undefined, true)
    }
    syncPolling()
  } catch (e) {
    error.value = errorMessage(e, '백테스트 상태를 불러오지 못했습니다.')
    stopPolling()
  } finally {
    refreshing.value = false
  }
}

async function loadConversation(date?: string, silent = false) {
  const runId = lookupRunId.value || status.value?.runId
  if (!runId) {
    if (!silent) conversationError.value = '조회할 runId가 없습니다.'
    return
  }
  conversationLoading.value = true
  if (!silent) conversationError.value = ''
  try {
    const response = await backtestAdminApi.conversation(runId, date)
    conversation.value = response.data
    selectedConversationDate.value = response.data.selectedDate || ''
    conversationError.value = ''
  } catch (e) {
    if (!silent) {
      conversationError.value = errorMessage(e, '일자별 대화를 불러오지 못했습니다.')
    }
  } finally {
    conversationLoading.value = false
  }
}

function selectConversationDate(date: string) {
  selectedConversationDate.value = date
  void loadConversation(date)
}

function payload(): BacktestRunStartRequest {
  const body: BacktestRunStartRequest = {
    runId: clean(form.runId),
    model: clean(form.model),
    governancePreset: clean(form.governancePreset),
    promptVariant: clean(form.promptVariant),
    executionPolicyMode: clean(form.executionPolicyMode),
    executionParticipationRate: clean(form.executionParticipationRate),
    executionMaxAbsDeltaPct: clean(form.executionMaxAbsDeltaPct),
    executionResolveTickerConflicts: form.executionResolveTickerConflicts,
    issueStateEnabled: form.issueStateEnabled,
    issueStateCooldownObservations: form.issueStateCooldownObservations,
    startDate: clean(form.startDate),
    endDate: clean(form.endDate),
    decisionFrequency: form.decisionFrequency,
    decisionInterval: form.decisionInterval || 1,
    limit: form.limit || undefined,
    force: form.force
  }
  const record = body as Record<string, unknown>
  Object.keys(record).forEach((key) => {
    if (record[key] === undefined || record[key] === '') {
      delete record[key]
    }
  })
  return body
}

function clean(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function syncPolling() {
  if (status.value?.status === 'RUNNING') {
    if (!pollTimer) {
      pollTimer = window.setInterval(() => {
        void refreshStatus()
      }, 5000)
    }
  } else {
    stopPolling()
  }
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function setFrequency(value: BacktestDecisionFrequency) {
  form.decisionFrequency = value
  if (value !== 'every-n-trading-days') {
    form.decisionInterval = 1
  } else if (!form.decisionInterval || form.decisionInterval < 2) {
    form.decisionInterval = 5
  }
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatDecimal(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value)
}

function formatJson(value: unknown) {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return '-'
  }
  return JSON.stringify(value, null, 2)
}

function agentName(agent: BacktestRunAgentMessage) {
  return agent.agentId || 'unknown'
}

function toneForDecision(value: string | null | undefined) {
  if (value === 'REBALANCE') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (value === 'USER_DECISION_REQUIRED') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (value === 'DEFER') return 'border-gray-200 bg-gray-50 text-gray-700'
  if (value === 'HOLD') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-gray-200 bg-white text-gray-600'
}

function formatBool(value: boolean | null | undefined) {
  if (value === null || value === undefined) return '-'
  return value ? 'true' : 'false'
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date)
}

function formatEta(value: string | null | undefined) {
  if (!value) return '-'
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return value
  const [, hours, minutes, seconds] = match
  return [
    hours ? `${hours}시간` : '',
    minutes ? `${minutes}분` : '',
    !hours && !minutes && seconds ? `${seconds}초` : ''
  ].filter(Boolean).join(' ') || value
}

function toneForStatus(value: string | null | undefined) {
  if (value === 'RUNNING') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'EXITED') return 'border-gray-200 bg-gray-50 text-gray-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function errorMessage(e: unknown, fallback: string) {
  if (axios.isAxiosError<ProblemDetail>(e)) {
    return e.response?.data?.detail || e.message || fallback
  }
  if (e instanceof Error) return e.message
  return fallback
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded bg-gray-900 text-sm font-bold text-white">L</div>
          <div>
            <div class="text-sm font-semibold tracking-tight">Libra Admin</div>
            <div class="text-[11px] text-gray-500">Backtest runner</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button class="text-xs text-gray-600 transition hover:text-gray-900" type="button" @click="refreshStatus">
            상태 새로고침
          </button>
          <button class="text-xs text-gray-600 transition hover:text-gray-900" type="button" @click="router.push('/backtests/kr-objective-2020-2023-opendart-googlenews')">
            검증 결과
          </button>
          <button class="text-xs text-gray-600 transition hover:text-gray-900" type="button" @click="router.push('/dashboard')">
            대시보드
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section class="rounded-lg border border-gray-200 bg-white p-5">
        <div class="mb-5">
          <div class="text-xs font-medium tracking-wider text-gray-500">실행 조건</div>
          <h1 class="mt-1 text-xl font-semibold tracking-tight">백테스트 시작</h1>
          <p class="mt-2 text-sm leading-6 text-gray-600">
            서비스와 같은 Claude committee replay를 실행합니다. 판단 주기와 기간은 여기서 지정합니다.
          </p>
        </div>

        <form class="space-y-5" @submit.prevent="startRun">
          <div class="rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            서버에서 동시에 하나의 백테스트만 실행합니다. 이미 실행 중이면 새 run은 409로 거절됩니다.
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-gray-600">추천 프리셋</span>
              <span class="text-[11px] text-gray-500">클릭하면 주요 설정만 채웁니다.</span>
            </div>
            <div class="grid gap-2">
              <button
                v-for="preset in runPresets"
                :key="preset.label"
                class="rounded border border-gray-200 bg-white p-3 text-left transition hover:border-gray-900 hover:bg-gray-50"
                type="button"
                @click="applyRunPreset(preset)"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="text-sm font-semibold">{{ preset.label }}</span>
                  <span v-if="preset.limit" class="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    limit {{ preset.limit }}
                  </span>
                </div>
                <p class="mt-1 text-xs leading-5 text-gray-500">{{ preset.description }}</p>
              </button>
            </div>
          </div>

          <div class="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
            <div class="grid gap-3">
              <label class="block">
                <span class="text-xs font-medium text-gray-600">Model</span>
                <select
                  v-model="modelSelection"
                  class="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
                  @change="selectModel()"
                >
                  <option v-for="option in modelOptions" :key="option.value" :value="option.value">
                    {{ option.label }}{{ option.badge ? ` · ${option.badge}` : '' }}
                  </option>
                </select>
                <p class="mt-1 text-xs text-gray-500">
                  {{ modelOptions.find((option) => option.value === modelSelection)?.description }}
                </p>
              </label>

              <label v-if="modelSelection === CUSTOM_VALUE" class="block">
                <span class="text-xs font-medium text-gray-600">직접 모델명</span>
                <input
                  v-model="customModel"
                  class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm font-mono"
                  placeholder="예: claude-haiku-4-5-20251001"
                  @input="syncCustomModel"
                />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="block">
                  <span class="text-xs font-medium text-gray-600">Governance</span>
                  <select
                    v-model="governanceSelection"
                    class="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
                    @change="selectGovernance()"
                  >
                    <option v-for="option in governanceOptions" :key="option.value" :value="option.value">
                      {{ option.label }}{{ option.badge ? ` · ${option.badge}` : '' }}
                    </option>
                  </select>
                </label>
                <label class="block">
                  <span class="text-xs font-medium text-gray-600">Prompt</span>
                  <select
                    v-model="promptSelection"
                    class="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
                    @change="selectPrompt()"
                  >
                    <option v-for="option in promptOptions" :key="option.value" :value="option.value">
                      {{ option.label }}{{ option.badge ? ` · ${option.badge}` : '' }}
                    </option>
                  </select>
                </label>
              </div>

              <label v-if="governanceSelection === CUSTOM_VALUE" class="block">
                <span class="text-xs font-medium text-gray-600">직접 governance preset</span>
                <input
                  v-model="customGovernance"
                  class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm font-mono"
                  placeholder="새 preset 이름"
                  @input="syncCustomGovernance"
                />
              </label>

              <label v-if="promptSelection === CUSTOM_VALUE" class="block">
                <span class="text-xs font-medium text-gray-600">직접 prompt variant</span>
                <input
                  v-model="customPrompt"
                  class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm font-mono"
                  placeholder="새 prompt variant"
                  @input="syncCustomPrompt"
                />
              </label>
            </div>
          </div>

          <label class="block">
            <span class="text-xs font-medium text-gray-600">Execution policy</span>
            <select v-model="form.executionPolicyMode" class="mt-1 h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
              <option v-for="option in executionPolicyOptions" :key="option.value" :value="option.value">
                {{ option.label }}{{ option.badge ? ` · ${option.badge}` : '' }}
              </option>
            </select>
            <p class="mt-1 text-xs leading-5 text-gray-500">{{ selectedExecutionPolicy?.description }}</p>
          </label>

          <div>
            <span class="text-xs font-medium text-gray-600">판단 주기</span>
            <div class="mt-1 grid grid-cols-3 rounded border border-gray-300 bg-gray-50 p-1">
              <button
                v-for="option in frequencyOptions"
                :key="option.value"
                class="h-8 rounded text-xs font-medium transition"
                :class="form.decisionFrequency === option.value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-white'"
                type="button"
                @click="setFrequency(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
            <p class="mt-2 text-xs text-gray-500">{{ cadenceHint }}</p>
          </div>

          <label v-if="form.decisionFrequency === 'every-n-trading-days'" class="block">
            <span class="text-xs font-medium text-gray-600">N 거래일</span>
            <input v-model.number="form.decisionInterval" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" min="2" type="number" />
          </label>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-gray-600">기간 프리셋</span>
              <span class="text-[11px] text-gray-500">{{ periodSummary }}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="preset in periodPresets"
                :key="preset.label"
                class="rounded border p-2 text-left transition"
                :class="isPeriodPresetActive(preset) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-900'"
                type="button"
                @click="applyPeriodPreset(preset)"
              >
                <div class="text-xs font-semibold">{{ preset.label }}</div>
                <div class="mt-1 text-[11px]" :class="isPeriodPresetActive(preset) ? 'text-gray-200' : 'text-gray-500'">
                  {{ preset.description }}
                </div>
              </button>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-xs font-medium text-gray-600">Start date</span>
                <input v-model="form.startDate" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" type="date" />
              </label>
              <label class="block">
                <span class="text-xs font-medium text-gray-600">End date</span>
                <input v-model="form.endDate" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" type="date" />
              </label>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-gray-600">Limit</span>
              <span class="text-[11px] text-gray-500">{{ limitSummary }}</span>
            </div>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="preset in limitPresets"
                :key="preset.label"
                class="h-9 rounded border px-2 text-xs font-medium transition"
                :class="isLimitPresetActive(preset.value) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-900'"
                :title="preset.description"
                type="button"
                @click="setLimit(preset.value)"
              >
                {{ preset.label }}
              </button>
            </div>
            <input
              v-model.number="form.limit"
              class="mt-2 h-10 w-full rounded border border-gray-300 px-3 text-sm"
              min="1"
              placeholder="직접 입력. 비우면 선택 기간 전체"
              type="number"
            />
          </div>

          <div class="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
            <label class="flex items-center justify-between gap-3 text-sm">
              <span>ticker conflict 자동 해소</span>
              <input v-model="form.executionResolveTickerConflicts" class="h-4 w-4" type="checkbox" />
            </label>
            <label class="flex items-center justify-between gap-3 text-sm">
              <span>issue state/cooldown 사용</span>
              <input v-model="form.issueStateEnabled" class="h-4 w-4" type="checkbox" />
            </label>
          </div>

          <details class="rounded border border-gray-200 bg-white p-3">
            <summary class="cursor-pointer text-sm font-medium text-gray-700">고급 옵션</summary>
            <div class="mt-3 space-y-3">
              <label class="block">
                <span class="text-xs font-medium text-gray-600">Run ID</span>
                <input v-model="form.runId" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm font-mono" placeholder="비우면 자동 생성" />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="block">
                  <span class="text-xs font-medium text-gray-600">Participation</span>
                  <input v-model="form.executionParticipationRate" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="예: 0.5" />
                </label>
                <label class="block">
                  <span class="text-xs font-medium text-gray-600">Max delta %p</span>
                  <input v-model="form.executionMaxAbsDeltaPct" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="예: 5" />
                </label>
              </div>

              <label class="block text-sm">
                <span class="text-xs font-medium text-gray-600">Cooldown observations</span>
                <input v-model.number="form.issueStateCooldownObservations" class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm" min="1" type="number" />
              </label>

              <label class="flex items-center justify-between gap-3 rounded border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                <span>같은 runId 산출물 덮어쓰기</span>
                <input v-model="form.force" class="h-4 w-4" type="checkbox" />
              </label>
            </div>
          </details>

          <div class="rounded border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-600">
            <div><span class="font-semibold text-gray-800">선택값</span>: {{ selectedModel }} / {{ selectedGovernance }} / {{ selectedPrompt }}</div>
            <div>Execution: {{ selectedExecutionPolicy?.label || form.executionPolicyMode }} · {{ cadenceHint }} · {{ limitSummary }}</div>
          </div>

          <button
            class="h-11 w-full rounded bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
            :disabled="starting"
            type="submit"
          >
            {{ starting ? '시작 중' : '백테스트 실행' }}
          </button>
        </form>
      </section>

      <section class="space-y-6">
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label class="block flex-1">
              <span class="text-xs font-medium text-gray-600">Run 상태 조회</span>
              <input v-model="lookupRunId" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm font-mono" placeholder="runId 입력" />
            </label>
            <button class="h-10 rounded border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50" type="button" @click="refreshStatus">
              {{ refreshing ? '조회 중' : '조회' }}
            </button>
          </div>

          <div v-if="error" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {{ error }}
          </div>
        </div>

        <div v-if="!status" class="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          실행을 시작하거나 runId를 조회하면 상태가 표시됩니다.
        </div>

        <template v-else>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div class="text-xs font-medium tracking-wider text-gray-500">RUN ID</div>
                <h2 class="mt-1 break-all font-mono text-base font-semibold">{{ status.runId }}</h2>
              </div>
              <span class="w-fit rounded border px-2 py-1 text-xs font-semibold" :class="toneForStatus(status.status)">
                {{ status.status }}
              </span>
            </div>

            <div class="mt-5">
              <div class="mb-2 flex justify-between text-xs text-gray-500">
                <span>{{ formatNumber(status.rawRows) }} / {{ formatNumber(status.expectedRows) }} rows</span>
                <span>{{ progressPct }}%</span>
              </div>
              <div class="h-2 overflow-hidden rounded bg-gray-100">
                <div class="h-full bg-gray-900 transition-all" :style="{ width: `${progressPct}%` }"></div>
              </div>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">PID</div>
                <div class="mt-1 font-mono text-sm font-semibold">{{ status.pid ?? '-' }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Last date</div>
                <div class="mt-1 font-mono text-sm font-semibold">{{ status.lastDate ?? '-' }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Prefix match</div>
                <div class="mt-1 text-sm font-semibold">{{ formatBool(status.prefixMatch) }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">ETA</div>
                <div class="mt-1 text-sm font-semibold">{{ formatEta(status.eta) }}</div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white">
            <div class="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 class="text-base font-semibold">일자별 에이전트 대화</h3>
                <p class="mt-1 text-xs text-gray-500">각 거래일 raw replay에 기록된 agent 응답과 최종 판단입니다.</p>
              </div>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  v-model="selectedConversationDate"
                  class="h-10 min-w-44 rounded border border-gray-300 bg-white px-3 text-sm"
                  @change="selectConversationDate(selectedConversationDate)"
                >
                  <option v-for="day in conversation?.days || []" :key="day.date" :value="day.date">
                    {{ day.date }} · {{ day.decision || '-' }}
                  </option>
                </select>
                <button
                  class="h-10 rounded border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  type="button"
                  @click="loadConversation(selectedConversationDate || undefined)"
                >
                  {{ conversationLoading ? '불러오는 중' : '대화 새로고침' }}
                </button>
              </div>
            </div>

            <div v-if="conversationError" class="m-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {{ conversationError }}
            </div>
            <div v-else-if="!conversation?.conversation" class="p-8 text-center text-sm text-gray-500">
              아직 표시할 일자별 대화가 없습니다.
            </div>
            <div v-else class="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside class="max-h-[760px] overflow-auto border-b border-gray-200 p-4 xl:border-b-0 xl:border-r">
                <div class="space-y-2">
                  <button
                    v-for="day in conversation.days.slice().reverse()"
                    :key="day.date"
                    class="w-full rounded border p-3 text-left transition"
                    :class="day.date === selectedConversationDate ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-900'"
                    type="button"
                    @click="selectConversationDate(day.date)"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-mono text-xs font-semibold">{{ day.date }}</span>
                      <span class="rounded px-2 py-0.5 text-[11px] font-semibold" :class="day.date === selectedConversationDate ? 'bg-white/10 text-white' : toneForDecision(day.decision)">
                        {{ day.decision || '-' }}
                      </span>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2 text-[11px]" :class="day.date === selectedConversationDate ? 'text-gray-200' : 'text-gray-500'">
                      <span>{{ day.branch || '-' }}</span>
                      <span>{{ day.agentCount ?? 0 }} agents</span>
                      <span>{{ day.tradeCount ?? 0 }} trades</span>
                    </div>
                  </button>
                </div>
              </aside>

              <div class="max-h-[760px] overflow-auto p-5">
                <div class="grid gap-3 lg:grid-cols-4">
                  <div class="rounded border border-gray-200 bg-gray-50 p-3">
                    <div class="text-xs text-gray-500">Date</div>
                    <div class="mt-1 font-mono text-sm font-semibold">{{ conversation.conversation.date }}</div>
                  </div>
                  <div class="rounded border border-gray-200 bg-gray-50 p-3">
                    <div class="text-xs text-gray-500">Decision</div>
                    <div class="mt-1 w-fit rounded border px-2 py-0.5 text-xs font-semibold" :class="toneForDecision(conversation.conversation.finalDecision.decision)">
                      {{ conversation.conversation.finalDecision.decision || '-' }}
                    </div>
                  </div>
                  <div class="rounded border border-gray-200 bg-gray-50 p-3">
                    <div class="text-xs text-gray-500">Branch</div>
                    <div class="mt-1 break-all text-sm font-semibold">{{ conversation.conversation.finalDecision.branch || '-' }}</div>
                  </div>
                  <div class="rounded border border-gray-200 bg-gray-50 p-3">
                    <div class="text-xs text-gray-500">Agents</div>
                    <div class="mt-1 text-sm font-semibold">{{ conversation.conversation.agents.length }} / round2 {{ conversation.conversation.round2Agents.length }}</div>
                  </div>
                </div>

                <div class="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
                  <div class="text-xs font-medium text-gray-500">Final Judge reasoning</div>
                  <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                    {{ conversation.conversation.finalDecision.reasoning || '-' }}
                  </p>
                  <div v-if="conversation.conversation.finalDecision.trades.length" class="mt-3">
                    <div class="text-xs font-medium text-gray-500">Trades</div>
                    <pre class="mt-2 max-h-44 overflow-auto rounded bg-white p-3 text-xs text-gray-700">{{ formatJson(conversation.conversation.finalDecision.trades) }}</pre>
                  </div>
                </div>

                <div class="mt-4 rounded border border-gray-200 bg-white">
                  <div class="border-b border-gray-200 px-4 py-3">
                    <h4 class="text-sm font-semibold">Round 1 agent messages</h4>
                  </div>
                  <div class="divide-y divide-gray-200">
                    <details v-for="agent in conversation.conversation.agents" :key="`${conversation.conversation.date}-${agent.agentId}`" class="group">
                      <summary class="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="font-mono text-sm font-semibold">{{ agentName(agent) }}</span>
                          <span class="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium">{{ agent.opinion || '-' }}</span>
                          <span class="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium">{{ agent.verdict || '-' }}</span>
                        </div>
                        <div class="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>conf {{ formatDecimal(agent.confidence) }}</span>
                          <span>dir {{ formatDecimal(agent.direction) }}</span>
                          <span>{{ agent.riskLevel || 'risk -' }}</span>
                        </div>
                      </summary>
                      <div class="px-4 pb-4">
                        <div class="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                          <div class="text-xs text-gray-500">Focus</div>
                          <div class="text-sm">{{ agent.focusTickers.join(', ') || '-' }}</div>
                          <div class="text-xs text-gray-500">Query</div>
                          <div class="whitespace-pre-wrap text-sm leading-6">{{ agent.queryUnderstood || '-' }}</div>
                          <div class="text-xs text-gray-500">Reasoning</div>
                          <div class="whitespace-pre-wrap text-sm leading-6">{{ agent.reasoning || '-' }}</div>
                          <div v-if="agent.limitsAcknowledged" class="text-xs text-gray-500">Limits</div>
                          <div v-if="agent.limitsAcknowledged" class="whitespace-pre-wrap text-sm leading-6 text-amber-700">{{ agent.limitsAcknowledged }}</div>
                        </div>
                        <div v-if="agent.tools.length" class="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
                          <div class="text-xs font-medium text-gray-500">Tool loop</div>
                          <div class="mt-2 space-y-2">
                            <div v-for="tool in agent.tools" :key="`${agent.agentId}-${tool.toolName}-${tool.summary}`" class="rounded bg-white p-2 text-xs leading-5 text-gray-700">
                              <span class="font-mono font-semibold">{{ tool.toolName || '-' }}</span>
                              <span v-if="tool.purpose"> · {{ tool.purpose }}</span>
                              <div v-if="tool.summary" class="mt-1 text-gray-500">{{ tool.summary }}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>

                <div class="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
                  <div class="text-xs font-medium text-gray-500">Execution plan</div>
                  <pre class="mt-2 max-h-72 overflow-auto rounded bg-white p-3 text-xs text-gray-700">{{ formatJson(conversation.conversation.executionPlan) }}</pre>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-6 xl:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h3 class="text-base font-semibold">실행 설정</h3>
              <dl class="mt-4 grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt class="text-gray-500">Model</dt>
                <dd class="break-all font-mono">{{ status.model ?? '-' }}</dd>
                <dt class="text-gray-500">Governance</dt>
                <dd>{{ status.governancePreset ?? '-' }}</dd>
                <dt class="text-gray-500">Execution</dt>
                <dd class="break-all font-mono">{{ status.executionPolicyMode ?? '-' }}</dd>
                <dt class="text-gray-500">Cadence</dt>
                <dd>{{ status.decisionFrequency ?? '-' }} / {{ status.decisionInterval ?? '-' }}</dd>
                <dt class="text-gray-500">Period</dt>
                <dd>{{ status.startDate || 'fixture start' }} → {{ status.endDate || 'fixture end' }}</dd>
                <dt class="text-gray-500">Started</dt>
                <dd>{{ formatDateTime(status.startedAt) }}</dd>
                <dt class="text-gray-500">Raw updated</dt>
                <dd>{{ formatDateTime(status.rawUpdatedAt) }}</dd>
              </dl>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h3 class="text-base font-semibold">품질 지표</h3>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded border border-gray-200 bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Nonempty REBALANCE</div>
                  <div class="mt-1 text-lg font-semibold">{{ formatNumber(status.nonemptyRebalanceCount) }}</div>
                </div>
                <div class="rounded border border-gray-200 bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Empty REBALANCE</div>
                  <div class="mt-1 text-lg font-semibold">{{ formatNumber(status.emptyRebalanceCount) }}</div>
                </div>
                <div class="rounded border border-gray-200 bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">USER_DECISION_REQUIRED</div>
                  <div class="mt-1 text-lg font-semibold">{{ formatNumber(status.userDecisionRequiredCount) }}</div>
                </div>
                <div class="rounded border border-gray-200 bg-gray-50 p-3">
                  <div class="text-xs text-gray-500">Issue suppressed</div>
                  <div class="mt-1 text-lg font-semibold">{{ formatNumber(status.issueStateSuppressionCount) }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-6 xl:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h3 class="text-base font-semibold">Decision distribution</h3>
              <div class="mt-4 space-y-2">
                <div v-for="[name, count] in decisionRows" :key="name" class="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <span>{{ name }}</span>
                  <span class="font-mono font-semibold">{{ formatNumber(count) }}</span>
                </div>
                <div v-if="decisionRows.length === 0" class="text-sm text-gray-500">아직 raw decision이 없습니다.</div>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h3 class="text-base font-semibold">Governance branches</h3>
              <div class="mt-4 space-y-2">
                <div v-for="[name, count] in branchRows" :key="name" class="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <span class="break-all">{{ name }}</span>
                  <span class="font-mono font-semibold">{{ formatNumber(count) }}</span>
                </div>
                <div v-if="branchRows.length === 0" class="text-sm text-gray-500">아직 branch 정보가 없습니다.</div>
              </div>
            </div>
          </div>

          <div class="grid gap-6 xl:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h3 class="text-base font-semibold">LLM usage</h3>
              <dl class="mt-4 grid grid-cols-[170px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt class="text-gray-500">Requests</dt>
                <dd class="font-mono">{{ formatNumber(status.usageRequestCount) }}</dd>
                <dt class="text-gray-500">Input tokens</dt>
                <dd class="font-mono">{{ formatNumber(status.inputTokens) }}</dd>
                <dt class="text-gray-500">Output tokens</dt>
                <dd class="font-mono">{{ formatNumber(status.outputTokens) }}</dd>
                <dt class="text-gray-500">Cache creation</dt>
                <dd class="font-mono">{{ formatNumber(status.cacheCreationInputTokens) }}</dd>
                <dt class="text-gray-500">Cache read</dt>
                <dd class="font-mono">{{ formatNumber(status.cacheReadInputTokens) }}</dd>
              </dl>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h3 class="text-base font-semibold">Agent coverage</h3>
              <div class="mt-2 text-sm text-gray-500">{{ status.round1AgentCount ?? 0 }} agents</div>
              <div class="mt-3 flex flex-wrap gap-2">
                <span v-for="agent in status.round1Agents" :key="agent" class="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium">
                  {{ agent }}
                </span>
              </div>
              <div class="mt-4 text-sm text-gray-600">Fallback events: {{ formatNumber(status.fallbackEventCount) }}</div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h3 class="text-base font-semibold">산출물 경로</h3>
            <dl class="mt-4 space-y-2 text-sm">
              <div class="grid grid-cols-[100px_minmax(0,1fr)] gap-3">
                <dt class="text-gray-500">Raw</dt>
                <dd class="break-all font-mono">{{ status.rawOut }}</dd>
              </div>
              <div class="grid grid-cols-[100px_minmax(0,1fr)] gap-3">
                <dt class="text-gray-500">Usage</dt>
                <dd class="break-all font-mono">{{ status.usageLog }}</dd>
              </div>
              <div class="grid grid-cols-[100px_minmax(0,1fr)] gap-3">
                <dt class="text-gray-500">Trace</dt>
                <dd class="break-all font-mono">{{ status.traceOut }}</dd>
              </div>
            </dl>
          </div>

          <div class="grid gap-6 xl:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-white">
              <div class="border-b border-gray-200 px-5 py-4">
                <h3 class="text-base font-semibold">stdout tail</h3>
              </div>
              <pre class="max-h-80 overflow-auto p-5 text-xs leading-5 text-gray-700">{{ status.stdoutTail.join('\n') || '-' }}</pre>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white">
              <div class="border-b border-gray-200 px-5 py-4">
                <h3 class="text-base font-semibold">stderr tail</h3>
              </div>
              <pre class="max-h-80 overflow-auto p-5 text-xs leading-5 text-red-700">{{ status.stderrTail.join('\n') || '-' }}</pre>
            </div>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>
