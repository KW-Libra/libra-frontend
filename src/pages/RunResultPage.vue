<script setup lang="ts">
/**
 * src/pages/RunResultPage.vue v4
 *
 * Run 결과 화면 — 4분기 모두 지원.
 *
 * - STRONG_CONFLICT → 3옵션 카드 (USER_DECISION)
 * - STRONG_REBALANCE → autoProposal 카드 (자동 권고 + 승인/거절)
 * - WEAK_CONSERVATIVE → conservativeProposal 카드 (원래 권고 vs 50% 축소된 권고)
 * - COMPLIANCE_VETO → vetoOptions 3옵션 + 위원회 반투명 오버레이
 */

import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  resolveScenario,
  type AgentSpeech,
  type DeltaFromRound1,
} from '@/mocks/scenarios'

const router = useRouter()
const route = useRoute()
const threadId = route.params.threadId as string
const scenario = resolveScenario(threadId)

const expandedAgent = ref<string | null>(null)
const expandedOption = ref<string | null>(null)
const expandedVetoOption = ref<string | null>(null)
const isProcessing = ref(false)
const processingLabel = ref('')

const coreSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.committee === 'CORE')
)
const domainSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.committee === 'DOMAIN')
)

const opinionCount = computed(
  () => scenario.speeches.filter((s) => s.role === 'opinion').length
)
const informationalCount = computed(
  () => scenario.speeches.filter((s) => s.role === 'informational').length
)

const isVeto = computed(() => scenario.consensus.branch === 'COMPLIANCE_VETO')
const isAutoRebalance = computed(
  () => scenario.consensus.branch === 'STRONG_REBALANCE'
)
const isConflict = computed(() => scenario.consensus.branch === 'STRONG_CONFLICT')
const isWeakConservative = computed(
  () => scenario.consensus.branch === 'WEAK_CONSERVATIVE'
)

const complianceTone = computed(() => {
  if (scenario.compliance.severity === 'BLOCKING') return 'danger'
  if (scenario.compliance.severity === 'WARNING') return 'warning'
  return 'success'
})

function toggleAgent(agent: string) {
  expandedAgent.value = expandedAgent.value === agent ? null : agent
}
function toggleOption(id: string) {
  expandedOption.value = expandedOption.value === id ? null : id
}
function toggleVetoOption(id: string) {
  expandedVetoOption.value = expandedVetoOption.value === id ? null : id
}

function magnitudeBarWidth(magnitude: number): number {
  return Math.min(100, (Math.abs(magnitude) / 10) * 100)
}

function cardBgClass(speech: AgentSpeech): string {
  if (speech.role === 'informational')
    return 'bg-white border border-dashed border-gray-300'
  if (speech.direction === 'HOLD') return 'bg-gray-50 border border-gray-200'
  if (speech.direction === 'DECREASE')
    return 'bg-red-50/70 border border-red-100'
  return 'bg-emerald-50/70 border border-emerald-100'
}

function cardAccentText(speech: AgentSpeech): string {
  if (speech.role === 'informational') return 'text-gray-400'
  if (speech.direction === 'HOLD') return 'text-gray-600'
  if (speech.direction === 'DECREASE') return 'text-red-700'
  return 'text-emerald-700'
}

function cardLabelText(speech: AgentSpeech): string {
  if (speech.role === 'informational') return 'text-gray-500'
  if (speech.direction === 'HOLD') return 'text-gray-700'
  if (speech.direction === 'DECREASE') return 'text-red-800'
  return 'text-emerald-800'
}

function barColorClass(speech: AgentSpeech): string {
  if (speech.direction === 'HOLD') return 'bg-gray-400'
  if (speech.direction === 'DECREASE') return 'bg-red-500'
  return 'bg-emerald-500'
}

function deltaSymbol(delta: DeltaFromRound1): string {
  if (delta === 'WEAKENED') return '↘'
  if (delta === 'STRENGTHENED') return '↗'
  if (delta === 'UNCHANGED') return '—'
  return ''
}
function deltaClass(delta: DeltaFromRound1): string {
  if (delta === 'WEAKENED') return 'text-amber-600 bg-amber-50'
  if (delta === 'STRENGTHENED') return 'text-blue-600 bg-blue-50'
  if (delta === 'UNCHANGED') return 'text-gray-400 bg-gray-50'
  return 'hidden'
}
function deltaText(delta: DeltaFromRound1): string {
  if (delta === 'WEAKENED') return '약화'
  if (delta === 'STRENGTHENED') return '강화'
  if (delta === 'UNCHANGED') return '유지'
  return ''
}

