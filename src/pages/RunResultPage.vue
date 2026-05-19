<script setup lang="ts">
/**
 * src/pages/RunResultPage.vue v6
 *
 * Run 결정 화면 — 토스 톤 + 와이드 레이아웃. 4분기 모두 지원.
 *
 * - STRONG_CONFLICT   → 3옵션 카드 (USER_DECISION)
 * - STRONG_REBALANCE  → autoProposal 카드 (자동 권고 + 승인/거절)
 * - WEAK_CONSERVATIVE → conservativeProposal 비교 카드 (원안 vs 50% 축소)
 * - COMPLIANCE_VETO   → vetoOptions 3옵션 + 차단 안내
 *
 * 레이아웃 (v6):
 * - max-w-6xl 와이드. 정보 4종(검토요청·Compliance·한눈에·R1→R2)은
 *   2×2 그리드로 한 화면에 모아 스크롤 최소화.
 * - 옵션 선택 + 액션만 max-w-3xl 가운데 독립 배치.
 */

import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { resolveScenario, type AgentSpeech } from '@/mocks/scenarios'

const router = useRouter()
const route = useRoute()
const threadId = route.params.threadId as string
const scenario = resolveScenario(threadId)

const showAllSpeeches = ref(false)
const expandedAgent = ref<string | null>(null)
const expandedOption = ref<string | null>(null)
const expandedVetoOption = ref<string | null>(null)
const isProcessing = ref(false)
const processingLabel = ref('')

const isVeto = computed(() => scenario.consensus.branch === 'COMPLIANCE_VETO')
const isAutoRebalance = computed(() => scenario.consensus.branch === 'STRONG_REBALANCE')
const isConflict = computed(() => scenario.consensus.branch === 'STRONG_CONFLICT')
const isWeakConservative = computed(() => scenario.consensus.branch === 'WEAK_CONSERVATIVE')

const coreSpeeches = computed(() => scenario.speeches.filter((s) => s.committee === 'CORE'))
const domainSpeeches = computed(() => scenario.speeches.filter((s) => s.committee === 'DOMAIN'))
const opinionSpeeches = computed(() => scenario.speeches.filter((s) => s.role === 'opinion'))
const informationalCount = computed(
  () => scenario.speeches.filter((s) => s.role === 'informational').length
)
const directionCounts = computed(() => {
  const o = opinionSpeeches.value
  return {
    increase: o.filter((s) => s.direction === 'INCREASE').length,
    decrease: o.filter((s) => s.direction === 'DECREASE').length,
    hold: o.filter((s) => s.direction === 'HOLD').length,
  }
})
const changedCount = computed(
  () =>
    opinionSpeeches.value.filter(
      (s) => s.deltaFromRound1 === 'WEAKENED' || s.deltaFromRound1 === 'STRENGTHENED'
    ).length
)

const branchHeadline = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '위원회가 일치했습니다'
    case 'WEAK_CONSERVATIVE': return '약한 합의 — 보수적으로 처리합니다'
    case 'STRONG_CONFLICT': return '당신의 결정이 필요합니다'
    case 'COMPLIANCE_VETO': return '정책 위반으로 차단됐습니다'
    default: return '검토 결과'
  }
})
const branchSubtext = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '시스템이 자동으로 거래안을 산정했습니다. 승인만 하면 됩니다.'
    case 'WEAK_CONSERVATIVE': return '한 방향으로 기울었지만 확신이 약해 권고 강도를 절반만 반영합니다.'
    case 'STRONG_CONFLICT': return 'Round 2 후에도 의견이 갈렸습니다. 시스템은 결정을 대신하지 않습니다.'
    case 'COMPLIANCE_VETO': return '위원회 합의와 무관하게 사용자 정책이 거래를 차단했습니다.'
    default: return ''
  }
})
const branchColorClass = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE':
    case 'WEAK_CONSERVATIVE':
      return 'text-blue-600'
    case 'STRONG_CONFLICT':
    case 'COMPLIANCE_VETO':
      return 'text-red-600'
    default: return 'text-gray-900'
  }
})
// Tailwind JIT가 정적으로 인식하도록 별도 클래스 리터럴 (text-→bg- 치환 금지)
const branchMarkerBg = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE':
    case 'WEAK_CONSERVATIVE':
      return 'bg-blue-600'
    case 'STRONG_CONFLICT':
    case 'COMPLIANCE_VETO':
      return 'bg-red-600'
    default: return 'bg-gray-900'
  }
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

