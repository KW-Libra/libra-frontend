<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { backtestAdminApi } from '@/api/backtestAdmin'
import type {
  BacktestDecisionFrequency,
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
const error = ref('')
let pollTimer: number | undefined

const frequencyOptions: Array<{ value: BacktestDecisionFrequency; label: string }> = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'every-n-trading-days', label: 'N일마다' }
]

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

onBeforeUnmount(stopPolling)

async function startRun() {
  starting.value = true
  error.value = ''
  try {
    const response = await backtestAdminApi.startRun(payload())
    status.value = response.data
    lookupRunId.value = response.data.runId
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
    const response = await backtestAdminApi.status(runId)
    status.value = response.data
    lookupRunId.value = response.data.runId
    syncPolling()
  } catch (e) {
    error.value = errorMessage(e, '백테스트 상태를 불러오지 못했습니다.')
    stopPolling()
  } finally {
    refreshing.value = false
  }
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

        <form class="space-y-4" @submit.prevent="startRun">
          <label class="block">
            <span class="text-xs font-medium text-gray-600">Run ID</span>
            <input v-model="form.runId" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="비우면 자동 생성" />
          </label>

          <label class="block">
            <span class="text-xs font-medium text-gray-600">Model</span>
            <input v-model="form.model" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm font-mono" />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-medium text-gray-600">Governance</span>
              <input v-model="form.governancePreset" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" />
            </label>
            <label class="block">
              <span class="text-xs font-medium text-gray-600">Prompt</span>
              <input v-model="form.promptVariant" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="default" />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-medium text-gray-600">Execution policy</span>
            <select v-model="form.executionPolicyMode" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm">
              <option value="RISK_TRIM_AND_REDISTRIBUTE">RISK_TRIM_AND_REDISTRIBUTE</option>
              <option value="POLICY_TARGET">POLICY_TARGET</option>
              <option value="PARTIAL_POLICY_TARGET">PARTIAL_POLICY_TARGET</option>
              <option value="DELTA_ONLY">DELTA_ONLY</option>
            </select>
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

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-medium text-gray-600">Start date</span>
              <input v-model="form.startDate" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" type="date" />
            </label>
            <label class="block">
              <span class="text-xs font-medium text-gray-600">End date</span>
              <input v-model="form.endDate" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" type="date" />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-medium text-gray-600">Limit</span>
            <input v-model.number="form.limit" class="mt-1 h-10 w-full rounded border border-gray-300 px-3 text-sm" min="1" placeholder="비우면 선택 기간 전체" type="number" />
          </label>

          <div class="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
            <label class="flex items-center justify-between gap-3 text-sm">
              <span>ticker conflict 자동 해소</span>
              <input v-model="form.executionResolveTickerConflicts" class="h-4 w-4" type="checkbox" />
            </label>
            <label class="flex items-center justify-between gap-3 text-sm">
              <span>issue state/cooldown 사용</span>
              <input v-model="form.issueStateEnabled" class="h-4 w-4" type="checkbox" />
            </label>
            <label class="block text-sm">
              <span class="text-xs font-medium text-gray-600">Cooldown observations</span>
              <input v-model.number="form.issueStateCooldownObservations" class="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm" min="1" type="number" />
            </label>
            <label class="flex items-center justify-between gap-3 text-sm">
              <span>같은 runId 산출물 덮어쓰기</span>
              <input v-model="form.force" class="h-4 w-4" type="checkbox" />
            </label>
          </div>

          <button
            class="h-10 w-full rounded bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
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
