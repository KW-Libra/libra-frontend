<script setup lang="ts">
/**
 * src/pages/DashboardPage.vue v2
 *
 * v2 변경: 시나리오 선택 드롭다운 추가 (시연 편의).
 * 3개 시나리오 중 선택 → 해당 분기로 진입.
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

const selectedScenarioId = ref<string>('fomc')

onMounted(async () => {
  try {
    await auth.loadProfile()
  } catch {
    // 시안 단계 무시
  }
  decisions.value = JSON.parse(sessionStorage.getItem('libra_decisions') || '[]')
})

function onLogout() {
  auth.logout()
  router.replace('/login')
}

function startRebalancingReview() {
  const selected = scenarioCatalog.find((s) => s.id === selectedScenarioId.value)
  if (!selected) return
  const threadId = `${selected.threadIdPrefix}_${Date.now()}`
  router.push(`/run/${threadId}`)
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
    <!-- 헤더 -->
    <header class="border-b border-gray-200 bg-white">
      <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded bg-gray-900 text-white flex items-center justify-center text-sm font-bold"
          >L</div>
          <span class="text-lg font-semibold tracking-tight">Libra</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-xs text-gray-500" v-if="auth.user?.email">{{ auth.user.email }}</span>
          <button
            @click="onLogout"
            class="text-xs text-gray-600 hover:text-gray-900 transition"
          >로그아웃</button>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-8 py-10">
      <div class="mb-8">
        <h1 class="text-2xl font-medium tracking-tight mb-1">대시보드</h1>
        <p class="text-sm text-gray-600">포트폴리오 현황 및 리밸런싱 검토</p>
      </div>

      <div
        v-if="volatilityBreach"
        class="flex items-stretch mb-6 bg-white border border-amber-200 rounded-lg overflow-hidden"
      >
        <div class="w-1 bg-amber-400"></div>
        <div class="flex-1 flex items-center gap-3 p-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span class="text-xs font-medium tracking-wider text-amber-700">변동성 한도 초과</span>
          </div>
          <div class="h-4 w-px bg-amber-200"></div>
          <div class="flex-1 text-xs text-gray-700">
            현재 변동성 <span class="font-semibold">{{ portfolio.volatility }}%</span>가
            IPS 한도 {{ portfolio.ipsVolatilityLimit }}%를 초과 — 리밸런싱 검토를 권장합니다.
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-6">
        <!-- 좌측: 포트폴리오 -->
        <div class="col-span-2 space-y-6">
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between mb-5">
              <div>
                <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">포트폴리오</div>
                <div class="text-lg font-medium">{{ portfolio.name }}</div>
              </div>
              <div class="text-right">
                <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">평가액</div>
                <div class="text-2xl font-semibold font-mono">{{ formatKrw(portfolio.valueKrw) }}</div>
              </div>
            </div>

            <div class="mb-6">
              <div class="flex items-baseline justify-between mb-2">
                <div class="text-xs font-medium tracking-wider text-gray-500">변동성 (IPS 한도 대비)</div>
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-sm font-semibold font-mono"
                    :class="volatilityBreach ? 'text-red-600' : 'text-gray-900'"
                  >{{ portfolio.volatility }}%</span>
                  <span class="text-xs text-gray-400">/ 한도 {{ portfolio.ipsVolatilityLimit }}%</span>
                </div>
              </div>
              <div class="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div class="absolute top-0 bottom-0 w-px bg-gray-400 z-10" :style="{ left: `${limitBarWidth}%` }"></div>
                <div
                  class="h-full transition-all"
                  :class="volatilityBreach ? 'bg-red-400' : 'bg-emerald-400'"
                  :style="{ width: `${volatilityBarWidth}%` }"
                ></div>
              </div>
            </div>

            <div>
              <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">자산 배분</div>
              <div class="space-y-2">
                <div
                  v-for="alloc in portfolio.allocations"
                  :key="alloc.ticker"
                  class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <span class="text-[11px] font-mono text-gray-500 w-14">{{ alloc.ticker }}</span>
                  <span class="text-sm text-gray-800 flex-1">{{ alloc.name }}</span>
                  <span class="text-xs font-mono" :class="changeColor(alloc.change)">{{ formatChange(alloc.change) }}</span>
                  <div class="w-24">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-gray-700" :style="{ width: `${alloc.weight * 2}%` }"></div>
                      </div>
                      <span class="text-xs font-mono text-gray-700 w-10 text-right">{{ alloc.weight }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 우측: CTA + 이력 -->
        <div class="space-y-6">
          <!-- 리밸런싱 검토 CTA + 시나리오 선택 -->
          <div class="bg-gray-900 text-white rounded-lg p-6 relative overflow-hidden">
            <div class="relative z-10">
              <div class="text-xs font-medium tracking-wider text-gray-400 mb-2">액션</div>
              <div class="text-lg font-medium mb-2">리밸런싱 검토</div>
              <p class="text-xs text-gray-300 mb-4 leading-relaxed">
                11명의 AI 에이전트가 시장·위험·제약을 분석하고
                의사결정 옵션을 제시합니다.
              </p>

              <!-- 시나리오 선택 (시연용) -->
              <div class="mb-4">
                <div class="text-[10px] text-gray-500 tracking-wider mb-1.5">시연 시나리오</div>
                <select
                  v-model="selectedScenarioId"
                  class="w-full bg-gray-800 text-white text-xs px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-gray-500 cursor-pointer"
                >
                  <option v-for="s in scenarioCatalog" :key="s.id" :value="s.id">
                    {{ s.label }}
                  </option>
                </select>
                <div v-if="selectedScenario" class="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                  {{ selectedScenario.description }}
                </div>
              </div>

              <button
                @click="startRebalancingReview"
                class="w-full bg-white text-gray-900 text-sm font-medium py-2.5 rounded-md hover:bg-gray-100 transition flex items-center justify-center gap-2"
              >
                <span>검토 시작</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5"></div>
            <div class="absolute -bottom-12 -right-4 w-24 h-24 rounded-full bg-white/5"></div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-5">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">최근 결정 이력</div>

            <div v-if="decisions.length === 0" class="text-center py-6">
              <div class="text-xs text-gray-400 mb-1">아직 결정 이력이 없습니다</div>
              <div class="text-[10px] text-gray-300">검토를 시작하면 여기에 표시됩니다</div>
            </div>

            <div v-else class="space-y-2.5">
              <div
                v-for="(d, i) in decisions.slice(0, 5)"
                :key="i"
                class="flex items-start gap-2.5 py-2 border-b border-gray-100 last:border-0"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  :class="d.status === 'approved' ? 'bg-emerald-400' : 'bg-gray-300'"
                ></span>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-gray-900 truncate">{{ d.scenarioName }}</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">
                    <span :class="d.status === 'approved' ? 'text-emerald-600 font-medium' : ''">
                      {{ d.optionLabel }}
                    </span>
                    <span class="text-gray-300 mx-1">·</span>
                    <span>{{ formatRelativeTime(d.completedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-10 text-center text-[10px] text-gray-400">
        Libra · Agentic AI Portfolio Rebalancing · 시안 단계 (백엔드 미연결)
      </div>
    </main>
  </div>
</template>