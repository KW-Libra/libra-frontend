<script setup lang="ts">
import { computed, ref } from 'vue'
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
  runThreadMatches,
  toolObservationCount
} from '@/utils/runView'

const route = useRoute()
const router = useRouter()
const runStream = useRunStreamStore()
const expandedAgent = ref<string | null>(null)
const showRawEvents = ref(false)

const threadId = computed(() => String(route.params.threadId || ''))
const hasLiveRun = computed(() =>
  runThreadMatches(threadId.value, runStream.currentThreadId, runStream.events)
)
const started = computed(() => latestEvent(runStream.events, 'run_started'))
const finalDraft = computed(() => latestEvent(runStream.events, 'final_decision_draft'))
const mediator = computed(() => latestEvent(runStream.events, 'mediator_decision'))
const agents = computed(() => agentEvents(runStream.events))
const coreAgents = computed(() => agents.value.filter((event) => event.data.layer === 'core'))
const domainAgents = computed(() => agents.value.filter((event) => event.data.layer === 'domain'))
const otherAgents = computed(() => agents.value.filter((event) => event.data.layer !== 'core' && event.data.layer !== 'domain'))
const decision = computed(() =>
  runStream.completion?.decision || finalDraft.value?.data.decision || runStream.pendingInterrupt?.decision || null
)
const branch = computed(() => runStream.completion?.branch || finalDraft.value?.data.branch || null)
const headline = computed(() => decisionHeadline(decision.value, '판단 보고서'))
const summary = computed(() =>
  finalDraft.value?.data.summary
  || finalDraft.value?.data.reasoning
  || runStream.pendingInterrupt?.message
  || started.value?.data.query
  || '수신된 판단 이벤트를 기준으로 보고서를 구성합니다.'
)
const directionCounts = computed(() => {
  const values = agents.value.map((event) => event.data.direction ?? 0)
  return {
    increase: values.filter((value) => value > 0.05).length,
    hold: values.filter((value) => Math.abs(value) <= 0.05).length,
    decrease: values.filter((value) => value < -0.05).length
  }
})
const tools = computed(() => toolObservationCount(runStream.events))

function toggleAgent(key: string) {
  expandedAgent.value = expandedAgent.value === key ? null : key
}

function goBack() {
  router.push(`/run/${encodeURIComponent(threadId.value)}/result`)
}

