<script setup lang="ts">
/**
 * src/pages/DashboardPage.vue v3
 *
 * v3 변경: 토스 톤 리디자인.
 * - 큰 숫자 + 작은 보조 설명
 * - 보더 제거, shadow-sm + rounded-3xl
 * - 회색 99% + 파랑 액센트 1개
 * - 넓은 여백 (카드 p-8, 섹션 gap-6)
 */

import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { scenarioCatalog } from '@/mocks/scenarios'

const router = useRouter()
const auth = useAuthStore()

const portfolio = ref({
  name: '내 IPS 포트폴리오',
  valueKrw: 47_280_000,
  volatility: 26,
  ipsVolatilityLimit: 20,
  allocations: [
    { ticker: '069500', name: 'KODEX 200', weight: 32, change: -0.8 },
    { ticker: '153130', name: '단기채권', weight: 28, change: 0.2 },
    { ticker: '273130', name: '미국나스닥', weight: 22, change: -1.2 },
    { ticker: '305080', name: '글로벌리츠', weight: 18, change: 0.4 },
  ],
  lastUpdated: new Date().toISOString(),
})

interface DecisionRecord {
  threadId: string
  scenarioName: string
  optionLabel: string
  status: 'approved' | 'cancelled'
  completedAt: string
}
const decisions = ref<DecisionRecord[]>([])

interface StoredHolding {
  ticker: string
  name: string
  weight: number
}

// 설정 페이지는 등락률을 수집하지 않으므로 ticker 기반 결정적 값으로 생성
// (-2.0% ~ +2.0%, 새로고침해도 동일)
function pseudoChange(ticker: string): number {
  let h = 0
  for (let i = 0; i < ticker.length; i++) {
    h = (h * 31 + ticker.charCodeAt(i)) >>> 0
  }
  return Math.round(((h % 401) / 100 - 2) * 10) / 10
}

// /portfolio/setup 에서 저장한 사용자 정의 인덱스를 대시보드 포트폴리오에 반영.
// 이름·자산배분만 실데이터, 평가액·변동성은 미수집이라 시안 mock 유지.
function loadCustomIndex() {
  const stored = sessionStorage.getItem('libra_custom_index')
  if (!stored) return
  try {
    const parsed = JSON.parse(stored)
    const holdings: StoredHolding[] = Array.isArray(parsed.holdings) ? parsed.holdings : []
    if (holdings.length === 0) return
    if (typeof parsed.name === 'string' && parsed.name.trim()) {
      portfolio.value.name = parsed.name.trim()
    }
    portfolio.value.allocations = holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name || h.ticker,
      weight: h.weight,
      change: pseudoChange(h.ticker),
    }))
    portfolio.value.lastUpdated = new Date().toISOString()
  } catch {
    // 무시
  }
}

const selectedScenarioId = ref<string>('fomc')

onMounted(async () => {
  try {
    await auth.loadProfile()
  } catch {
    // 시안 단계 무시
  }
  decisions.value = JSON.parse(sessionStorage.getItem('libra_decisions') || '[]')
  loadCustomIndex()
})

function onLogout() {
  auth.logout()
  router.replace('/login')
}

function goToPortfolioSetup() {
  router.push('/portfolio/setup')
}

function goToIps() {
  router.push('/ips')
}

function startRebalancingReview() {
  const selected = scenarioCatalog.find((s) => s.id === selectedScenarioId.value)
  if (!selected) return
  const threadId = `${selected.threadIdPrefix}_${Date.now()}`
  router.push(`/run/${threadId}`)
}

function goToFinalReport(threadId: string) {
  router.push(`/run/${threadId}/report`)
}

const volatilityBreach = computed(
  () => portfolio.value.volatility > portfolio.value.ipsVolatilityLimit
)
const volatilityBarWidth = computed(() => {
  const max = portfolio.value.ipsVolatilityLimit * 1.5
  return Math.min(100, (portfolio.value.volatility / max) * 100)
})
const limitBarWidth = computed(() => {
  const max = portfolio.value.ipsVolatilityLimit * 1.5
  return (portfolio.value.ipsVolatilityLimit / max) * 100
})

function formatKrw(n: number): string {
  return '₩' + n.toLocaleString('ko-KR')
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}

function changeColor(change: number): string {
  if (change > 0) return 'text-emerald-600'
  if (change < 0) return 'text-red-600'
  return 'text-gray-500'
}

