<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { brokerApi } from '@/api/broker'
import { useAuthStore } from '@/stores/auth'
import type {
  DecimalValue,
  KisBalance,
  KisOrderAudit,
  KisQuote,
  KisStatus,
  PortfolioSnapshot,
  ProblemDetail
} from '@/types/api'

const router = useRouter()
const auth = useAuthStore()

const status = ref<KisStatus | null>(null)
const balance = ref<KisBalance | null>(null)
const snapshots = ref<PortfolioSnapshot[]>([])
const audits = ref<KisOrderAudit[]>([])
const quote = ref<KisQuote | null>(null)
const quoteSymbol = ref('005930')

const loading = reactive({
  profile: false,
  status: false,
  balance: false,
  snapshots: false,
  audits: false,
  quote: false
})

const errors = reactive({
  status: '',
  balance: '',
  snapshots: '',
  audits: '',
  quote: ''
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
  } catch (e) {
    errors.status = errorMessage(e, 'KIS 상태를 불러오지 못했습니다')
  } finally {
    loading.status = false
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

        <div class="grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-4 lg:col-span-3 sm:grid-cols-4">
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
        </div>
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