function findSpeech(agent: string): AgentSpeech | undefined {
  return scenario.speeches.find((s) => s.agent === agent)
}
const expandedOptionData = computed(() =>
  expandedOption.value ? scenario.options.find((o) => o.id === expandedOption.value) : null
)
const expandedVetoData = computed(() =>
  expandedVetoOption.value
    ? scenario.vetoOptions?.find((o) => o.id === expandedVetoOption.value)
    : null
)

function speechMagnitudeText(s: AgentSpeech): string {
  if (s.role === 'informational') return '정보'
  if (s.direction === 'HOLD') return 'HOLD'
  return `${s.magnitude > 0 ? '+' : ''}${s.magnitude}%`
}
function speechMagnitudeClass(s: AgentSpeech): string {
  if (s.role === 'informational') return 'text-gray-400'
  if (s.direction === 'HOLD') return 'text-gray-500'
  if (s.direction === 'DECREASE') return 'text-red-600'
  return 'text-blue-600'
}
function deltaLabel(s: AgentSpeech): string {
  if (s.role === 'informational' || !s.deltaFromRound1) return ''
  if (s.deltaFromRound1 === 'STRENGTHENED') return '강화'
  if (s.deltaFromRound1 === 'WEAKENED') return '약화'
  if (s.deltaFromRound1 === 'UNCHANGED') return '유지'
  return ''
}
function riskPillClass(label: string): string {
  if (label === '낮음') return 'bg-blue-50 text-blue-600'
  if (label === '높음') return 'bg-red-50 text-red-600'
  return 'bg-gray-100 text-gray-600'
}
const complianceSeverityClass = computed(() => {
  if (scenario.compliance.severity === 'BLOCKING') return 'text-red-600'
  if (scenario.compliance.severity === 'WARNING') return 'text-gray-700'
  return 'text-blue-600'
})

function scorePercent(score: number): number {
  return ((score + 1) / 2) * 100
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
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

function saveDecisionToHistory(optionLabel: string, status: 'approved' | 'cancelled') {
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
  }
}