function formatChange(change: number): string {
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
}

const selectedScenario = computed(() =>
  scenarioCatalog.find((s) => s.id === selectedScenarioId.value)
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 헤더 — 보더 없이 -->
    <header class="bg-white">
      <div class="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div
            class="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold"
          >L</div>
          <span class="text-base font-bold tracking-tight">Libra</span>
        </div>
        <div class="flex items-center gap-5">
          <span class="text-xs text-gray-400" v-if="auth.user?.email">{{ auth.user.email }}</span>
          <button
            @click="onLogout"
            class="text-xs text-gray-500 hover:text-gray-900 transition"
          >로그아웃</button>
        </div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 pb-16 pt-6">
      <!-- ============================================================== -->
      <!-- 1. 인사 + 액션 트리거 -->
      <!-- ============================================================== -->
      <div class="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div>
          <div class="text-sm text-gray-400 mb-1">대시보드</div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            {{ auth.user?.email?.split('@')[0] || '안녕하세요' }}님
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="goToIps"
            class="text-xs font-medium text-gray-600 hover:text-gray-900 bg-white rounded-full px-4 py-2 shadow-sm hover:shadow transition"
          >IPS</button>
          <button
            @click="goToPortfolioSetup"
            class="text-xs font-medium text-gray-600 hover:text-gray-900 bg-white rounded-full px-4 py-2 shadow-sm hover:shadow transition"
          >포트폴리오 설정</button>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 2. Hero — 평가액 큰 숫자 -->
      <!-- ============================================================== -->
      <div class="bg-white rounded-3xl p-8 shadow-sm mb-4">
        <div class="text-sm text-gray-400 mb-2">{{ portfolio.name }}</div>
        <div class="text-4xl font-bold tracking-tight text-gray-900 mb-1 leading-none">
          {{ formatKrw(portfolio.valueKrw) }}
        </div>
        <div class="text-sm text-gray-500 mt-2">
          평가액 ·
          <span class="text-gray-400">{{ formatRelativeTime(portfolio.lastUpdated) }} 기준</span>
        </div>

        <!-- 변동성 미니 표시 -->
        <div class="mt-6 pt-6 border-t border-gray-100">
          <div class="flex items-baseline justify-between mb-2">
            <span class="text-sm text-gray-500">변동성</span>
            <div class="flex items-baseline gap-1.5">
              <span
                class="text-xl font-bold font-mono"
                :class="volatilityBreach ? 'text-red-600' : 'text-gray-900'"
              >{{ portfolio.volatility }}%</span>
              <span class="text-xs text-gray-400">/ 한도 {{ portfolio.ipsVolatilityLimit }}%</span>
            </div>
          </div>
          <div class="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="absolute top-0 bottom-0 w-px bg-gray-400 z-10"
              :style="{ left: `${limitBarWidth}%` }"
            ></div>
            <div
              class="h-full transition-all"
              :class="volatilityBreach ? 'bg-red-400' : 'bg-emerald-400'"
              :style="{ width: `${volatilityBarWidth}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 3. 변동성 한도 알림 (조건부) -->
      <!-- ============================================================== -->
      <div
        v-if="volatilityBreach"
        class="bg-amber-50 rounded-3xl p-6 mb-4 flex items-start gap-4"
      >
        <div class="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold text-amber-900 mb-0.5">변동성 한도 초과</div>
          <div class="text-sm text-amber-800/90 leading-relaxed">
            현재 변동성 <span class="font-bold">{{ portfolio.volatility }}%</span>가
            IPS 한도 {{ portfolio.ipsVolatilityLimit }}%를 넘었어요. 리밸런싱을 검토해 보세요.
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 4. 액션 CTA — 큰 어두운 카드 -->
      <!-- ============================================================== -->
      <div class="bg-gray-900 text-white rounded-3xl p-8 mb-4 relative overflow-hidden">
        <div class="relative z-10">
          <div class="text-xs font-medium tracking-wider text-gray-400 mb-2">ACTION</div>
          <h2 class="text-2xl font-bold mb-2 leading-tight">리밸런싱 검토</h2>
          <p class="text-sm text-gray-300 leading-relaxed mb-6 max-w-md">
            11명의 AI 에이전트가 시장·위험·제약을 분석하고
            의사결정 옵션을 제시합니다.
          </p>

          <div class="flex items-stretch gap-3 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <div class="text-[10px] tracking-wider text-gray-500 mb-1.5">시연 시나리오</div>
              <select
                v-model="selectedScenarioId"
                class="w-full bg-white/10 text-white text-sm px-4 py-3 rounded-xl backdrop-blur focus:outline-none focus:bg-white/15 cursor-pointer transition"
              >
                <option v-for="s in scenarioCatalog" :key="s.id" :value="s.id" class="text-gray-900">
                  {{ s.label }}
                </option>
              </select>
            </div>
            <button
              @click="startRebalancingReview"
              class="bg-white text-gray-900 text-sm font-bold rounded-xl px-7 self-end h-[46px] hover:bg-gray-100 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <span>검토 시작</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div v-if="selectedScenario" class="text-xs text-gray-400 mt-3 leading-relaxed">
            {{ selectedScenario.description }}
          </div>
        </div>
        <div class="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/[0.04]"></div>
        <div class="absolute -bottom-16 -right-6 w-36 h-36 rounded-full bg-white/[0.03]"></div>
      </div>

      <!-- ============================================================== -->
      <!-- 5. 2-col: 자산 배분 + 결정 이력 -->
      <!-- ============================================================== -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 자산 배분 -->
        <div class="bg-white rounded-3xl p-7 shadow-sm">
          <div class="flex items-baseline justify-between mb-5">
            <h3 class="text-lg font-bold text-gray-900">자산 배분</h3>
            <span class="text-xs text-gray-400">{{ portfolio.allocations.length }}종목</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="alloc in portfolio.allocations"
              :key="alloc.ticker"
              class="flex items-center gap-3"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 mb-1">
                  <span class="text-sm font-medium text-gray-900 truncate">{{ alloc.name }}</span>
                  <span class="text-[11px] font-mono text-gray-400 flex-shrink-0">{{ alloc.ticker }}</span>
                </div>
                <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gray-900 rounded-full transition-all"
                    :style="{ width: `${Math.min(100, alloc.weight * 2)}%` }"
                  ></div>
                </div>
              </div>
              <div class="text-right w-20 flex-shrink-0">
                <div class="text-base font-bold font-mono text-gray-900 leading-none">{{ alloc.weight }}%</div>
                <div class="text-[11px] font-mono mt-1" :class="changeColor(alloc.change)">{{ formatChange(alloc.change) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 결정 이력 -->
        <div class="bg-white rounded-3xl p-7 shadow-sm">
          <div class="flex items-baseline justify-between mb-5">
            <h3 class="text-lg font-bold text-gray-900">최근 결정</h3>
            <span class="text-xs text-gray-400">{{ decisions.length }}건</span>
          </div>

          <div v-if="decisions.length === 0" class="text-center py-10">
            <div class="text-sm text-gray-400 mb-1">아직 결정 이력이 없어요</div>
            <div class="text-xs text-gray-300">검토를 시작하면 여기에 쌓여요</div>
          </div>

          <div v-else class="space-y-1">
            <button
              v-for="(d, i) in decisions.slice(0, 5)"
              :key="i"
              @click="goToFinalReport(d.threadId)"
              class="w-full text-left flex items-center gap-3 py-3 hover:bg-gray-50 rounded-xl px-3 -mx-3 transition group"
            >
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="d.status === 'approved' ? 'bg-emerald-400' : 'bg-gray-300'"
              ></span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">{{ d.scenarioName }}</div>
                <div class="text-xs text-gray-500 mt-0.5 truncate">
                  <span :class="d.status === 'approved' ? 'text-emerald-600 font-medium' : ''">
                    {{ d.optionLabel }}
                  </span>
                  <span class="text-gray-300 mx-1">·</span>
                  <span>{{ formatRelativeTime(d.completedAt) }}</span>
                </div>
              </div>
              <svg
                class="w-4 h-4 text-gray-300 group-hover:text-gray-700 transition flex-shrink-0"
                fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 6. 푸터 -->
      <!-- ============================================================== -->
      <div class="mt-10 text-center text-xs text-gray-400">
        Libra · Agentic AI Portfolio Rebalancing
        <span class="text-gray-300 mx-1">·</span>
        시안 단계 (백엔드 미연결)
      </div>
    </main>
  </div>
</template>