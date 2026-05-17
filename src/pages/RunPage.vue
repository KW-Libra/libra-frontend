<script setup lang="ts">
/**
 * src/pages/RunPage.vue v2
 *
 * Run 진행 중 화면 — 5단계 stepper가 순차적으로 채워짐.
 * 라우트: /run/:threadId
 *
 * 시안용 setTimeout 시뮬레이션. Phase 5+ 에서 실제 SSE 스트림으로 교체 예정.
 *
 * 단계 시퀀스 (시안):
 *   Compliance (0.8s) → Round 1 (1.6s) → Mediator (0.7s) → Round 2 (1.5s) → Final Judge (0.9s)
 * 총 ~5.5s. 끝나면 result 페이지로 자동 이동.
 */

import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

interface StageState {
  name: string
  label: string
  description: string
  durationMs: number
  status: 'pending' | 'active' | 'completed'
  startedAt?: number
  completedAt?: number
}

const router = useRouter()
const route = useRoute()
const threadId = route.params.threadId as string

const stages = ref<StageState[]>([
  {
    name: 'compliance',
    label: 'Compliance',
    description: 'IPS 한도 및 ESG 정책 검증',
    durationMs: 800,
    status: 'pending',
  },
  {
    name: 'round1',
    label: 'Round 1',
    description: '11명 에이전트가 1차 의견 형성',
    durationMs: 1600,
    status: 'pending',
  },
  {
    name: 'mediator',
    label: 'Mediator',
    description: '충돌 식별 및 표적 재호출 결정',
    durationMs: 700,
    status: 'pending',
  },
  {
    name: 'round2',
    label: 'Round 2',
    description: '충돌 당사자에게 다른 의견 노출',
    durationMs: 1500,
    status: 'pending',
  },
  {
    name: 'final_judge',
    label: 'Final Judge',
    description: '합의 점수 산정 및 분기 결정',
    durationMs: 900,
    status: 'pending',
  },
])

const elapsed = ref(0)
const timers: ReturnType<typeof setTimeout>[] = []
let elapsedInterval: ReturnType<typeof setInterval> | null = null
const startTime = ref(0)

function startStage(idx: number) {
  if (idx >= stages.value.length) {
    // 모든 단계 완료 → result로 이동
    timers.push(
      setTimeout(() => {
        router.replace(`/run/${threadId}/result`)
      }, 400)
    )
    return
  }

  stages.value[idx].status = 'active'
  stages.value[idx].startedAt = Date.now()

  timers.push(
    setTimeout(() => {
      stages.value[idx].status = 'completed'
      stages.value[idx].completedAt = Date.now()
      startStage(idx + 1)
    }, stages.value[idx].durationMs)
  )
}

onMounted(() => {
  startTime.value = Date.now()
  elapsedInterval = setInterval(() => {
    elapsed.value = (Date.now() - startTime.value) / 1000
  }, 100)
  startStage(0)
})

onUnmounted(() => {
  timers.forEach((t) => clearTimeout(t))
  if (elapsedInterval) clearInterval(elapsedInterval)
})

// 현재 활성 단계 찾기
function activeStage(): StageState | undefined {
  return stages.value.find((s) => s.status === 'active')
}

function completedCount(): number {
  return stages.value.filter((s) => s.status === 'completed').length
}

function stageDuration(stage: StageState): string {
  if (stage.status === 'completed' && stage.startedAt && stage.completedAt) {
    return `${((stage.completedAt - stage.startedAt) / 1000).toFixed(1)}s`
  }
  if (stage.status === 'active' && stage.startedAt) {
    return `${((Date.now() - stage.startedAt) / 1000).toFixed(1)}s`
  }
  return ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div class="max-w-3xl mx-auto px-8 py-16">
      <!-- 헤더 -->
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-3">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            진행 중
          </span>
          <span class="text-xs text-gray-400 font-mono">{{ threadId }}</span>
        </div>
        <h1 class="text-2xl font-medium tracking-tight mb-2">
          에이전트들이 분석 중
        </h1>
        <p class="text-sm text-gray-600">
          11명의 AI 에이전트가 시장·위험·제약을 평가하고 의사결정 옵션을 도출합니다.
        </p>
      </div>

      <!-- 현재 상태 카드 -->
      <div
        class="mb-8 p-6 bg-white border border-gray-200 rounded-lg flex items-center gap-4"
      >
        <div class="flex-shrink-0">
          <div
            class="w-12 h-12 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"
          ></div>
        </div>
        <div class="flex-1">
          <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">
            현재 단계 · {{ completedCount() }} / {{ stages.length }}
          </div>
          <div class="text-base font-medium text-gray-900 mb-0.5">
            {{ activeStage()?.label ?? '준비 중...' }}
          </div>
          <div class="text-xs text-gray-500">
            {{ activeStage()?.description ?? '' }}
          </div>
        </div>
        <div class="text-right">
          <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">
            경과
          </div>
          <div class="text-lg font-mono font-semibold text-gray-900">
            {{ elapsed.toFixed(1) }}s
          </div>
        </div>
      </div>

      <!-- Stepper -->
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="text-xs font-medium tracking-wider text-gray-500 mb-6">
          진행 단계
        </div>

        <div class="space-y-1">
          <div
            v-for="(stage, idx) in stages"
            :key="stage.name"
            class="flex items-start gap-4 py-3 relative"
          >
            <!-- 연결선 (마지막 제외) -->
            <div
              v-if="idx < stages.length - 1"
              class="absolute left-3 top-9 bottom-0 w-px"
              :class="stage.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-200'"
            ></div>

            <!-- 점 / 체크 -->
            <div class="relative z-10 flex-shrink-0 mt-0.5">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                :class="{
                  'bg-emerald-500 text-white': stage.status === 'completed',
                  'bg-blue-500 text-white ring-4 ring-blue-100': stage.status === 'active',
                  'bg-gray-100 text-gray-400 border border-gray-200': stage.status === 'pending',
                }"
              >
                <svg
                  v-if="stage.status === 'completed'"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span
                  v-else-if="stage.status === 'active'"
                  class="w-2 h-2 rounded-full bg-white animate-pulse"
                ></span>
                <span
                  v-else
                  class="text-[10px] font-medium"
                >{{ idx + 1 }}</span>
              </div>
            </div>

            <!-- 내용 -->
            <div class="flex-1 min-w-0 pb-2">
              <div class="flex items-baseline justify-between gap-3">
                <span
                  class="text-sm font-medium transition-colors"
                  :class="{
                    'text-gray-900': stage.status !== 'pending',
                    'text-gray-400': stage.status === 'pending',
                  }"
                >
                  {{ stage.label }}
                </span>
                <span
                  v-if="stageDuration(stage)"
                  class="text-[10px] font-mono"
                  :class="{
                    'text-emerald-600': stage.status === 'completed',
                    'text-blue-600': stage.status === 'active',
                  }"
                >
                  {{ stageDuration(stage) }}
                </span>
              </div>
              <div
                class="text-xs mt-0.5 transition-colors"
                :class="{
                  'text-gray-600': stage.status !== 'pending',
                  'text-gray-400': stage.status === 'pending',
                }"
              >
                {{ stage.description }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 푸터 -->
      <div class="mt-6 text-center text-[10px] text-gray-400">
        결정이 도출되면 자동으로 결과 화면으로 이동합니다.
      </div>
    </div>
  </div>
</template>