function goReport() {
  router.push(`/run/${threadId}/report`)
}
function goDashboard() {
  router.push('/dashboard')
}
function cancelDecision() {
  saveDecisionToHistory('취소됨', 'cancelled')
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 처리 중 오버레이 -->
    <div
      v-if="isProcessing"
      class="fixed inset-0 bg-white/85 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div class="text-center">
        <div class="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-5"></div>
        <div class="text-base font-bold text-gray-900">{{ processingLabel }}</div>
        <div class="text-sm text-gray-500 mt-1">대시보드로 이동 중</div>
      </div>
    </div>

    <!-- 상단 네비게이션 -->
    <div class="bg-white">
      <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <span class="text-sm text-gray-400 font-mono">{{ scenario.threadId }}</span>
        <button
          @click="goDashboard"
          class="text-sm text-gray-500 hover:text-gray-900 transition"
        >대시보드</button>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-8 pb-16 pt-8">
      <!-- ============================================================ -->
      <!-- 1. 헤드라인 -->
      <!-- ============================================================ -->
      <div class="mb-8">
        <div class="text-sm text-gray-400 mb-3">
          {{ scenario.triggerMeta.type.toUpperCase() }} · {{ scenario.triggerMeta.label }}
        </div>
        <h1
          class="text-3xl font-bold tracking-tight mb-2 leading-tight"
          :class="branchColorClass"
        >{{ branchHeadline }}</h1>
        <p class="text-base text-gray-600 leading-relaxed">{{ branchSubtext }}</p>
      </div>

      <!-- ============================================================ -->
      <!-- 2. 정보 4종 — 2×2 그리드 (검토요청·Compliance·한눈에·R1→R2) -->
      <!-- ============================================================ -->
      <div class="grid grid-cols-2 gap-4 mb-6 items-start">
        <!-- 검토 요청 -->
        <div class="bg-white rounded-3xl p-6 shadow-sm">
          <div class="text-sm text-gray-500 mb-2">검토 요청</div>
          <div class="text-lg font-bold text-gray-900 mb-1 leading-snug">{{ scenario.query }}</div>
          <div class="text-sm text-gray-500">{{ scenario.triggerMeta.description }}</div>

          <div class="my-5 h-px bg-gray-100"></div>

          <div class="grid grid-cols-3 gap-4 mb-5">
            <div>
              <div class="text-xs text-gray-500 mb-1">합의 점수</div>
              <div class="text-2xl font-bold font-mono text-gray-900">{{ scenario.consensus.round2 }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">분기</div>
              <div class="text-sm font-bold font-mono leading-snug" :class="branchColorClass">{{ scenario.consensus.branch }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">소요</div>
              <div class="text-2xl font-bold font-mono text-gray-900">{{ scenario.durationSeconds }}<span class="text-base font-normal text-gray-400 ml-0.5">s</span></div>
            </div>
          </div>

          <div class="h-px bg-gray-100 mb-5"></div>

          <div class="space-y-2.5 text-sm">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-gray-500 flex-shrink-0">포트폴리오</span>
              <span class="font-medium text-gray-900 text-right">{{ scenario.context.portfolioName }}</span>
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-gray-500">평가액</span>
              <span class="font-bold font-mono text-gray-900">{{ formatKrw(scenario.context.currentValueKrw) }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-gray-500 flex-shrink-0">대상 자산</span>
              <span class="flex flex-wrap gap-1.5 justify-end">
                <span
                  v-for="a in scenario.context.affectedAssets"
                  :key="a.ticker"
                  class="px-2.5 py-0.5 bg-gray-50 rounded-full font-mono text-xs text-gray-600"
                >{{ a.ticker }} · {{ a.name }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Compliance -->
        <div class="bg-white rounded-3xl p-6 shadow-sm">
          <div class="flex items-baseline justify-between mb-3">
            <div class="text-sm text-gray-500">Compliance 검증</div>
            <div class="text-lg font-bold font-mono" :class="complianceSeverityClass">
              {{ scenario.compliance.severity }}
            </div>
          </div>
          <div class="text-lg font-bold text-gray-900 mb-1">{{ scenario.compliance.title }}</div>
          <div class="text-sm text-gray-600 leading-relaxed">{{ scenario.compliance.detail }}</div>
          <div class="text-xs text-gray-400 font-mono mt-3">{{ scenario.compliance.ruleId }}</div>
        </div>

        <!-- 한눈에 · 11명 발언 -->
        <div class="bg-white rounded-3xl p-6 shadow-sm">
          <div class="text-sm text-gray-500 mb-4">한눈에 · 11명 발언</div>
          <div class="grid grid-cols-3 gap-4 mb-5">
            <div class="text-center">
              <div class="text-3xl font-bold text-blue-600 mb-1">{{ directionCounts.increase }}</div>
              <div class="text-xs text-gray-500">INCREASE</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-gray-500 mb-1">{{ directionCounts.hold }}</div>
              <div class="text-xs text-gray-500">HOLD</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-red-600 mb-1">{{ directionCounts.decrease }}</div>
              <div class="text-xs text-gray-500">DECREASE</div>
            </div>
          </div>

          <div class="h-px bg-gray-100 mb-4"></div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">의견자</span>
              <span class="font-bold text-gray-900">{{ opinionSpeeches.length }}명</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">정보자</span>
              <span class="font-bold text-gray-900">{{ informationalCount }}명</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">R2 변경</span>
              <span class="font-bold text-gray-900">{{ changedCount }}명</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">Compliance</span>
              <span class="font-bold" :class="complianceSeverityClass">{{ scenario.compliance.severity }}</span>
            </div>
          </div>

          <button
            @click="showAllSpeeches = !showAllSpeeches"
            class="mt-5 w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>{{ showAllSpeeches ? '발언 접기' : '11명 발언 모두 보기' }}</span>
            <svg
              class="w-4 h-4 transition-transform"
              :class="showAllSpeeches ? 'rotate-180' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <!-- Round 1 → Round 2 -->
        <div class="bg-white rounded-3xl p-6 shadow-sm">
          <div class="text-sm text-gray-500 mb-4">Round 1 → Round 2</div>
          <div class="text-sm text-gray-500 mb-1">최종 합의 점수</div>
          <div class="text-5xl font-bold font-mono mb-2" :class="branchColorClass">
            {{ scenario.consensus.round2 }}
          </div>
          <div class="text-sm text-gray-500 mb-6">Round 1 {{ scenario.consensus.round1 }} 에서 이동</div>

          <div class="relative pt-2 pb-1">
            <div class="relative h-2 rounded-full overflow-hidden flex bg-gray-100">
              <div class="bg-red-100" style="width: 35%"></div>
              <div class="bg-gray-100" style="width: 30%"></div>
              <div class="bg-blue-100" style="width: 35%"></div>
            </div>
            <div
              class="absolute top-1 w-3 h-3 rounded-full bg-white border-2 border-gray-300"
              :style="{ left: `calc(${scorePercent(scenario.consensus.round1)}% - 6px)` }"
              title="Round 1"
            ></div>
            <div
              class="absolute top-0.5 w-4 h-4 rounded-full border-2 border-white shadow"
              :class="branchMarkerBg"
              :style="{ left: `calc(${scorePercent(scenario.consensus.round2)}% - 8px)` }"
              title="Round 2"
            ></div>
          </div>
          <div class="flex justify-between mt-3 text-[10px] text-gray-400 font-mono">
            <span>-1.0 DECREASE</span><span>0 CONFLICT</span><span>+1.0 INCREASE</span>
          </div>
        </div>
      </div>

      <!-- 전체폭: 발언 펼침 (CORE | DOMAIN 2열) -->
      <div v-if="showAllSpeeches" class="grid grid-cols-2 gap-4 mb-8">
        <div class="space-y-2.5">
          <div class="text-xs font-medium tracking-wider text-gray-500 mb-1 px-1">CORE · 시장·기회</div>
          <div
            v-for="speech in coreSpeeches"
            :key="speech.agent"
            class="bg-white rounded-2xl px-5 py-4 shadow-sm cursor-pointer hover:shadow-md transition"
            @click="toggleAgent(speech.agent)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-3">
                <span class="text-base font-bold text-gray-900">{{ speech.agent }}</span>
                <span class="text-xs text-gray-400">{{ speech.role === 'informational' ? '정보' : '의견' }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span v-if="deltaLabel(speech)" class="text-xs text-gray-400">{{ deltaLabel(speech) }}</span>
                <span class="text-lg font-bold font-mono" :class="speechMagnitudeClass(speech)">
                  {{ speechMagnitudeText(speech) }}
                </span>
              </div>
            </div>
            <div class="text-sm text-gray-600 mt-1">{{ speech.summary }}</div>
            <div v-if="expandedAgent === speech.agent" class="mt-4 pt-4 border-t border-gray-100">
              <div class="text-sm text-gray-700 leading-relaxed">{{ speech.reasoning }}</div>
              <div v-if="speech.role === 'opinion'" class="mt-3 text-xs text-gray-400">
                확신도 {{ (speech.confidence * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2.5">
          <div class="text-xs font-medium tracking-wider text-gray-500 mb-1 px-1">DOMAIN · 안전·제약</div>
          <div
            v-for="speech in domainSpeeches"
            :key="speech.agent"
            class="bg-white rounded-2xl px-5 py-4 shadow-sm cursor-pointer hover:shadow-md transition"
            @click="toggleAgent(speech.agent)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-3">
                <span class="text-base font-bold text-gray-900">{{ speech.agent }}</span>
                <span class="text-xs text-gray-400">{{ speech.role === 'informational' ? '정보' : '의견' }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span v-if="deltaLabel(speech)" class="text-xs text-gray-400">{{ deltaLabel(speech) }}</span>
                <span class="text-lg font-bold font-mono" :class="speechMagnitudeClass(speech)">
                  {{ speechMagnitudeText(speech) }}
                </span>
              </div>
            </div>
            <div class="text-sm text-gray-600 mt-1">{{ speech.summary }}</div>
            <div v-if="expandedAgent === speech.agent" class="mt-4 pt-4 border-t border-gray-100">
              <div class="text-sm text-gray-700 leading-relaxed">{{ speech.reasoning }}</div>
              <div v-if="speech.role === 'opinion'" class="mt-3 text-xs text-gray-400">
                확신도 {{ (speech.confidence * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- 3. 옵션 선택 + 액션 — 가운데 독립 -->
      <!-- ============================================================ -->
      <div class="max-w-3xl mx-auto">
        <!-- 분기 1: STRONG_CONFLICT -->
        <div v-if="isConflict" class="mb-8">
          <div class="mb-6 text-center">
            <div class="text-sm text-gray-400 mb-2">옵션 선택</div>
            <h2 class="text-2xl font-bold text-gray-900">어떻게 할까요</h2>
            <p class="text-sm text-gray-500 mt-2 leading-relaxed">
              카드를 눌러 선택하세요. 아래에서 승인할 수 있습니다.
            </p>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="option in scenario.options"
              :key="option.id"
              class="bg-white rounded-2xl p-5 shadow-sm cursor-pointer transition-all flex flex-col"
              :class="expandedOption === option.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'"
              @click="toggleOption(option.id)"
            >
              <div class="text-base font-bold text-gray-900 leading-snug">{{ option.label }}</div>
              <span
                class="text-[11px] px-2 py-0.5 rounded-full font-medium self-start mt-2"
                :class="riskPillClass(option.riskLabel)"
              >위험 {{ option.riskLabel }}</span>
              <div class="text-xs text-gray-500 mt-3 leading-relaxed">{{ option.description }}</div>
              <div class="space-y-0.5 mt-3">
                <div v-for="trade in option.trades" :key="trade" class="text-xs font-mono text-gray-800">{{ trade }}</div>
              </div>
              <div class="mt-auto pt-3 border-t border-gray-100 text-xs">
                <div>
                  <span class="text-gray-400">변동성</span>
                  <span class="ml-1.5 font-bold font-mono text-gray-900">{{ option.estimatedVolatility }}%</span>
                </div>
                <div class="text-gray-400 mt-0.5">지지 {{ option.supportingAgents.length }}명</div>
              </div>
            </div>
          </div>

          <!-- 선택 상세 -->
          <div v-if="expandedOptionData" class="mt-4 bg-white rounded-2xl p-6 shadow-sm">
            <div class="flex items-baseline justify-between mb-4">
              <div class="text-sm font-bold text-gray-900">
                {{ expandedOptionData.label }}
                <span class="font-normal text-gray-500">· 지지 에이전트 발언</span>
              </div>
              <div class="text-xs text-gray-400">{{ expandedOptionData.supportingAgents.length }}명</div>
            </div>
            <div class="space-y-3">
              <div
                v-for="agentName in expandedOptionData.supportingAgents"
                :key="agentName"
                class="flex gap-3"
              >
                <div class="text-xs font-bold text-blue-600 w-20 flex-shrink-0 pt-0.5">{{ agentName }}</div>
                <div class="text-xs text-gray-600 leading-relaxed flex-1">{{ findSpeech(agentName)?.reasoning }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 분기 2: STRONG_REBALANCE -->
        <div v-else-if="isAutoRebalance && scenario.autoProposal" class="mb-8">
          <div class="mb-6 text-center">
            <div class="text-sm text-gray-400 mb-2">자동 권고</div>
            <h2 class="text-2xl font-bold text-gray-900">제안된 거래</h2>
            <p class="text-sm text-gray-500 mt-2 leading-relaxed">
              위원회가 강하게 일치해 시스템이 거래안을 자동 산정했습니다.
            </p>
          </div>

          <div class="bg-white rounded-3xl p-8 shadow-sm">
            <div class="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-2xl p-5 mb-6">
              {{ scenario.autoProposal.reasoning }}
            </div>

            <div class="space-y-2 mb-6">
              <div
                v-for="t in scenario.autoProposal.trades"
                :key="t.ticker"
                class="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xs font-mono text-gray-400 w-14">{{ t.ticker }}</span>
                  <span class="text-sm text-gray-800">{{ t.name }}</span>
                </div>
                <div class="text-lg font-bold font-mono" :class="t.change > 0 ? 'text-blue-600' : 'text-red-600'">
                  {{ t.change > 0 ? '+' : '' }}{{ t.change }}%p
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
              <div>
                <div class="text-xs text-gray-500 mb-1">거래 후 변동성</div>
                <div class="text-2xl font-bold font-mono text-gray-900">{{ scenario.autoProposal.estimatedVolatilityAfter }}%</div>
                <div class="text-xs text-blue-600 mt-0.5">IPS 한도 내</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">예상 거래 비용</div>
                <div class="text-2xl font-bold font-mono text-gray-900">{{ formatKrw(scenario.autoProposal.estimatedCostKrw) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 분기 3: WEAK_CONSERVATIVE -->
        <div v-else-if="isWeakConservative && scenario.conservativeProposal" class="mb-8">
          <div class="mb-6 text-center">
            <div class="text-sm text-gray-400 mb-2">보수적 권고 · 강도 50%</div>
            <h2 class="text-2xl font-bold text-gray-900">절반만 반영합니다</h2>
            <p class="text-sm text-gray-500 mt-2 leading-relaxed">
              합의 강도가 약해 위원회 원안을 ×{{ scenario.conservativeProposal.reductionFactor }} 축소해 적용합니다.
            </p>
          </div>

          <div class="bg-white rounded-3xl p-8 shadow-sm">
            <div class="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-2xl p-5 mb-6">
              {{ scenario.conservativeProposal.reasoning }}
            </div>

            <div class="space-y-4">
              <div>
                <div class="text-xs text-gray-400 mb-2">위원회 원안 <span class="text-gray-300">· 참고용</span></div>
                <div class="space-y-1.5">
                  <div
                    v-for="t in scenario.conservativeProposal.originalTrades"
                    :key="t.ticker"
                    class="flex items-center justify-between text-sm"
                  >
                    <span class="text-gray-400">{{ t.ticker }} · {{ t.name }}</span>
                    <span class="font-mono text-gray-500">{{ t.change > 0 ? '+' : '' }}{{ t.change }}%p</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-center">
                <span class="text-xs text-gray-400 font-mono">↓ ×{{ scenario.conservativeProposal.reductionFactor }}</span>
              </div>

              <div class="bg-gray-50 rounded-2xl p-5">
                <div class="text-xs text-blue-600 font-medium mb-2">시스템 적용안 · 실제 거래</div>
                <div class="space-y-1.5">
                  <div
                    v-for="t in scenario.conservativeProposal.conservativeTrades"
                    :key="t.ticker"
                    class="flex items-center justify-between text-sm"
                  >
                    <span class="text-gray-700 font-medium">{{ t.ticker }} · {{ t.name }}</span>
                    <span class="font-bold font-mono" :class="t.change > 0 ? 'text-blue-600' : 'text-red-600'">
                      {{ t.change > 0 ? '+' : '' }}{{ t.change }}%p
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-gray-100">
              <div>
                <div class="text-xs text-gray-500 mb-1">거래 후 변동성</div>
                <div class="text-2xl font-bold font-mono text-gray-900">{{ scenario.conservativeProposal.estimatedVolatilityAfter }}%</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">예상 거래 비용</div>
                <div class="text-2xl font-bold font-mono text-gray-900">{{ formatKrw(scenario.conservativeProposal.estimatedCostKrw) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 분기 4: COMPLIANCE_VETO -->
        <div v-else-if="isVeto && scenario.vetoOptions" class="mb-8">
          <div class="mb-6 text-center">
            <div class="text-sm text-red-500 mb-2">Hard rule 차단</div>
            <h2 class="text-2xl font-bold text-gray-900">어떻게 처리할까요</h2>
            <p class="text-sm text-gray-500 mt-2 leading-relaxed">
              위원회 다수가 찬성했지만 사용자 ESG 정책이 거래를 차단했습니다.
              LLM 추론은 hard rule을 우회할 수 없습니다.
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="option in scenario.vetoOptions"
              :key="option.id"
              class="bg-white rounded-2xl p-6 shadow-sm cursor-pointer transition-all"
              :class="expandedVetoOption === option.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'"
              @click="toggleVetoOption(option.id)"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="text-lg font-bold text-gray-900">{{ option.label }}</div>
                <span v-if="option.tone === 'safe'" class="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">권장</span>
                <span v-else-if="option.tone === 'override'" class="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded-full font-medium">명시 동의 필요</span>
              </div>
              <div class="text-sm text-gray-500 mb-4 leading-relaxed">{{ option.description }}</div>
              <div class="text-sm text-gray-700 leading-relaxed pt-4 border-t border-gray-100">{{ option.consequence }}</div>
            </div>
          </div>
        </div>

        <!-- 액션 -->
        <div class="pt-2">
          <div v-if="isConflict" class="flex flex-col gap-2">
            <button
              @click="approveOption"
              :disabled="!expandedOption"
              class="w-full py-4 text-base font-bold rounded-2xl transition"
              :class="expandedOption
                ? 'bg-gray-900 text-white hover:bg-black'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
            >{{ expandedOption ? `${expandedOptionData?.label} 승인` : '옵션을 선택하세요' }}</button>
            <div class="flex gap-2">
              <button @click="goReport" class="flex-1 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">상세 보고서</button>
              <button @click="cancelDecision" class="flex-1 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">취소</button>
            </div>
          </div>

          <div v-else-if="isAutoRebalance" class="flex flex-col gap-2">
            <button
              @click="approveAutoRebalance"
              class="w-full py-4 text-base font-bold bg-gray-900 text-white rounded-2xl hover:bg-black transition"
            >자동 리밸런싱 승인</button>
            <div class="flex gap-2">
              <button @click="goReport" class="flex-1 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">상세 보고서</button>
              <button @click="cancelDecision" class="flex-1 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">거절</button>
            </div>
          </div>

          <div v-else-if="isWeakConservative" class="flex flex-col gap-2">
            <button
              @click="approveConservative"
              class="w-full py-4 text-base font-bold bg-gray-900 text-white rounded-2xl hover:bg-black transition"
            >보수적 권고 승인</button>
            <div class="flex gap-2">
              <button @click="goReport" class="flex-1 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">상세 보고서</button>
              <button @click="cancelDecision" class="flex-1 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">거절</button>
            </div>
          </div>

          <div v-else-if="isVeto" class="flex flex-col gap-2">
            <button
              @click="processVetoOption"
              :disabled="!expandedVetoOption"
              class="w-full py-4 text-base font-bold rounded-2xl transition"
              :class="expandedVetoOption
                ? 'bg-gray-900 text-white hover:bg-black'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
            >{{ expandedVetoOption ? `${expandedVetoData?.label} 진행` : '옵션을 선택하세요' }}</button>
            <button @click="goReport" class="w-full py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition">상세 보고서</button>
          </div>

          <div class="text-center text-xs text-gray-400 mt-8">
            {{ formatDate(scenario.completedAt) }} {{ formatTime(scenario.completedAt) }}
            · <span class="font-mono">{{ scenario.threadId }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
