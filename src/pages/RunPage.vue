<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRunStreamStore } from '@/stores/runStream'
import {
  eventDetail,
  eventTitle,
  latestEvent,
  progressPercent,
  runThreadMatches,
  stageDotClass,
  stagePillClass,
  stageViews
} from '@/utils/runView'

const route = useRoute()
const router = useRouter()
const runStream = useRunStreamStore()

const threadId = computed(() => String(route.params.threadId || ''))
const hasLiveRun = computed(() =>
  runThreadMatches(threadId.value, runStream.currentThreadId, runStream.events)
)
const stages = computed(() => stageViews(runStream.events))
const progress = computed(() => progressPercent(stages.value))
const activeStage = computed(() => stages.value.find((stage) => stage.status === 'active'))
const lastEvent = computed(() => runStream.lastEvent)
const started = computed(() => latestEvent(runStream.events, 'run_started'))

watch(
  () => runStream.phase,
  (phase) => {
    if (!hasLiveRun.value) return
    if (phase === 'completed' || phase === 'interrupted' || phase === 'failed' || phase === 'ignored') {
      router.replace(`/run/${encodeURIComponent(threadId.value)}/result`)
    }
  },
  { immediate: true }
)

function goDashboard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div class="mx-auto max-w-3xl px-6 py-14">
      <div class="mb-10 flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              :class="runStream.isStreaming ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'"
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="runStream.isStreaming ? 'animate-pulse bg-blue-500' : 'bg-gray-400'"
              ></span>
              {{ runStream.phase }}
            </span>
            <span class="truncate font-mono text-xs text-gray-400">{{ threadId }}</span>
          </div>
          <h1 class="text-2xl font-semibold tracking-normal">
            {{ runStream.isStreaming ? '에이전트들이 분석 중입니다' : '판단 실행 상태' }}
          </h1>
          <p class="mt-2 text-sm leading-6 text-gray-600">
            {{ started?.data.query || '현재 실행의 라이브 이벤트를 기다리고 있습니다.' }}
          </p>
        </div>
        <button
          type="button"
          class="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
          @click="goDashboard"
        >
          대시보드
        </button>
      </div>

      <div v-if="!hasLiveRun" class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p class="text-base font-semibold text-gray-900">이 실행의 라이브 데이터가 없습니다</p>
        <p class="mt-2 text-sm leading-6 text-gray-500">
          새로고침했거나 다른 브라우저 세션에서 열린 실행입니다. 대시보드에서 판단을 다시 시작하면 실제 이벤트가 표시됩니다.
        </p>
        <button
          type="button"
          class="mt-6 h-10 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
          @click="goDashboard"
        >
          대시보드로 이동
        </button>
      </div>

      <template v-else>
        <section class="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-900 border-t-transparent animate-spin"></div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                현재 단계 · {{ progress }}%
              </div>
              <div class="mt-1 text-lg font-semibold text-gray-950">
                {{ activeStage?.label || '이벤트 수신 중' }}
              </div>
              <div class="mt-1 text-sm text-gray-500">
                {{ activeStage?.description || eventTitle(lastEvent!) }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">이벤트</div>
              <div class="mt-1 font-mono text-2xl font-semibold text-gray-950">{{ runStream.events.length }}</div>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-gray-200 bg-white p-6">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-sm font-semibold uppercase tracking-[0.14em] text-gray-600">진행 단계</h2>
            <button
              v-if="runStream.isStreaming"
              type="button"
              class="h-8 rounded-md border border-gray-300 px-3 text-xs text-gray-700 hover:bg-gray-50"
              @click="runStream.cancel"
            >
              중단
            </button>
          </div>

          <div class="space-y-2">
            <div
              v-for="(stage, index) in stages"
              :key="stage.node"
              class="relative flex items-start gap-4 rounded-lg border px-4 py-4"
              :class="stagePillClass(stage.status)"
            >
              <div
                v-if="index < stages.length - 1"
                class="absolute left-7 top-11 h-7 w-px"
                :class="stage.status === 'completed' ? 'bg-emerald-300' : 'bg-gray-200'"
              ></div>
              <div
                class="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                :class="stageDotClass(stage.status)"
              >
                <svg v-if="stage.status === 'completed'" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">{{ stage.label }}</p>
                <p class="mt-1 text-xs opacity-75">{{ stage.description }}</p>
              </div>
            </div>
          </div>
        </section>

        <section v-if="lastEvent" class="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <div class="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">최근 이벤트</div>
          <div class="mt-3 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-base font-semibold text-gray-950">{{ eventTitle(lastEvent) }}</p>
              <p v-if="eventDetail(lastEvent)" class="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {{ eventDetail(lastEvent) }}
              </p>
            </div>
            <span class="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500">
              {{ lastEvent.event }}
            </span>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
