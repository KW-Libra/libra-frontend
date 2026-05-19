<script setup lang="ts">
/**
 * src/pages/PortfolioIpsPage.vue
 *
 * IPS(투자정책서) 설정 페이지.
 * 투자 성향, 리밸런싱 임계치, 최대 단일 종목 비중을 정의한다.
 * (백엔드 미연결 — sessionStorage 저장)
 *
 * 스타일은 DashboardPage.vue / PortfolioSetupPage.vue 기준.
 */

import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

type RiskProfile = 'conservative' | 'neutral' | 'aggressive'

interface ProfileOption {
  value: RiskProfile
  label: string
  desc: string
}

const profileOptions: ProfileOption[] = [
  { value: 'conservative', label: '보수적', desc: '자본 보존 우선 · 낮은 변동성' },
  { value: 'neutral', label: '중립', desc: '수익과 위험의 균형' },
  { value: 'aggressive', label: '공격적', desc: '성장 우선 · 높은 변동성 감내' },
]

const riskProfile = ref<RiskProfile>('neutral')
const rebalanceThreshold = ref(5)
const maxSingleWeight = ref(25)
const saved = ref(false)

onMounted(async () => {
  try {
    await auth.loadProfile()
  } catch {
    // 시안 단계 무시
  }
  const stored = sessionStorage.getItem('libra_ips_settings')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (profileOptions.some((o) => o.value === parsed.riskProfile)) {
        riskProfile.value = parsed.riskProfile
      }
      if (typeof parsed.rebalanceThreshold === 'number') {
        rebalanceThreshold.value = parsed.rebalanceThreshold
      }
      if (typeof parsed.maxSingleWeight === 'number') {
        maxSingleWeight.value = parsed.maxSingleWeight
      }
    } catch {
      // 무시
    }
  }
})

const selectedProfile = computed(() =>
  profileOptions.find((o) => o.value === riskProfile.value)
)

function selectProfile(value: RiskProfile) {
  riskProfile.value = value
  saved.value = false
}

function save() {
  sessionStorage.setItem(
    'libra_ips_settings',
    JSON.stringify({
      riskProfile: riskProfile.value,
      rebalanceThreshold: rebalanceThreshold.value,
      maxSingleWeight: maxSingleWeight.value,
    })
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
          <h1 class="text-2xl font-medium tracking-tight mb-1">IPS 설정</h1>
          <p class="text-sm text-gray-600">투자정책서 — 투자 성향과 리밸런싱 규칙을 정의합니다</p>
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
        <!-- 좌측: IPS 정의 -->
        <div class="col-span-2 space-y-6">
          <!-- 투자 성향 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-4">투자 성향</div>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="opt in profileOptions"
                :key="opt.value"
                @click="selectProfile(opt.value)"
                class="text-left border rounded-lg p-4 transition"
                :class="riskProfile === opt.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 hover:border-gray-400'"
              >
                <div class="text-sm font-medium mb-1">{{ opt.label }}</div>
                <div
                  class="text-[11px] leading-relaxed"
                  :class="riskProfile === opt.value ? 'text-gray-300' : 'text-gray-500'"
                >{{ opt.desc }}</div>
              </button>
            </div>
          </div>

          <!-- 리밸런싱 임계치 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between mb-1">
              <div class="text-xs font-medium tracking-wider text-gray-500">리밸런싱 임계치</div>
              <span class="text-lg font-semibold font-mono">{{ rebalanceThreshold }}%</span>
            </div>
            <p class="text-[11px] text-gray-500 mb-4 leading-relaxed">
              목표 비중과의 괴리가 이 값을 넘으면 리밸런싱 검토를 트리거합니다.
            </p>
            <input
              v-model.number="rebalanceThreshold"
              @input="saved = false"
              type="range"
              min="1"
              max="20"
              step="1"
              class="w-full accent-gray-900 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-gray-400 mt-1.5 font-mono">
              <span>1%</span>
              <span>20%</span>
            </div>
          </div>

          <!-- 최대 단일 종목 비중 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between mb-1">
              <div class="text-xs font-medium tracking-wider text-gray-500">최대 단일 종목 비중</div>
              <span class="text-lg font-semibold font-mono">{{ maxSingleWeight }}%</span>
            </div>
            <p class="text-[11px] text-gray-500 mb-4 leading-relaxed">
              한 종목이 포트폴리오에서 차지할 수 있는 비중 상한입니다. (집중 위험 제한)
            </p>
            <input
              v-model.number="maxSingleWeight"
              @input="saved = false"
              type="range"
              min="5"
              max="50"
              step="5"
              class="w-full accent-gray-900 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-gray-400 mt-1.5 font-mono">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>
        </div>

        <!-- 우측: 요약 + 저장 -->
        <div class="space-y-6">
          <div class="bg-gray-900 text-white rounded-lg p-6 relative overflow-hidden">
            <div class="relative z-10">
              <div class="text-xs font-medium tracking-wider text-gray-400 mb-4">IPS 요약</div>

              <div class="space-y-3 mb-5">
                <div>
                  <div class="text-[10px] text-gray-500 tracking-wider mb-0.5">투자 성향</div>
                  <div class="text-sm font-medium">{{ selectedProfile?.label }}</div>
                </div>
                <div class="h-px bg-gray-800"></div>
                <div class="flex items-baseline justify-between">
                  <div class="text-[10px] text-gray-500 tracking-wider">리밸런싱 임계치</div>
                  <div class="text-sm font-semibold font-mono">{{ rebalanceThreshold }}%</div>
                </div>
                <div class="flex items-baseline justify-between">
                  <div class="text-[10px] text-gray-500 tracking-wider">최대 단일 비중</div>
                  <div class="text-sm font-semibold font-mono">{{ maxSingleWeight }}%</div>
                </div>
              </div>

              <button
                @click="save"
                class="w-full text-sm font-medium py-2.5 rounded-md transition flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-gray-100"
              >
                <span>{{ saved ? '저장됨' : 'IPS 저장' }}</span>
                <svg v-if="!saved" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <svg v-else class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <p v-if="saved" class="text-[10px] text-emerald-300 text-center mt-2">
                IPS가 저장되었습니다 (시안 — 세션 저장)
              </p>
            </div>
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5"></div>
            <div class="absolute -bottom-12 -right-4 w-24 h-24 rounded-full bg-white/5"></div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-5">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">IPS란?</div>
            <p class="text-[11px] text-gray-500 leading-relaxed">
              IPS(Investment Policy Statement)는 투자 목표·위험 허용도·
              운용 규칙을 명문화한 문서입니다. AI 위원회는 이 정책을
              기준으로 리밸런싱 의사결정을 검토합니다.
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
