<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { backtestApi, FINAL_JUDGE_EXPERIMENT_ID } from '@/api/backtests'
import type { BacktestMetric, BacktestValidation, DecimalValue, ProblemDetail } from '@/types/api'

const router = useRouter()
const validation = ref<BacktestValidation | null>(null)
const loading = ref(false)
const error = ref('')

const strategyOrder = [
  'Buy & Hold',
  'Policy Quarterly Rebalancing',
  'Threshold Band Rebalancing',
  'Monthly Inverse-Vol Risk Parity',
  'LIBRA',
  'LIBRA-v3 T+2 Confirmation Gate'
]

const orderedResults = computed(() => {
  const rows = validation.value?.results ?? []
  return strategyOrder
    .map((strategy) => rows.find((row) => row.strategy === strategy))
    .filter((row): row is BacktestMetric => Boolean(row))
})

const mainCandidate = computed(() => validation.value?.mainCandidate ?? null)
const libraV1 = computed(() => validation.value?.libraV1 ?? null)
const returnImprovement = computed(() =>
  diff(mainCandidate.value?.totalReturnPct, libraV1.value?.totalReturnPct)
)
const costImprovement = computed(() =>
  diff(libraV1.value?.transactionCostKrw, mainCandidate.value?.transactionCostKrw)
)
const tradeReduction = computed(() => {
  if (mainCandidate.value?.trades === null || mainCandidate.value?.trades === undefined) return null
  if (libraV1.value?.trades === null || libraV1.value?.trades === undefined) return null
  return libraV1.value.trades - mainCandidate.value.trades
})

onMounted(loadValidation)

