<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRunStreamStore } from '@/stores/runStream'
import {
  agentEvents,
  agentLabel,
  decisionHeadline,
  decisionToneClass,
  directionText,
  eventDetail,
  eventTitle,
  formatUnknown,
  latestEvent,
  percentText,
  progressPercent,
  runThreadMatches,
  stageDotClass,
  stagePillClass,
  stageViews,
  toolObservationCount
} from '@/utils/runView'

const route = useRoute()
const router = useRouter()
const runStream = useRunStreamStore()

const threadId = computed(() => String(route.params.threadId || ''))
const hasLiveRun = computed(() =>
  runThreadMatches(threadId.value, runStream.currentThreadId, runStream.events)
)
const started = computed(() => latestEvent(runStream.events, 'run_started'))
const finalDraft = computed(() => latestEvent(runStream.events, 'final_decision_draft'))
const mediator = computed(() => latestEvent(runStream.events, 'mediator_decision'))
const stages = computed(() => stageViews(runStream.events))
const agents = computed(() => agentEvents(runStream.events))
const progress = computed(() => progressPercent(stages.value))
const tools = computed(() => toolObservationCount(runStream.events))
const decision = computed(() =>
  runStream.completion?.decision || finalDraft.value?.data.decision || runStream.pendingInterrupt?.decision || null
)
const branch = computed(() => runStream.completion?.branch || finalDraft.value?.data.branch || null)
const headline = computed(() => decisionHeadline(decision.value, runStream.phase === 'failed' ? '판단 실행이 실패했습니다' : '판단 결과'))
const summary = computed(() =>
  finalDraft.value?.data.summary
  || runStream.pendingInterrupt?.message
  || runStream.completion?.run_status
  || started.value?.data.query
  || '실행 결과 이벤트가 아직 도착하지 않았습니다.'
)
const llmSkipped = computed(() => runStream.events.filter((event) => event.event === 'llm_skipped').length)

async function resume(approved: boolean, decisionValue: 'APPROVE' | 'REJECT' | 'REVISE') {
  await runStream.resume({
    approved,
    decision: decisionValue,
    option_index: decisionValue === 'APPROVE' ? 0 : decisionValue === 'REJECT' ? 1 : 2,
    note: `frontend:${decisionValue}`
  })
}

function goDashboard() {
  router.push('/dashboard')
}