function confidenceDots(confidence: number): boolean[] {
  const filled = Math.round(confidence * 5)
  return [0, 1, 2, 3, 4].map((i) => i < filled)
}

function isSupporting(speech: AgentSpeech): boolean {
  if (!expandedOption.value) return false
  const option = scenario.options.find((o) => o.id === expandedOption.value)
  return option?.supportingAgents.includes(speech.agent) ?? false
}

function findSpeech(agent: string): AgentSpeech | undefined {
  return scenario.speeches.find((s) => s.agent === agent)
}

const expandedAgentSpeech = computed(() =>
  expandedAgent.value ? findSpeech(expandedAgent.value) : null
)
const expandedOptionData = computed(() =>
  expandedOption.value
    ? scenario.options.find((o) => o.id === expandedOption.value)
    : null
)
const expandedVetoData = computed(() =>
  expandedVetoOption.value
    ? scenario.vetoOptions?.find((o) => o.id === expandedVetoOption.value)
    : null
)

function scorePercent(score: number): number {
  return ((score + 1) / 2) * 100
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}
function formatKrw(n: number): string {
  return '₩' + n.toLocaleString('ko-KR')
}
function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function optionToneRing(tone: 'danger' | 'neutral' | 'success'): string {
  if (tone === 'danger') return 'border-l-red-400'
  if (tone === 'success') return 'border-l-emerald-400'
  return 'border-l-gray-400'
}
function riskLabelClass(label: '낮음' | '중간' | '높음'): string {
  if (label === '낮음') return 'text-emerald-700 bg-emerald-50'
  if (label === '중간') return 'text-gray-700 bg-gray-100'
  return 'text-amber-700 bg-amber-50'
}

function vetoToneRing(tone: 'safe' | 'override' | 'alternative'): string {
  if (tone === 'safe') return 'border-l-emerald-400'
  if (tone === 'override') return 'border-l-red-400'
  return 'border-l-blue-400'
}

function saveDecisionToHistory(
  optionLabel: string,
  status: 'approved' | 'cancelled'
) {
  const history = JSON.parse(sessionStorage.getItem('libra_decisions') || '[]')
  history.unshift({
    threadId,
    scenarioName: scenario.triggerMeta.label,
    optionLabel,
    status,
    completedAt: new Date().toISOString(),
  })
  sessionStorage.setItem('libra_decisions', JSON.stringify(history.slice(0, 10)))
}

function approveOption() {
  if (!expandedOptionData.value) return
  const option = expandedOptionData.value
  if (option.id === 'hold_position') {
    saveDecisionToHistory(option.label, 'approved')
    router.push('/dashboard')
    return
  }
  isProcessing.value = true
  processingLabel.value = `${option.label} 실행 중...`
  setTimeout(() => {
    saveDecisionToHistory(option.label, 'approved')
    router.push('/dashboard')
  }, 1800)
}

function approveAutoRebalance() {
  isProcessing.value = true
  processingLabel.value = '자동 리밸런싱 실행 중...'
  setTimeout(() => {
    saveDecisionToHistory('자동 리밸런싱', 'approved')
    router.push('/dashboard')
  }, 1800)
}

function approveConservative() {
  isProcessing.value = true
  processingLabel.value = '보수적 리밸런싱 실행 중...'
  setTimeout(() => {
    saveDecisionToHistory('보수적 리밸런싱 (50%)', 'approved')
    router.push('/dashboard')
  }, 1800)
}

function processVetoOption() {
  if (!expandedVetoData.value) return
  const option = expandedVetoData.value

  if (option.id === 'cancel') {
    saveDecisionToHistory('거래 취소 (ESG 정책 유지)', 'cancelled')
    router.push('/dashboard')
    return
  }
  if (option.id === 'override') {
    isProcessing.value = true
    processingLabel.value = 'ESG 정책 일시 완화 적용 중...'
    setTimeout(() => {
      saveDecisionToHistory('ESG 정책 일시 완화', 'approved')
      router.push('/dashboard')
    }, 1800)
    return
  }
  if (option.id === 'alternative') {
    isProcessing.value = true
    processingLabel.value = '대체 자산 적용 중...'
    setTimeout(() => {
      saveDecisionToHistory('대체 자산 (069500 +3%)', 'approved')
      router.push('/dashboard')
    }, 1800)
    return
  }
}
function goReport() {
  router.push(`/run/${threadId}/report`)
}