async function loadValidation() {
  loading.value = true
  error.value = ''
  try {
    const response = await backtestApi.validation(FINAL_JUDGE_EXPERIMENT_ID)
    validation.value = response.data
  } catch (e) {
    error.value = errorMessage(e, '백테스트 검증 결과를 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
}

function toNumber(value: DecimalValue | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function diff(a: DecimalValue | undefined, b: DecimalValue | undefined) {
  const left = toNumber(a)
  const right = toNumber(b)
  if (left === null || right === null) return null
  return left - right
}

function formatPercent(value: DecimalValue | undefined, digits = 3) {
  const parsed = toNumber(value)
  if (parsed === null) return '-'
  return `${parsed.toFixed(digits)}%`
}

function formatNumber(value: DecimalValue | undefined, digits = 3) {
  const parsed = toNumber(value)
  if (parsed === null) return '-'
  return parsed.toFixed(digits)
}

function formatKrw(value: DecimalValue | undefined) {
  const parsed = toNumber(value)
  if (parsed === null) return '-'
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(parsed)
}

function formatSignedPercent(value: number | null) {
  if (value === null) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}%p`
}

function toneClass(value: DecimalValue | undefined) {
  const parsed = toNumber(value)
  if (parsed === null || parsed === 0) return 'text-gray-900'
  return parsed > 0 ? 'text-emerald-700' : 'text-red-700'
}

function strategyLabel(strategy: string) {
  const labels: Record<string, string> = {
    'Policy Quarterly Rebalancing': 'Quarterly',
    'Threshold Band Rebalancing': 'Threshold 5%',
    'Monthly Inverse-Vol Risk Parity': 'Risk Parity',
    'LIBRA': 'LIBRA v1'
  }
  return labels[strategy] ?? strategy
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
      <div class="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded bg-gray-900 text-sm font-bold text-white">L</div>
          <div>
            <div class="text-sm font-semibold tracking-tight">Libra</div>
            <div class="text-[11px] text-gray-500">Backtest validation</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button class="text-xs text-gray-600 transition hover:text-gray-900" type="button" @click="loadValidation">
            새로고침
          </button>
          <button class="text-xs text-gray-600 transition hover:text-gray-900" type="button" @click="router.push('/dashboard')">
            대시보드
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-8 py-10">
      <div class="mb-8">
        <div class="mb-2 text-xs font-medium tracking-wider text-gray-500">멀티 에이전틱 AI 자동 리밸런싱 검증</div>
        <h1 class="text-2xl font-medium tracking-tight">Execution Confirmation Agent</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Final Judge의 REBALANCE 판단을 바로 체결하지 않고, T+2 residual drift를 확인한 뒤 필요한 경우만 체결한 결과입니다.
        </p>
      </div>

      <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        백테스트 검증 결과를 불러오는 중입니다.
      </div>

      <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-6">
        <div class="text-sm font-semibold text-red-800">백테스트 API 연결 실패</div>
        <p class="mt-2 text-sm text-red-700">{{ error }}</p>
      </div>

      <div v-else-if="validation" class="space-y-6">
        <section class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div class="rounded-lg border border-gray-200 bg-white p-6">
            <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="text-lg font-semibold">{{ validation.title }}</h2>
                <p class="mt-1 text-sm text-gray-500">{{ validation.period }}</p>
              </div>
              <span class="w-fit rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                strict no-lookahead
              </span>
            </div>

            <div class="grid gap-3 sm:grid-cols-4">
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Return</div>
                <div class="mt-2 text-xl font-semibold">{{ formatPercent(mainCandidate?.totalReturnPct) }}</div>
                <div class="mt-1 text-xs text-emerald-700">{{ formatSignedPercent(returnImprovement) }} vs v1</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Sharpe</div>
                <div class="mt-2 text-xl font-semibold">{{ formatNumber(mainCandidate?.sharpeRatio) }}</div>
                <div class="mt-1 text-xs text-gray-500">v1 {{ formatNumber(libraV1?.sharpeRatio) }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">MDD</div>
                <div class="mt-2 text-xl font-semibold">{{ formatPercent(mainCandidate?.maxDrawdownPct) }}</div>
                <div class="mt-1 text-xs text-gray-500">악화 없음</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Trades / Cost</div>
                <div class="mt-2 text-xl font-semibold">{{ mainCandidate?.trades ?? '-' }}회</div>
                <div class="mt-1 text-xs text-emerald-700">
                  {{ tradeReduction === null ? '-' : `${tradeReduction}회 감소` }} · {{ formatKrw(costImprovement) }} 절감
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-900 p-6 text-white">
            <div class="text-xs font-medium tracking-wider text-gray-400">자동 리밸런싱 정의</div>
            <div class="mt-3 space-y-3 text-sm">
              <div class="rounded border border-white/10 bg-white/5 p-3">자동 진단</div>
              <div class="rounded border border-white/10 bg-white/5 p-3">Final Judge 판단</div>
              <div class="rounded border border-white/10 bg-white/5 p-3">Execution Confirmation</div>
              <div class="rounded border border-white/10 bg-white/5 p-3">사용자 승인 / 체결</div>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-gray-200 bg-white">
          <div class="border-b border-gray-200 px-5 py-4">
            <h2 class="text-base font-semibold">전략별 비교</h2>
            <p class="mt-1 text-sm text-gray-500">{{ validation.dataSource }}</p>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-[860px] w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th class="px-4 py-3 font-medium">Strategy</th>
                  <th class="px-4 py-3 text-right font-medium">Return</th>
                  <th class="px-4 py-3 text-right font-medium">Sharpe</th>
                  <th class="px-4 py-3 text-right font-medium">MDD</th>
                  <th class="px-4 py-3 text-right font-medium">Trades</th>
                  <th class="px-4 py-3 text-right font-medium">Cost</th>
                  <th class="px-4 py-3 text-right font-medium">vs LIBRA</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="row in orderedResults" :key="row.strategy" :class="row.strategy === mainCandidate?.strategy ? 'bg-emerald-50/60' : ''">
                  <td class="px-4 py-3 font-medium">{{ strategyLabel(row.strategy) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatPercent(row.totalReturnPct) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatNumber(row.sharpeRatio) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatPercent(row.maxDrawdownPct) }}</td>
                  <td class="px-4 py-3 text-right">{{ row.trades ?? '-' }}</td>
                  <td class="px-4 py-3 text-right">{{ formatKrw(row.transactionCostKrw) }}</td>
                  <td class="px-4 py-3 text-right font-medium" :class="toneClass(row.returnGapVsLibraPctPoints)">
                    {{ formatSignedPercent(toNumber(row.returnGapVsLibraPctPoints)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h2 class="text-base font-semibold">Trade-level 진단</h2>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Signals</div>
                <div class="mt-2 text-lg font-semibold">{{ validation.tradeAlphaSummary.signals }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Executed</div>
                <div class="mt-2 text-lg font-semibold">{{ validation.tradeAlphaSummary.v3Executed }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">Skipped</div>
                <div class="mt-2 text-lg font-semibold">{{ validation.tradeAlphaSummary.v3Skipped }}</div>
              </div>
              <div class="rounded border border-gray-200 bg-gray-50 p-3">
                <div class="text-xs text-gray-500">60D negative</div>
                <div class="mt-2 text-lg font-semibold">
                  {{ validation.tradeAlphaSummary.v1Negative60d }} → {{ validation.tradeAlphaSummary.v3Negative60d }}
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white">
            <div class="border-b border-gray-200 px-5 py-4">
              <h2 class="text-base font-semibold">v1 vs v3 체결 비교</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-[900px] w-full text-left text-sm">
                <thead class="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th class="px-4 py-3 font-medium">Signal</th>
                    <th class="px-4 py-3 font-medium">Confirm</th>
                    <th class="px-4 py-3 font-medium">Execute</th>
                    <th class="px-4 py-3 text-right font-medium">v1 60D</th>
                    <th class="px-4 py-3 text-right font-medium">v3 60D</th>
                    <th class="px-4 py-3 text-right font-medium">개선</th>
                    <th class="px-4 py-3 text-right font-medium">상태</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="row in validation.tradeAlpha" :key="row.signalDate">
                    <td class="px-4 py-3 font-mono">{{ row.signalDate }}</td>
                    <td class="px-4 py-3 font-mono text-gray-600">{{ row.v3ConfirmationDate || '-' }}</td>
                    <td class="px-4 py-3 font-mono text-gray-600">{{ row.v3ExecuteDate || '-' }}</td>
                    <td class="px-4 py-3 text-right" :class="toneClass(row.v1TradeAlpha60dPct)">{{ formatPercent(row.v1TradeAlpha60dPct) }}</td>
                    <td class="px-4 py-3 text-right" :class="toneClass(row.v3TradeAlpha60dPct)">{{ formatPercent(row.v3TradeAlpha60dPct) }}</td>
                    <td class="px-4 py-3 text-right font-medium" :class="toneClass(row.improvement60dPct)">
                      {{ formatSignedPercent(toNumber(row.improvement60dPct)) }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <span class="rounded border px-2 py-1 text-xs font-medium" :class="row.v3WasSkipped ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'">
                        {{ row.v3WasSkipped ? 'DEFER' : 'EXECUTE' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="text-base font-semibold">주의 문장</h2>
          <ul class="mt-3 space-y-2 text-sm text-gray-600">
            <li v-for="note in validation.notes" :key="note">- {{ note }}</li>
          </ul>
        </section>
      </div>
    </main>
  </div>
</template>
