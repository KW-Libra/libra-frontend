<script setup lang="ts">
/**
 * src/pages/PortfolioSetupPage.vue
 *
 * 다이렉트 인덱싱 설정 페이지.
 * 사용자가 종목(ticker)·이름·목표 비중(%)을 직접 입력해
 * 나만의 인덱스를 정의한다. (백엔드 미연결 — sessionStorage 저장)
 *
 * 스타일은 DashboardPage.vue 기준.
 */

import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

interface Holding {
  ticker: string
  name: string
  weight: number
}

const indexName = ref('나만의 인덱스')
const holdings = ref<Holding[]>([])

const form = ref({ ticker: '', name: '', weight: null as number | null })
const formError = ref('')
const saved = ref(false)

const editingIndex = ref<number | null>(null)
const editForm = ref({ ticker: '', name: '', weight: null as number | null })
const editError = ref('')

onMounted(async () => {
  try {
    await auth.loadProfile()
  } catch {
    // 시안 단계 무시
  }
  const stored = sessionStorage.getItem('libra_custom_index')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      indexName.value = parsed.name ?? indexName.value
      holdings.value = Array.isArray(parsed.holdings) ? parsed.holdings : []
    } catch {
      // 무시
    }
  }
})

const totalWeight = computed(() =>
  holdings.value.reduce((sum, h) => sum + h.weight, 0)
)
const remainingWeight = computed(() => 100 - totalWeight.value)
const isBalanced = computed(() => totalWeight.value === 100)
const canSave = computed(() => holdings.value.length > 0 && isBalanced.value)

function addHolding() {
  formError.value = ''
  const ticker = form.value.ticker.trim()
  const name = form.value.name.trim()
  const weight = form.value.weight

  if (!ticker) {
    formError.value = '종목 코드를 입력하세요.'
    return
  }
  if (weight === null || weight <= 0) {
    formError.value = '목표 비중은 0보다 커야 합니다.'
    return
  }
  if (holdings.value.some((h) => h.ticker === ticker)) {
    formError.value = '이미 추가된 종목입니다.'
    return
  }
  if (totalWeight.value + weight > 100) {
    formError.value = `비중 합계가 100%를 초과합니다. (잔여 ${remainingWeight.value}%)`
    return
  }

  holdings.value.push({ ticker, name: name || ticker, weight })
  form.value = { ticker: '', name: '', weight: null }
  saved.value = false
}

function removeHolding(index: number) {
  holdings.value.splice(index, 1)
  saved.value = false
}

function startEdit(index: number) {
  formError.value = ''
  editError.value = ''
  editingIndex.value = index
  const h = holdings.value[index]
  editForm.value = { ticker: h.ticker, name: h.name, weight: h.weight }
}

function cancelEdit() {
  editingIndex.value = null
  editError.value = ''
}

function saveEdit() {
  if (editingIndex.value === null) return
  editError.value = ''
  const idx = editingIndex.value
  const ticker = editForm.value.ticker.trim()
  const name = editForm.value.name.trim()
  const weight = editForm.value.weight

  if (!ticker) {
    editError.value = '종목 코드를 입력하세요.'
    return
  }
  if (weight === null || weight <= 0) {
    editError.value = '목표 비중은 0보다 커야 합니다.'
    return
  }
  if (holdings.value.some((h, j) => j !== idx && h.ticker === ticker)) {
    editError.value = '이미 추가된 종목입니다.'
    return
  }
  const othersTotal = holdings.value.reduce(
    (sum, h, j) => (j === idx ? sum : sum + h.weight),
    0
  )
  if (othersTotal + weight > 100) {
    editError.value = `비중 합계가 100%를 초과합니다. (잔여 ${100 - othersTotal}%)`
    return
  }

  holdings.value[idx] = { ticker, name: name || ticker, weight }
  editingIndex.value = null
  saved.value = false
}

function fillRemaining() {
  if (remainingWeight.value > 0) {
    form.value.weight = remainingWeight.value
  }
}

function save() {
  if (!canSave.value) return
  sessionStorage.setItem(
    'libra_custom_index',
    JSON.stringify({ name: indexName.value.trim() || '나만의 인덱스', holdings: holdings.value })
  )
  saved.value = true
}