function cancelDecision() {
  saveDecisionToHistory('취소됨', 'cancelled')
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div
      v-if="isProcessing"
      class="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div class="text-center">
        <div class="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div class="text-sm font-medium text-gray-900">{{ processingLabel }}</div>
        <div class="text-xs text-gray-500 mt-1">대시보드로 이동 중</div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-8 py-12">
      <!-- 헤더 -->
      <div class="mb-10">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full"
              :class="
                isVeto
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : isAutoRebalance
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : isWeakConservative
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              "
            >
              <span
                class="w-1.5 h-1.5 rounded-full animate-pulse"
                :class="
                  isVeto
                    ? 'bg-red-500'
                    : isAutoRebalance
                    ? 'bg-emerald-500'
                    : isWeakConservative
                    ? 'bg-amber-500'
                    : 'bg-amber-500'
                "
              ></span>
              {{ scenario.triggerMeta.type.toUpperCase() }} · {{ scenario.triggerMeta.label }}
            </span>
            <span class="text-xs text-gray-400 font-mono">{{ scenario.threadId }}</span>
          </div>
          <div class="text-xs text-gray-400">
            {{ formatDate(scenario.completedAt) }} {{ formatTime(scenario.completedAt) }} ·
            <span class="font-medium text-gray-600">{{ scenario.durationSeconds }}s</span>
          </div>
        </div>

        <h1 class="text-3xl font-medium tracking-tight text-gray-900 mb-2">
          리밸런싱 검토 요청
        </h1>
        <p class="text-sm text-gray-600 mb-5 leading-relaxed">
          {{ scenario.triggerMeta.description }} — {{ scenario.query }}
        </p>

        <div class="flex items-center gap-6 text-xs flex-wrap">
          <div>
            <span class="text-gray-400">포트폴리오</span>
            <span class="ml-1.5 font-medium text-gray-800">{{ scenario.context.portfolioName }}</span>
          </div>
          <div class="h-3 w-px bg-gray-200"></div>
          <div>
            <span class="text-gray-400">평가액</span>
            <span class="ml-1.5 font-medium text-gray-800 font-mono">{{ formatKrw(scenario.context.currentValueKrw) }}</span>
          </div>
          <div class="h-3 w-px bg-gray-200"></div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-gray-400">대상 자산</span>
            <span
              v-for="a in scenario.context.affectedAssets"
              :key="a.ticker"
              class="px-2 py-0.5 bg-white border border-gray-200 rounded font-mono text-[11px] text-gray-700"
            >{{ a.ticker }} · {{ a.name }}</span>
          </div>
        </div>
      </div>

      <!-- Stepper -->
      <div class="mb-10 p-5 bg-white border border-gray-200 rounded-lg">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-medium tracking-wider text-gray-500">진행 단계</span>
          <span class="text-xs text-gray-400">모든 단계 완료 · 총 {{ scenario.durationSeconds }}초</span>
        </div>
        <div class="relative">
          <div class="absolute top-3 left-3 right-3 h-px bg-gray-200" aria-hidden="true"></div>
          <div
            class="absolute top-3 left-3 h-px bg-emerald-500"
            :style="{
              width: `calc(${
                ((scenario.stages.filter((s) => s.completed).length - 1) /
                  (scenario.stages.length - 1)) * 100
              }% - 12px)`,
            }"
            aria-hidden="true"
          ></div>
          <div class="relative flex justify-between">
            <div
              v-for="stage in scenario.stages"
              :key="stage.name"
              class="flex flex-col items-center"
              style="width: 80px"
            >
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center"
                :class="stage.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'"
              >
                <svg v-if="stage.completed" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="mt-2 text-xs font-medium text-gray-700">{{ stage.label }}</div>
              <div class="text-[10px] text-gray-400 font-mono mt-0.5">{{ formatDurationMs(stage.durationMs) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Compliance -->
      <div
        class="flex items-stretch mb-10 bg-white rounded-lg overflow-hidden border"
        :class="{
          'border-red-300': complianceTone === 'danger',
          'border-amber-200': complianceTone === 'warning',
          'border-emerald-200': complianceTone === 'success',
        }"
      >
        <div
          class="w-1"
          :class="{
            'bg-red-500': complianceTone === 'danger',
            'bg-amber-400': complianceTone === 'warning',
            'bg-emerald-400': complianceTone === 'success',
          }"
        ></div>
        <div class="flex-1 flex items-center gap-3 p-4">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-red-500 animate-pulse': complianceTone === 'danger',
                'bg-amber-400': complianceTone === 'warning',
                'bg-emerald-400': complianceTone === 'success',
              }"
            ></span>
            <span
              class="text-xs font-medium tracking-wider"
              :class="{
                'text-red-700': complianceTone === 'danger',
                'text-amber-700': complianceTone === 'warning',
                'text-emerald-700': complianceTone === 'success',
              }"
            >{{ scenario.compliance.severity }}</span>
          </div>
          <div
            class="h-4 w-px"
            :class="{
              'bg-red-200': complianceTone === 'danger',
              'bg-amber-200': complianceTone === 'warning',
              'bg-emerald-200': complianceTone === 'success',
            }"
          ></div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">{{ scenario.compliance.title }}</div>
            <div class="text-xs text-gray-600 mt-0.5">{{ scenario.compliance.detail }}</div>
          </div>
          <div class="text-[10px] text-gray-400 font-mono">{{ scenario.compliance.ruleId }}</div>
        </div>
      </div>

      <!-- 위원회 영역 -->
      <div class="relative">
        <div
          v-if="isVeto"
          class="absolute inset-0 bg-gray-50/60 backdrop-blur-[1px] z-10 rounded-lg flex items-start justify-center pt-10"
        >
          <div class="bg-white border border-red-300 rounded-lg px-4 py-3 shadow-md max-w-md text-center">
            <div class="text-xs font-medium text-red-700 mb-1">
              ✕  위원회 합의가 hard rule을 통과하지 못함
            </div>
            <div class="text-[11px] text-gray-600">
              위원회 다수가 매수에 찬성했으나, 사용자가 명시 동의한 ESG 정책이 자동으로 거래를 차단했습니다.
              LLM의 추론은 hard rule을 우회할 수 없습니다.
            </div>
          </div>
        </div>

        <div :class="isVeto ? 'opacity-50 pointer-events-none' : ''">
          <!-- Core 위원회 -->
          <div class="mb-8">
            <div class="flex items-baseline justify-between mb-4">
              <div class="flex items-baseline gap-3">
                <span class="text-xs font-medium tracking-[0.15em] text-gray-700">CORE 위원회</span>
                <span class="text-xs text-gray-400">5명 · 시장·기회 관점</span>
              </div>
              <div class="h-px flex-1 bg-gray-200 mx-4"></div>
            </div>
            <div class="grid grid-cols-5 gap-2.5">
              <div
                v-for="speech in coreSpeeches"
                :key="speech.agent"
                class="rounded-lg p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm"
                :class="[
                  cardBgClass(speech),
                  isSupporting(speech) ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                  expandedAgent === speech.agent ? 'ring-2 ring-gray-700 ring-offset-1' : '',
                ]"
                @click="toggleAgent(speech.agent)"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium" :class="cardLabelText(speech)">{{ speech.agent }}</span>
                  <span
                    class="text-[9px] tracking-wider px-1 py-0.5 rounded font-medium"
                    :class="speech.role === 'informational' ? 'text-gray-400 bg-gray-100' : 'text-gray-500 bg-white/60'"
                  >{{ speech.role === 'informational' ? '정보' : '의견' }}</span>
                </div>
                <div class="text-xl font-semibold mb-2" :class="cardAccentText(speech)">
                  <template v-if="speech.role === 'informational'">—</template>
                  <template v-else-if="speech.direction === 'HOLD'">HOLD</template>
                  <template v-else>{{ speech.magnitude > 0 ? '+' : '' }}{{ speech.magnitude }}%</template>
                </div>
                <div
                  v-if="speech.role === 'opinion' && speech.direction !== 'HOLD'"
                  class="h-1 mb-2 bg-white/60 rounded-full overflow-hidden"
                >
                  <div class="h-full" :class="barColorClass(speech)" :style="{ width: `${magnitudeBarWidth(speech.magnitude)}%` }"></div>
                </div>
                <div v-else class="h-1 mb-2"></div>
                <div class="text-[11px] mb-2 leading-snug" :class="cardAccentText(speech)">{{ speech.summary }}</div>
                <div class="flex items-center justify-between">
                  <div v-if="speech.role === 'opinion'" class="flex items-center gap-0.5">
                    <span
                      v-for="(dot, i) in confidenceDots(speech.confidence)"
                      :key="i"
                      class="w-1 h-1 rounded-full"
                      :class="dot ? cardAccentText(speech).replace('text-', 'bg-') : 'bg-gray-200'"
                    ></span>
                  </div>
                  <div v-else></div>
                  <span
                    v-if="speech.deltaFromRound1 && speech.role === 'opinion'"
                    class="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="deltaClass(speech.deltaFromRound1)"
                  >{{ deltaSymbol(speech.deltaFromRound1) }} {{ deltaText(speech.deltaFromRound1) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Domain 위원회 -->
          <div class="mb-6">
            <div class="flex items-baseline justify-between mb-4">
              <div class="flex items-baseline gap-3">
                <span class="text-xs font-medium tracking-[0.15em] text-gray-700">DOMAIN 위원회</span>
                <span class="text-xs text-gray-400">6명 · 안전·제약 관점</span>
              </div>
              <div class="h-px flex-1 bg-gray-200 mx-4"></div>
            </div>
            <div class="grid grid-cols-6 gap-2.5">
              <div
                v-for="speech in domainSpeeches"
                :key="speech.agent"
                class="rounded-lg p-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-sm"
                :class="[
                  cardBgClass(speech),
                  isSupporting(speech) ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                  expandedAgent === speech.agent ? 'ring-2 ring-gray-700 ring-offset-1' : '',
                ]"
                @click="toggleAgent(speech.agent)"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium" :class="cardLabelText(speech)">{{ speech.agent }}</span>
                  <span
                    class="text-[9px] tracking-wider px-1 py-0.5 rounded font-medium"
                    :class="speech.role === 'informational' ? 'text-gray-400 bg-gray-100' : 'text-gray-500 bg-white/60'"
                  >{{ speech.role === 'informational' ? '정보' : '의견' }}</span>
                </div>
                <div class="text-xl font-semibold mb-2" :class="cardAccentText(speech)">
                  <template v-if="speech.role === 'informational'">—</template>
                  <template v-else-if="speech.direction === 'HOLD'">HOLD</template>
                  <template v-else>{{ speech.magnitude > 0 ? '+' : '' }}{{ speech.magnitude }}%</template>
                </div>
                <div
                  v-if="speech.role === 'opinion' && speech.direction !== 'HOLD'"
                  class="h-1 mb-2 bg-white/60 rounded-full overflow-hidden"
                >
                  <div class="h-full" :class="barColorClass(speech)" :style="{ width: `${magnitudeBarWidth(speech.magnitude)}%` }"></div>
                </div>
                <div v-else class="h-1 mb-2"></div>
                <div class="text-[11px] mb-2 leading-snug" :class="cardAccentText(speech)">{{ speech.summary }}</div>
                <div class="flex items-center justify-between">
                  <div v-if="speech.role === 'opinion'" class="flex items-center gap-0.5">
                    <span
                      v-for="(dot, i) in confidenceDots(speech.confidence)"
                      :key="i"
                      class="w-1 h-1 rounded-full"
                      :class="dot ? cardAccentText(speech).replace('text-', 'bg-') : 'bg-gray-200'"
                    ></span>
                  </div>
                  <div v-else></div>
                  <span
                    v-if="speech.deltaFromRound1 && speech.role === 'opinion'"
                    class="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    :class="deltaClass(speech.deltaFromRound1)"
                  >{{ deltaSymbol(speech.deltaFromRound1) }} {{ deltaText(speech.deltaFromRound1) }}</span>
                </div>
              </div>
            </div>
            <div class="mt-3 text-[11px] text-gray-400">
              의견 {{ opinionCount }}명 · 정보 {{ informationalCount }}명 · 카드 클릭으로 상세 확인
            </div>
          </div>
        </div>
      </div>

      <!-- 발언 펼침 -->
      <div
        v-if="expandedAgentSpeech && !isVeto"
        class="mb-10 p-5 bg-white rounded-lg border border-gray-200"
      >
        <div class="flex items-start gap-4">
          <div class="text-xs font-medium text-gray-400 tracking-wider pt-0.5 w-24 flex-shrink-0">
            {{ expandedAgentSpeech.committee }} · {{ expandedAgentSpeech.agent }}
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900 mb-1">{{ expandedAgentSpeech.summary }}</div>
            <div class="text-sm text-gray-600 leading-relaxed">{{ expandedAgentSpeech.reasoning }}</div>
          </div>
        </div>
      </div>

      <!-- 합의 점수 -->
      <div class="mb-10 mt-10 p-6 bg-white border border-gray-200 rounded-lg">
        <div class="flex items-baseline justify-between mb-5">
          <div>
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">합의 점수</div>
            <div class="text-2xl font-semibold text-gray-900 font-mono">
              {{ scenario.consensus.round2 }}
              <span class="text-sm font-normal text-gray-400 ml-2">R1 {{ scenario.consensus.round1 }}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">분기</div>
            <div
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              :class="{
                'text-red-700 bg-red-50 border-red-200': isVeto || isConflict,
                'text-emerald-700 bg-emerald-50 border-emerald-200': isAutoRebalance,
                'text-amber-700 bg-amber-50 border-amber-200': isWeakConservative,
              }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="{
                  'bg-red-500': isVeto || isConflict,
                  'bg-emerald-500': isAutoRebalance,
                  'bg-amber-500': isWeakConservative,
                }"
              ></span>
              {{ scenario.consensus.branch }}
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="relative h-2 rounded-full overflow-hidden flex">
            <div class="bg-red-200" style="width: 20%"></div>
            <div class="bg-red-100" style="width: 15%"></div>
            <div class="bg-gray-200" style="width: 30%"></div>
            <div class="bg-emerald-100" style="width: 15%"></div>
            <div class="bg-emerald-200" style="width: 20%"></div>
          </div>
          <div
            class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-400"
            :style="{ left: `calc(${scorePercent(scenario.consensus.round1)}% - 6px)` }"
          ></div>
          <div
            class="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gray-900 border-2 border-white shadow"
            :style="{ left: `calc(${scorePercent(scenario.consensus.round2)}% - 7px)` }"
          ></div>
        </div>
        <div class="flex justify-between mt-3 text-[10px] text-gray-400 font-mono">
          <span>-1.0</span><span>STRONG ↓</span><span>WEAK ↓</span><span>CONFLICT</span
          ><span>WEAK ↑</span><span>STRONG ↑</span><span>+1.0</span>
        </div>
      </div>

      <!-- 결정 영역 — 분기별 swap -->

      <!-- 분기 1: STRONG_CONFLICT -->
      <div v-if="isConflict">
        <div class="mb-5">
          <h2 class="text-lg font-medium text-gray-900 mb-1">결정이 필요합니다</h2>
          <p class="text-sm text-gray-600">
            Round 2 후에도 위원회 의견이 갈렸습니다. 시스템이 결정을 사용자에게 위임합니다.
          </p>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="option in scenario.options"
            :key="option.id"
            class="bg-white border border-gray-200 border-l-4 rounded-lg p-5 cursor-pointer transition-all hover:border-gray-400 hover:shadow-md"
            :class="[
              optionToneRing(option.tone),
              expandedOption === option.id ? 'ring-2 ring-blue-400 ring-offset-1' : '',
            ]"
            @click="toggleOption(option.id)"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="text-base font-medium text-gray-900">{{ option.label }}</div>
              <span class="text-[10px] px-2 py-0.5 rounded font-medium" :class="riskLabelClass(option.riskLabel)">위험 {{ option.riskLabel }}</span>
            </div>
            <div class="text-xs text-gray-500 mb-4 leading-relaxed">{{ option.description }}</div>
            <div class="space-y-1 mb-4">
              <div v-for="trade in option.trades" :key="trade" class="text-sm font-mono text-gray-800">{{ trade }}</div>
            </div>
            <div class="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <div class="text-[10px] text-gray-400 tracking-wider mb-0.5">예상 변동성</div>
                <div class="text-sm font-mono text-gray-700">{{ option.estimatedVolatility }}%</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] text-gray-400 tracking-wider mb-0.5">지지</div>
                <div class="text-xs text-gray-700">{{ option.supportingAgents.join(' · ') }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="expandedOptionData" class="mt-4 p-5 bg-blue-50/50 rounded-lg border border-blue-200">
          <div class="flex items-baseline justify-between mb-3">
            <div class="text-sm font-medium text-gray-900">
              {{ expandedOptionData.label }} —
              <span class="font-normal text-gray-600">{{ expandedOptionData.description }}</span>
            </div>
            <div class="text-[10px] text-gray-400 tracking-wider">
              지지 에이전트 {{ expandedOptionData.supportingAgents.length }}명의 발언
            </div>
          </div>
          <div class="space-y-3">
            <div v-for="agentName in expandedOptionData.supportingAgents" :key="agentName" class="flex gap-3">
              <div class="text-xs font-medium text-blue-700 w-20 flex-shrink-0 pt-0.5">{{ agentName }}</div>
              <div class="text-xs text-gray-700 leading-relaxed flex-1">{{ findSpeech(agentName)?.reasoning }}</div>
            </div>
          </div>
        </div>

        <div class="mt-8 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
          <div class="text-xs text-gray-500">
            <span class="font-medium text-gray-700">옵션 선택</span>은 사용자가 직접 결정합니다 —
            시스템은 결정을 대신하지 않습니다.
          </div>
          <div class="flex gap-2">
            <button @click="goReport" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">상세 보고서</button>
            <button @click="cancelDecision" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">취소</button>
            <button
              @click="approveOption"
              class="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!expandedOption"
            >{{ expandedOption ? `${expandedOptionData?.label} 승인` : '옵션을 선택하세요' }}</button>
          </div>
        </div>
      </div>

      <!-- 분기 2: STRONG_REBALANCE -->
      <div v-else-if="isAutoRebalance && scenario.autoProposal">
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-lg font-medium text-gray-900">자동 리밸런싱 권고</h2>
            <span class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">위원회 합의 강함</span>
          </div>
          <p class="text-sm text-gray-600">위원회가 일치된 판단을 내렸습니다. 시스템이 자동으로 거래안을 산정했습니다.</p>
        </div>

        <div class="bg-white border border-emerald-200 border-l-4 border-l-emerald-500 rounded-lg p-6">
          <div class="text-xs text-gray-600 mb-5 leading-relaxed bg-emerald-50/50 p-3 rounded">{{ scenario.autoProposal.reasoning }}</div>

          <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">제안 거래</div>
          <div class="space-y-2 mb-5">
            <div v-for="t in scenario.autoProposal.trades" :key="t.ticker" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono text-gray-500 w-14">{{ t.ticker }}</span>
                <span class="text-sm text-gray-800">{{ t.name }}</span>
              </div>
              <div class="text-base font-mono font-semibold" :class="t.change > 0 ? 'text-emerald-700' : 'text-red-700'">{{ t.change > 0 ? '+' : '' }}{{ t.change }}%p</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-5">
            <div class="p-3 bg-gray-50 rounded">
              <div class="text-[10px] text-gray-500 tracking-wider mb-1">거래 후 변동성</div>
              <div class="text-lg font-mono font-semibold text-gray-900">
                {{ scenario.autoProposal.estimatedVolatilityAfter }}%
                <span class="text-xs font-normal text-emerald-600 ml-1">↓ IPS 한도 내</span>
              </div>
            </div>
            <div class="p-3 bg-gray-50 rounded">
              <div class="text-[10px] text-gray-500 tracking-wider mb-1">예상 거래 비용</div>
              <div class="text-lg font-mono font-semibold text-gray-900">{{ formatKrw(scenario.autoProposal.estimatedCostKrw) }}</div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
          <div class="text-xs text-gray-500">
            <span class="font-medium text-gray-700">자동 권고</span>는 위원회가 강하게 일치한 경우에만 제시됩니다 —
            거절하면 다른 결정 옵션을 검토할 수 있습니다.
          </div>
          <div class="flex gap-2">
            <button @click="goReport" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">상세 보고서</button>
            
            <button @click="cancelDecision" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">거절</button>
            <button @click="approveAutoRebalance" class="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition">자동 리밸런싱 승인</button>
          </div>
        </div>
      </div>

      <!-- 분기 3: WEAK_CONSERVATIVE -->
      <div v-else-if="isWeakConservative && scenario.conservativeProposal">
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-lg font-medium text-gray-900">보수적 리밸런싱 권고</h2>
            <span class="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">권고 강도 50% 반영</span>
          </div>
          <p class="text-sm text-gray-600">
            위원회가 한 방향으로 기울었지만 강도가 약합니다. 시스템이 권고 강도를 절반으로 줄여 보수적으로 처리합니다.
          </p>
        </div>

        <div class="bg-white border border-amber-200 border-l-4 border-l-amber-400 rounded-lg p-6">
          <div class="text-xs text-gray-600 mb-5 leading-relaxed bg-amber-50/50 p-3 rounded">
            {{ scenario.conservativeProposal.reasoning }}
          </div>

          <!-- 원래 권고 vs 축소된 권고 비교 -->
          <div class="grid grid-cols-2 gap-3 mb-5">
            <!-- 원래 권고 (참고) -->
            <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div class="flex items-baseline justify-between mb-3">
                <div class="text-xs font-medium tracking-wider text-gray-500">위원회 원안</div>
                <span class="text-[9px] text-gray-400 italic">참고용</span>
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="t in scenario.conservativeProposal.originalTrades"
                  :key="t.ticker"
                  class="flex items-center justify-between text-xs"
                >
                  <span class="text-gray-500">{{ t.ticker }} · {{ t.name }}</span>
                  <span
                    class="font-mono font-medium"
                    :class="t.change > 0 ? 'text-emerald-600' : 'text-red-600'"
                  >{{ t.change > 0 ? '+' : '' }}{{ t.change }}%p</span>
                </div>
              </div>
            </div>

            <!-- 축소된 권고 (실제 적용) -->
            <div class="p-4 bg-amber-50/50 border border-amber-200 rounded-lg relative">
              <div class="flex items-baseline justify-between mb-3">
                <div class="text-xs font-medium tracking-wider text-amber-700">시스템 적용안 (50%)</div>
                <span class="text-[9px] text-amber-700 font-medium">실제 거래</span>
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="t in scenario.conservativeProposal.conservativeTrades"
                  :key="t.ticker"
                  class="flex items-center justify-between text-xs"
                >
                  <span class="text-gray-700 font-medium">{{ t.ticker }} · {{ t.name }}</span>
                  <span
                    class="font-mono font-semibold"
                    :class="t.change > 0 ? 'text-emerald-700' : 'text-red-700'"
                  >{{ t.change > 0 ? '+' : '' }}{{ t.change }}%p</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 화살표 인디케이터 -->
          <div class="flex items-center justify-center -mt-2 mb-4">
            <div class="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <span class="font-mono">×{{ scenario.conservativeProposal.reductionFactor }}</span>
              <span>합의 강도가 약하여 권고를 절반만 적용</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-gray-50 rounded">
              <div class="text-[10px] text-gray-500 tracking-wider mb-1">거래 후 변동성</div>
              <div class="text-lg font-mono font-semibold text-gray-900">
                {{ scenario.conservativeProposal.estimatedVolatilityAfter }}%
              </div>
            </div>
            <div class="p-3 bg-gray-50 rounded">
              <div class="text-[10px] text-gray-500 tracking-wider mb-1">예상 거래 비용</div>
              <div class="text-lg font-mono font-semibold text-gray-900">{{ formatKrw(scenario.conservativeProposal.estimatedCostKrw) }}</div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
          <div class="text-xs text-gray-500">
            <span class="font-medium text-gray-700">약한 합의</span>는 한 방향으로 기울지만 확신이 낮은 경우 — 시스템이 보수적으로 절반만 반영합니다.
          </div>
          <div class="flex gap-2">
            <button @click="goReport" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">상세 보고서</button>
            
            <button @click="cancelDecision" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">거절</button>
            <button @click="approveConservative" class="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition">보수적 권고 승인</button>
          </div>
        </div>
      </div>

      <!-- 분기 4: COMPLIANCE_VETO -->
      <div v-else-if="isVeto && scenario.vetoOptions">
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-lg font-medium text-gray-900">정책 위반으로 자동 거부됨</h2>
            <span class="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">COMPLIANCE VETO</span>
          </div>
          <p class="text-sm text-gray-600">
            위원회 합의와 무관하게 사용자 정책이 거래를 차단했습니다. 다음 옵션 중 하나를 선택하세요.
          </p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="option in scenario.vetoOptions"
            :key="option.id"
            class="bg-white border border-gray-200 border-l-4 rounded-lg p-5 cursor-pointer transition-all hover:border-gray-400 hover:shadow-md"
            :class="[
              vetoToneRing(option.tone),
              expandedVetoOption === option.id ? 'ring-2 ring-blue-400 ring-offset-1' : '',
            ]"
            @click="toggleVetoOption(option.id)"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="text-base font-medium text-gray-900">{{ option.label }}</div>
              <span v-if="option.tone === 'safe'" class="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">권장</span>
              <span v-else-if="option.tone === 'override'" class="text-[10px] px-2 py-0.5 bg-red-50 text-red-700 rounded font-medium">명시 동의 필요</span>
            </div>
            <div class="text-xs text-gray-500 mb-4 leading-relaxed">{{ option.description }}</div>
            <div class="text-xs text-gray-700 leading-relaxed pt-3 border-t border-gray-100">{{ option.consequence }}</div>
          </div>
        </div>

        <div class="mt-8 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
          <div class="text-xs text-gray-500">
            <span class="font-medium text-gray-700">Hard rule</span>은 LLM 추론으로 우회되지 않습니다 —
            정책 변경에는 사용자의 명시 동의가 필요합니다.
          </div>
          <div class="flex gap-2">
            <button @click="goReport" class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition">상세 보고서</button>
            
            <button
              @click="processVetoOption"
              class="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!expandedVetoOption"
            >{{ expandedVetoOption ? `${expandedVetoData?.label} 진행` : '옵션을 선택하세요' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>