function goReport() {
  router.push(`/run/${encodeURIComponent(threadId.value)}/report`)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div class="mx-auto max-w-3xl px-6 py-10">
      <div class="mb-10 flex items-center justify-between">
        <button
          type="button"
          class="text-sm text-gray-600 hover:text-gray-900"
          @click="goDashboard"
        >
          대시보드
        </button>
        <span class="font-mono text-xs text-gray-400">{{ threadId }}</span>
      </div>

      <div v-if="!hasLiveRun" class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p class="text-base font-semibold text-gray-900">이 실행의 결과 데이터가 없습니다</p>
        <p class="mt-2 text-sm leading-6 text-gray-500">
          결과 화면은 현재 세션에서 수신한 backend SSE 이벤트만 표시합니다.
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
        <section class="mb-12">
          <div class="mb-4 text-sm text-gray-400">
            {{ runStream.phase }}<span v-if="started?.data.trigger"> · {{ started.data.trigger }}</span>
          </div>
          <h1 class="text-3xl font-bold leading-tight tracking-normal" :class="decisionToneClass(decision).split(' ').at(-1)">
            {{ headline }}
          </h1>
          <p class="mt-3 text-base leading-7 text-gray-600">{{ summary }}</p>
        </section>

        <section class="mb-12 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="mb-2 text-sm text-gray-500">최종 결정</div>
          <div class="text-2xl font-bold text-gray-950">{{ decision || '대기 중' }}</div>
          <div class="mt-1 text-sm text-gray-500">{{ branch || started?.data.query }}</div>
          <div class="my-6 h-px bg-gray-100"></div>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div class="text-xs text-gray-500">진행률</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ progress }}%</div>
            </div>
            <div>
              <div class="text-xs text-gray-500">이벤트</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ runStream.events.length }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500">에이전트</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ agents.length }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500">도구</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ tools }}</div>
            </div>
          </div>
        </section>

        <section v-if="runStream.pendingInterrupt" class="mb-12 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div class="text-sm font-semibold text-amber-900">사용자 확인 필요</div>
          <p class="mt-2 text-sm leading-6 text-amber-800">
            {{ runStream.pendingInterrupt.message || runStream.pendingInterrupt.decision || '최종 결정 적용 전 확인이 필요합니다.' }}
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <button class="h-9 rounded-md bg-gray-900 px-4 text-sm text-white hover:bg-gray-800" @click="resume(true, 'APPROVE')">승인</button>
            <button class="h-9 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-700 hover:bg-gray-50" @click="resume(false, 'REJECT')">거절</button>
            <button class="h-9 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-700 hover:bg-gray-50" @click="resume(false, 'REVISE')">수정 요청</button>
          </div>
        </section>

        <section class="mb-12">
          <div class="mb-5">
            <div class="text-sm text-gray-400">진행 요약</div>
            <h2 class="mt-1 text-2xl font-bold text-gray-950">어디까지 진행됐나</h2>
          </div>
          <div class="space-y-2">
            <div
              v-for="(stage, index) in stages"
              :key="stage.node"
              class="flex items-start gap-3 rounded-lg border px-4 py-4"
              :class="stagePillClass(stage.status)"
            >
              <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="stageDotClass(stage.status)">
                <svg v-if="stage.status === 'completed'" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <div>
                <p class="text-sm font-semibold">{{ stage.label }}</p>
                <p class="mt-1 text-xs opacity-75">{{ stage.description }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="mb-12">
          <div class="mb-5">
            <div class="text-sm text-gray-400">에이전트 의견</div>
            <h2 class="mt-1 text-2xl font-bold text-gray-950">{{ agents.length }}개 의견</h2>
          </div>
          <div v-if="!agents.length" class="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            아직 수신된 에이전트 의견이 없습니다.
          </div>
          <div v-else class="space-y-2">
            <article
              v-for="event in agents"
              :key="`${event.data.agent_id}-${event.data.turn_number}`"
              class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-base font-bold text-gray-950">{{ agentLabel(event.data.agent_id) }}</span>
                    <span class="text-xs text-gray-400">{{ event.data.layer || 'agent' }}</span>
                  </div>
                  <p class="mt-1 text-sm text-gray-600">{{ event.data.verdict || event.data.urgency || '-' }}</p>
                </div>
                <span class="font-mono text-lg font-bold" :class="(event.data.direction ?? 0) < 0 ? 'text-red-600' : (event.data.direction ?? 0) > 0 ? 'text-blue-600' : 'text-gray-500'">
                  {{ directionText(event.data.direction) }}
                </span>
              </div>
              <p class="mt-4 text-sm leading-6 text-gray-700">
                {{ event.data.reasoning || event.data.limits_acknowledged || '-' }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>confidence {{ percentText(event.data.confidence) }}</span>
                <span v-if="event.data.strength !== null && event.data.strength !== undefined">strength {{ percentText(event.data.strength) }}</span>
                <span v-if="event.data.focus_tickers?.length">{{ event.data.focus_tickers.join(', ') }}</span>
              </div>
            </article>
          </div>
        </section>

        <section v-if="mediator" class="mb-12 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="text-sm text-gray-400">Mediator</div>
          <h2 class="mt-1 text-2xl font-bold text-gray-950">충돌을 어떻게 봤나</h2>
          <p class="mt-4 text-sm leading-6 text-gray-700">{{ mediator.data.rationale }}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span
              v-for="target in mediator.data.targets_to_recall"
              :key="target"
              class="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
            >
              {{ agentLabel(target) }}
            </span>
            <span v-if="mediator.data.skip_round_2" class="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
              Round 2 생략
            </span>
          </div>
        </section>

        <section class="mb-12">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <div class="text-sm text-gray-400">실행 로그</div>
              <h2 class="mt-1 text-2xl font-bold text-gray-950">원본 이벤트</h2>
            </div>
            <span class="text-xs text-gray-400">LLM 생략 {{ llmSkipped }}</span>
          </div>
          <div class="space-y-2">
            <details
              v-for="(event, index) in runStream.timelineEvents"
              :key="`${event.event}-${index}`"
              class="rounded-lg border border-gray-200 bg-white p-4"
            >
              <summary class="cursor-pointer list-none">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-gray-950">{{ eventTitle(event) }}</p>
                    <p v-if="eventDetail(event)" class="mt-1 line-clamp-2 text-sm text-gray-500">{{ eventDetail(event) }}</p>
                  </div>
                  <span class="rounded-md bg-gray-50 px-2 py-1 font-mono text-xs text-gray-500">{{ event.event }}</span>
                </div>
              </summary>
              <pre class="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs leading-5 text-gray-700">{{ formatUnknown(event.data) }}</pre>
            </details>
          </div>
        </section>

        <div class="grid gap-2">
          <button class="h-12 rounded-md bg-gray-900 text-base font-semibold text-white hover:bg-gray-800" @click="goReport">
            보고서 보기
          </button>
          <button class="h-12 rounded-md text-base font-medium text-gray-600 hover:text-gray-900" @click="goDashboard">
            대시보드로 이동
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