function goBack() {
  router.push('/dashboard')
}

function onLogout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 헤더 -->
    <header class="border-b border-gray-200 bg-white">
      <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
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
      <div class="mb-8 flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-medium tracking-tight mb-1">포트폴리오 설정</h1>
          <p class="text-sm text-gray-600">다이렉트 인덱싱 — 종목과 목표 비중을 직접 정의합니다</p>
        </div>
        <button
          @click="goBack"
          class="text-xs text-gray-600 hover:text-gray-900 transition flex items-center gap-1"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>대시보드</span>
        </button>
      </div>

      <div class="grid grid-cols-3 gap-6">
        <!-- 좌측: 인덱스 정의 -->
        <div class="col-span-2 space-y-6">
          <!-- 인덱스 이름 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <label class="block text-xs font-medium tracking-wider text-gray-500 mb-2">인덱스 이름</label>
            <input
              v-model="indexName"
              type="text"
              placeholder="나만의 인덱스"
              class="w-full text-lg font-medium px-0 py-1 border-0 border-b border-gray-200 focus:outline-none focus:border-gray-900 transition"
            />
          </div>

          <!-- 종목 추가 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-4">종목 추가</div>
            <div class="flex items-end gap-3">
              <div class="w-28">
                <label class="block text-[11px] text-gray-500 mb-1.5">종목 코드</label>
                <input
                  v-model="form.ticker"
                  type="text"
                  placeholder="069500"
                  @keyup.enter="addHolding"
                  class="w-full text-sm font-mono px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition"
                />
              </div>
              <div class="flex-1">
                <label class="block text-[11px] text-gray-500 mb-1.5">종목명 <span class="text-gray-300">(선택)</span></label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="KODEX 200"
                  @keyup.enter="addHolding"
                  class="w-full text-sm px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition"
                />
              </div>
              <div class="w-28">
                <label class="block text-[11px] text-gray-500 mb-1.5">목표 비중</label>
                <div class="relative">
                  <input
                    v-model.number="form.weight"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    @keyup.enter="addHolding"
                    class="w-full text-sm font-mono px-3 py-2 pr-7 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
              </div>
              <button
                @click="addHolding"
                class="bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-md hover:bg-gray-800 transition"
              >추가</button>
            </div>

            <div class="flex items-center justify-between mt-3 min-h-[16px]">
              <p v-if="formError" class="text-[11px] text-red-600">{{ formError }}</p>
              <button
                v-if="remainingWeight > 0 && holdings.length > 0"
                @click="fillRemaining"
                class="text-[11px] text-gray-500 hover:text-gray-900 transition ml-auto"
              >잔여 {{ remainingWeight }}% 채우기</button>
            </div>
          </div>

          <!-- 구성 종목 목록 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between mb-4">
              <div class="text-xs font-medium tracking-wider text-gray-500">구성 종목</div>
              <div class="text-xs text-gray-400">{{ holdings.length }}개 종목</div>
            </div>

            <div v-if="holdings.length === 0" class="text-center py-10">
              <div class="text-xs text-gray-400 mb-1">아직 추가된 종목이 없습니다</div>
              <div class="text-[10px] text-gray-300">위에서 종목과 목표 비중을 입력하세요</div>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="(h, i) in holdings"
                :key="h.ticker"
                class="py-2 border-b border-gray-100 last:border-0 group"
              >
                <!-- 편집 모드 -->
                <template v-if="editingIndex === i">
                  <div class="flex items-center gap-3">
                    <input
                      v-model="editForm.ticker"
                      type="text"
                      placeholder="069500"
                      @keyup.enter="saveEdit"
                      @keyup.esc="cancelEdit"
                      class="w-20 text-sm font-mono px-2.5 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition"
                    />
                    <input
                      v-model="editForm.name"
                      type="text"
                      placeholder="종목명"
                      @keyup.enter="saveEdit"
                      @keyup.esc="cancelEdit"
                      class="flex-1 text-sm px-2.5 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition"
                    />
                    <div class="relative w-24">
                      <input
                        v-model.number="editForm.weight"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        @keyup.enter="saveEdit"
                        @keyup.esc="cancelEdit"
                        class="w-full text-sm font-mono px-2.5 py-1.5 pr-6 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition"
                      />
                      <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    <button
                      @click="saveEdit"
                      class="text-gray-400 hover:text-emerald-600 transition"
                      aria-label="저장"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      @click="cancelEdit"
                      class="text-gray-300 hover:text-gray-700 transition"
                      aria-label="취소"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p v-if="editError" class="text-[11px] text-red-600 mt-1.5">{{ editError }}</p>
                </template>

                <!-- 일반 모드 -->
                <div v-else class="flex items-center gap-3">
                  <span class="text-[11px] font-mono text-gray-500 w-14">{{ h.ticker }}</span>
                  <span class="text-sm text-gray-800 flex-1">{{ h.name }}</span>
                  <div class="w-28">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-gray-700" :style="{ width: `${Math.min(100, h.weight)}%` }"></div>
                      </div>
                      <span class="text-xs font-mono text-gray-700 w-10 text-right">{{ h.weight }}%</span>
                    </div>
                  </div>
                  <div
                    class="flex items-center gap-1"
                    :class="editingIndex === null ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'"
                  >
                    <button
                      @click="startEdit(i)"
                      :disabled="editingIndex !== null"
                      class="text-gray-300 hover:text-gray-900 transition"
                      aria-label="수정"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      @click="removeHolding(i)"
                      :disabled="editingIndex !== null"
                      class="text-gray-300 hover:text-red-600 transition"
                      aria-label="삭제"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 우측: 비중 요약 + 저장 -->
        <div class="space-y-6">
          <div class="bg-gray-900 text-white rounded-lg p-6 relative overflow-hidden">
            <div class="relative z-10">
              <div class="text-xs font-medium tracking-wider text-gray-400 mb-2">비중 합계</div>
              <div class="flex items-baseline gap-2 mb-1">
                <span
                  class="text-3xl font-semibold font-mono"
                  :class="isBalanced ? 'text-emerald-400' : 'text-white'"
                >{{ totalWeight }}%</span>
                <span class="text-xs text-gray-400">/ 100%</span>
              </div>
              <div class="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-4 mt-3">
                <div
                  class="h-full transition-all"
                  :class="isBalanced ? 'bg-emerald-400' : totalWeight > 100 ? 'bg-red-400' : 'bg-gray-500'"
                  :style="{ width: `${Math.min(100, totalWeight)}%` }"
                ></div>
              </div>
              <p class="text-[11px] leading-relaxed mb-4" :class="isBalanced ? 'text-emerald-300' : 'text-gray-400'">
                <template v-if="isBalanced">비중 합계가 100%로 맞춰졌습니다.</template>
                <template v-else-if="remainingWeight > 0">잔여 비중 {{ remainingWeight }}%를 배분해야 합니다.</template>
                <template v-else>비중 합계가 100%를 초과했습니다.</template>
              </p>

              <button
                @click="save"
                :disabled="!canSave"
                class="w-full text-sm font-medium py-2.5 rounded-md transition flex items-center justify-center gap-2"
                :class="canSave
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
              >
                <span>{{ saved ? '저장됨' : '인덱스 저장' }}</span>
                <svg v-if="!saved" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <svg v-else class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <p v-if="saved" class="text-[10px] text-emerald-300 text-center mt-2">
                인덱스가 저장되었습니다 (시안 — 세션 저장)
              </p>
            </div>
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5"></div>
            <div class="absolute -bottom-12 -right-4 w-24 h-24 rounded-full bg-white/5"></div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-5">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">다이렉트 인덱싱이란?</div>
            <p class="text-[11px] text-gray-500 leading-relaxed">
              ETF·펀드를 사는 대신 개별 종목을 직접 보유해
              나만의 지수를 구성하는 방식입니다. 세금·비중을
              직접 통제할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-10 text-center text-[10px] text-gray-400">
        Libra · Agentic AI Portfolio Rebalancing · 시안 단계 (백엔드 미연결)
      </div>
    </main>
  </div>
</template>