function goDashboard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div class="mx-auto max-w-2xl px-6 py-8">
      <div class="mb-10 flex items-center justify-between">
        <button class="text-sm text-gray-600 hover:text-gray-900" @click="goBack">뒤로</button>
        <button class="text-sm text-gray-500 hover:text-gray-900" @click="goDashboard">대시보드</button>
      </div>

      <div v-if="!hasLiveRun" class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p class="text-base font-semibold text-gray-900">보고서 데이터가 없습니다</p>
        <p class="mt-2 text-sm leading-6 text-gray-500">보고서는 현재 세션에서 수신한 backend SSE 이벤트만 사용합니다.</p>
        <button class="mt-6 h-10 rounded-md bg-gray-900 px-4 text-sm text-white hover:bg-gray-800" @click="goDashboard">
          대시보드로 이동
        </button>
      </div>

      <template v-else>
        <section class="mb-14">
          <div v-if="started?.data.trigger" class="mb-4 text-sm text-gray-400">{{ started.data.trigger }}</div>
          <h1 class="text-3xl font-bold leading-tight tracking-normal" :class="decisionToneClass(decision).split(' ').at(-1)">
            {{ headline }}
          </h1>
          <p class="mt-3 text-base leading-7 text-gray-600">{{ summary }}</p>
        </section>

        <section class="mb-14 rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
          <div class="text-sm text-gray-500">최종 결정</div>
          <div class="mt-2 text-2xl font-bold text-gray-950">{{ decision || '대기 중' }}</div>
          <div class="mt-1 text-sm text-gray-500">{{ branch || started?.data.query }}</div>
          <div class="my-6 h-px bg-gray-100"></div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-xs text-gray-500">이벤트</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ runStream.events.length }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500">발언</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ agents.length }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500">도구</div>
              <div class="mt-1 font-mono text-2xl font-bold text-gray-950">{{ tools }}</div>
            </div>
          </div>
        </section>

        <section class="mb-14">
          <div class="mb-5">
            <div class="text-sm text-gray-400">한눈에 보기</div>
            <h2 class="mt-1 text-2xl font-bold text-gray-950">에이전트 방향성</h2>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
            <div class="grid grid-cols-3 gap-4 text-center">
              <div>
                <div class="text-3xl font-bold text-blue-600">{{ directionCounts.increase }}</div>
                <div class="mt-1 text-xs text-gray-500">INCREASE</div>
              </div>
              <div>
                <div class="text-3xl font-bold text-gray-500">{{ directionCounts.hold }}</div>
                <div class="mt-1 text-xs text-gray-500">HOLD</div>
              </div>
              <div>
                <div class="text-3xl font-bold text-red-600">{{ directionCounts.decrease }}</div>
                <div class="mt-1 text-xs text-gray-500">DECREASE</div>
              </div>
            </div>
          </div>
        </section>

        <section class="mb-14">
          <div class="mb-5">
            <div class="text-sm text-gray-400">전체 발언</div>
            <h2 class="mt-1 text-2xl font-bold text-gray-950">누가 무엇을 말했나</h2>
          </div>

          <div v-if="!agents.length" class="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            아직 수신된 에이전트 의견이 없습니다.
          </div>
          <div v-else class="space-y-5">
            <div v-if="coreAgents.length">
              <div class="mb-3 px-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">CORE</div>
              <article
                v-for="event in coreAgents"
                :key="`${event.data.agent_id}-${event.data.turn_number}`"
                class="mb-2 cursor-pointer rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm"
                @click="toggleAgent(`${event.data.agent_id}-${event.data.turn_number}`)"
              >
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="flex items-baseline gap-2">
                      <span class="font-bold text-gray-950">{{ agentLabel(event.data.agent_id) }}</span>
                      <span class="text-xs text-gray-400">{{ event.data.verdict || 'opinion' }}</span>
                    </div>
                    <p class="mt-1 text-sm text-gray-600">{{ event.data.reasoning || event.data.limits_acknowledged || '-' }}</p>
                  </div>
                  <span class="font-mono text-lg font-bold" :class="(event.data.direction ?? 0) < 0 ? 'text-red-600' : (event.data.direction ?? 0) > 0 ? 'text-blue-600' : 'text-gray-500'">
                    {{ directionText(event.data.direction) }}
                  </span>
                </div>
                <div v-if="expandedAgent === `${event.data.agent_id}-${event.data.turn_number}`" class="mt-4 border-t border-gray-100 pt-4 text-sm leading-6 text-gray-700">
                  <p>confidence {{ percentText(event.data.confidence) }}</p>
                  <p v-if="event.data.focus_tickers?.length" class="mt-1">focus {{ event.data.focus_tickers.join(', ') }}</p>
                  <pre v-if="event.data.tools_called?.length" class="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs">{{ formatUnknown(event.data.tools_called) }}</pre>
                </div>
              </article>
            </div>

            <div v-if="domainAgents.length || otherAgents.length">
              <div class="mb-3 px-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">DOMAIN / OTHER</div>
              <article
                v-for="event in [...domainAgents, ...otherAgents]"
                :key="`${event.data.agent_id}-${event.data.turn_number}`"
                class="mb-2 cursor-pointer rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm"
                @click="toggleAgent(`${event.data.agent_id}-${event.data.turn_number}`)"
              >
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="flex items-baseline gap-2">
                      <span class="font-bold text-gray-950">{{ agentLabel(event.data.agent_id) }}</span>
                      <span class="text-xs text-gray-400">{{ event.data.layer || 'agent' }}</span>
                    </div>
                    <p class="mt-1 text-sm text-gray-600">{{ event.data.reasoning || event.data.limits_acknowledged || '-' }}</p>
                  </div>
                  <span class="font-mono text-lg font-bold" :class="(event.data.direction ?? 0) < 0 ? 'text-red-600' : (event.data.direction ?? 0) > 0 ? 'text-blue-600' : 'text-gray-500'">
                    {{ directionText(event.data.direction) }}
                  </span>
                </div>
                <div v-if="expandedAgent === `${event.data.agent_id}-${event.data.turn_number}`" class="mt-4 border-t border-gray-100 pt-4 text-sm leading-6 text-gray-700">
                  <p>confidence {{ percentText(event.data.confidence) }}</p>
                  <p v-if="event.data.focus_tickers?.length" class="mt-1">focus {{ event.data.focus_tickers.join(', ') }}</p>
                  <pre v-if="event.data.tools_called?.length" class="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs">{{ formatUnknown(event.data.tools_called) }}</pre>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section v-if="mediator" class="mb-14">
          <div class="mb-5">
            <div class="text-sm text-gray-400">충돌 식별</div>
            <h2 class="mt-1 text-2xl font-bold text-gray-950">Mediator 판단</h2>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
            <p class="text-sm leading-6 text-gray-700">{{ mediator.data.rationale }}</p>
            <div class="mt-5 flex flex-wrap gap-2">
              <span v-if="mediator.data.skip_round_2" class="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">Round 2 생략</span>
              <span
                v-for="target in mediator.data.targets_to_recall"
                :key="target"
                class="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
              >
                {{ agentLabel(target) }}
              </span>
            </div>
          </div>
        </section>

        <section class="mb-14">
          <button
            class="flex w-full items-center justify-center gap-2 rounded-md bg-white py-3 text-sm font-medium text-gray-600 shadow-sm hover:text-gray-900"
            @click="showRawEvents = !showRawEvents"
          >
            {{ showRawEvents ? '원본 이벤트 접기' : '원본 이벤트 보기' }}
          </button>
          <div v-if="showRawEvents" class="mt-4 space-y-2">
            <details
              v-for="(event, index) in runStream.events"
              :key="`${event.event}-${index}`"
              class="rounded-lg border border-gray-200 bg-white p-4"
            >
              <summary class="cursor-pointer text-sm font-semibold text-gray-950">
                {{ eventTitle(event) }}
                <span class="ml-2 font-mono text-xs font-normal text-gray-400">{{ event.event }}</span>
              </summary>
              <p v-if="eventDetail(event)" class="mt-3 text-sm leading-6 text-gray-600">{{ eventDetail(event) }}</p>
              <pre class="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs leading-5 text-gray-700">{{ formatUnknown(event.data) }}</pre>
            </details>
          </div>
        </section>

        <div class="grid gap-2">
          <button class="h-12 rounded-md bg-gray-900 text-base font-semibold text-white hover:bg-gray-800" @click="goDashboard">
            대시보드로 이동
          </button>
          <button class="h-12 rounded-md text-base font-medium text-gray-600 hover:text-gray-900" @click="goBack">
            결정 화면으로
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
