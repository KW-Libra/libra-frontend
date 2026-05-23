<script setup lang="ts">
/**
 * src/pages/RunReportPage.vue v2
 *
 * 보고서 페이지 — 토스 톤 리디자인.
 *
 * 디자인 원칙:
 * - 큰 숫자 + 작은 보조 설명
 * - 넓은 여백 (섹션 사이 80px, 카드 내부 28-32px)
 * - 회색 99% + 파랑 액센트 1개
 * - 둥근 모서리 크게 (rounded-2xl)
 * - 테두리 X, 부드러운 그림자만
 * - 발언은 요약 → 펼침
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { resolveScenario, type AgentSpeech } from '@/mocks/scenarios'
import Metric4DCard from '@/components/Metric4DCard.vue'
import LibraScale from '@/components/LibraScale.vue'
import { fetchMetrics4D } from '@/api/metrics'
import { METRIC_META, type MetricKey, type Metrics4DResponse } from '@/types/metrics4d'

const router = useRouter()
const route = useRoute()
const threadId = route.params.threadId as string
const scenario = resolveScenario(threadId)

const showAllSpeeches = ref(false)
const expandedSpeech = ref<string | null>(null)

// 회고용(최종) 모드 — sessionStorage의 결정 이력에서 이 threadId에 해당하는 항목을 찾으면
// "선택 완료" 시점의 회고 보고서로 표시한다.
interface DecisionRecord {
  threadId: string
  scenarioName: string
  optionLabel: string
  status: 'approved' | 'cancelled'
  completedAt: string
}
const finalDecision = computed<DecisionRecord | null>(() => {
  try {
    const list: DecisionRecord[] = JSON.parse(sessionStorage.getItem('libra_decisions') || '[]')
    return list.find((d) => d.threadId === threadId) ?? null
  } catch {
    return null
  }
})
const isFinalMode = computed(() => finalDecision.value !== null)

// ──────────── 4차원 메트릭 ────────────
const metrics4D = ref<Metrics4DResponse | null>(null)
const metricsLoading = ref(false)
const metricsError = ref<string | null>(null)
const METRIC_KEYS: MetricKey[] = ['cagr', 'sharpe', 'netReturn', 'ipsCompliance']

async function loadMetrics() {
  metricsLoading.value = true
  metricsError.value = null
  try {
    metrics4D.value = await fetchMetrics4D(threadId, { withSeries: true })
  } catch (e) {
    metricsError.value = e instanceof Error ? e.message : '메트릭 조회 실패'
  } finally {
    metricsLoading.value = false
  }
}

onMounted(loadMetrics)

const coreSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.committee === 'CORE')
)
const domainSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.committee === 'DOMAIN')
)

// 의견자만 카운트
const opinionSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.role === 'opinion')
)
const informationalCount = computed(
  () => scenario.speeches.filter((s) => s.role === 'informational').length
)

// 방향별 카운트
const directionCounts = computed(() => {
  const opinions = opinionSpeeches.value
  return {
    increase: opinions.filter((s) => s.direction === 'INCREASE').length,
    decrease: opinions.filter((s) => s.direction === 'DECREASE').length,
    hold: opinions.filter((s) => s.direction === 'HOLD').length,
  }
})

// R2에서 의견 변경된 에이전트 수
const changedCount = computed(
  () =>
    opinionSpeeches.value.filter(
      (s) => s.deltaFromRound1 === 'WEAKENED' || s.deltaFromRound1 === 'STRENGTHENED'
    ).length
)

const branchHeadline = computed(() => {
  if (isFinalMode.value) {
    return finalDecision.value!.status === 'cancelled'
      ? '결정을 취소했습니다'
      : '결정을 완료했습니다'
  }
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '위원회가 일치했습니다'
    case 'WEAK_CONSERVATIVE': return '약한 합의로 보수적으로 처리했습니다'
    case 'STRONG_CONFLICT': return '의견이 갈려 사용자에게 위임했습니다'
    case 'COMPLIANCE_VETO': return '정책 위반으로 자동 차단했습니다'
    default: return ''
  }
})

const branchSubtext = computed(() => {
  if (isFinalMode.value) {
    return `선택: ${finalDecision.value!.optionLabel}`
  }
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '시스템이 자동으로 거래안을 산정했습니다'
    case 'WEAK_CONSERVATIVE': return '권고 강도를 절반으로 줄여 적용했습니다'
    case 'STRONG_CONFLICT': return '3가지 옵션이 준비되었습니다 — 결정 화면에서 선택해주세요'
    case 'COMPLIANCE_VETO': return 'Hard rule이 LLM 추론을 차단했습니다'
    default: return ''
  }
})

const decisionDetail = computed(() => {
  if (scenario.autoProposal) {
    return scenario.autoProposal.trades.map((t) => `${t.ticker} ${t.change > 0 ? '+' : ''}${t.change}%p`).join(' · ')
  }
  if (scenario.conservativeProposal) {
    return scenario.conservativeProposal.conservativeTrades.map((t) => `${t.ticker} ${t.change > 0 ? '+' : ''}${t.change}%p`).join(' · ')
  }
  if (scenario.options && scenario.options.length > 0) {
    return `${scenario.options.length}개 옵션 제시`
  }
  if (scenario.vetoOptions) {
    return `자동 차단 · ${scenario.vetoOptions.length}개 후속 옵션`
  }
  return ''
})

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

function deltaText(s: AgentSpeech): string {
  if (s.role === 'informational' || !s.deltaFromRound1) return ''
  if (s.deltaFromRound1 === 'STRENGTHENED') return '강화'
  if (s.deltaFromRound1 === 'WEAKENED') return '약화'
  if (s.deltaFromRound1 === 'UNCHANGED') return '유지'
  return ''
}

function conflictTypeLabel(type: string): string {
  if (type === 'direction') return '방향'
  if (type === 'magnitude') return '강도'
  if (type === 'dimension') return '차원'
  return type
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function toggleSpeech(agent: string) {
  expandedSpeech.value = expandedSpeech.value === agent ? null : agent
}

function goBack() {
  router.push(`/run/${threadId}/result`)
}
function goDashboard() {
  router.push('/dashboard')
}

const branchColorClass = computed(() => {
  // 토스 톤: 회색 + 파랑/빨강만
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

// 분기 enum용 뱃지 배경(같은 색계열, 더 옅은 톤)
const branchBadgeClass = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE':
    case 'WEAK_CONSERVATIVE':
      return 'bg-blue-50 text-blue-700'
    case 'STRONG_CONFLICT':
    case 'COMPLIANCE_VETO':
      return 'bg-red-50 text-red-700'
    default: return 'bg-gray-100 text-gray-700'
  }
})

// ──────────── mockup 구조용 파생값 ────────────
const showDetails = ref(false)

// LibraScale 입력: scenario.consensus.round2 ∈ [-1, +1] (음수=CORE 무거움, 양수=DOMAIN)
const scaleTilt = computed(() => {
  const v = scenario.consensus.round2
  return typeof v === 'number' ? Math.max(-1, Math.min(1, v)) : 0
})
const tiltDegrees = computed(() => Math.abs(scaleTilt.value) * 22)
const consensusScore = computed(() => Math.abs(scaleTilt.value))

const strengthBadge = computed(() => {
  const s = consensusScore.value
  const { strong, weak } = scenario.consensus.thresholds
  if (s >= strong) return { label: 'STRONG', class: 'bg-blue-50 text-blue-700' }
  if (s >= weak)   return { label: 'MODERATE', class: 'bg-gray-100 text-gray-700' }
  return { label: 'WEAK', class: 'bg-amber-50 text-amber-700' }
})

const leanLabel = computed(() => {
  const t = scaleTilt.value
  if (Math.abs(t) < 0.05) return { label: '— BALANCED', class: 'text-gray-500', note: '양측 무게 비등' }
  if (t < 0)              return { label: '← CORE',     class: 'text-blue-700', note: '제안 측이 더 무거움' }
  return                         { label: '→ DOMAIN',   class: 'text-blue-700', note: '검증 측이 더 무거움' }
})

const totalOpinions = computed(() => opinionSpeeches.value.length)
const stackPct = computed(() => {
  const t = totalOpinions.value || 1
  return {
    inc:  (directionCounts.value.increase / t) * 100,
    hold: (directionCounts.value.hold     / t) * 100,
    dec:  (directionCounts.value.decrease / t) * 100,
  }
})

interface VerdictTrade { ticker: string; change: number }
const verdictItems = computed<VerdictTrade[]>(() => {
  if (scenario.autoProposal?.trades?.length) return scenario.autoProposal.trades
  if (scenario.conservativeProposal?.conservativeTrades?.length) return scenario.conservativeProposal.conservativeTrades
  return []
})

const complianceBadge = computed(() => {
  const sev = scenario.compliance?.severity
  if (sev === 'PASS')     return { label: 'Compliance PASS',    class: 'bg-emerald-50 text-emerald-700' }
  if (sev === 'WARNING')  return { label: 'Compliance WARNING', class: 'bg-amber-50 text-amber-700' }
  if (sev === 'BLOCKING') return { label: 'Compliance BLOCKED', class: 'bg-red-50 text-red-700' }
  return                         { label: 'Compliance —',       class: 'bg-gray-100 text-gray-600' }
})

// AGENTS 행의 막대 폭(%) — magnitude·confidence 기반, 최소 폭 보장
function agentBarPct(s: AgentSpeech): number {
  const m = Math.abs(s.magnitude ?? 0)
  const c = typeof s.confidence === 'number' ? s.confidence : 0.5
  return Math.min(100, Math.max(12, m * 8 + c * 50))
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 상단 네비게이션 -->
    <div class="bg-white">
      <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <button
          @click="goBack"
          class="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </button>
        <button
          @click="goDashboard"
          class="text-sm text-gray-500 hover:text-gray-900 transition"
        >대시보드</button>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-6 pb-12 pt-6">
      <!-- ============ HEADER ============ -->
      <header class="mb-6">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span
            v-if="isFinalMode"
            class="text-[10px] font-bold tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
          >FINAL · 회고</span>
          <span class="text-sm text-gray-400">{{ scenario.triggerMeta.label }}</span>
        </div>
        <h1
          class="text-3xl font-bold tracking-tight mb-2 leading-tight"
          :class="isFinalMode
            ? (finalDecision!.status === 'cancelled' ? 'text-gray-700' : 'text-emerald-700')
            : branchColorClass"
        >{{ branchHeadline }}</h1>
        <p class="text-base text-gray-600 leading-relaxed">
          {{ branchSubtext }}
          <span class="text-gray-400">·</span>
          <span class="text-gray-400">분기</span>
          <code class="font-mono text-amber-600">{{ scenario.consensus.branch }}</code>
        </p>
      </header>

      <!-- 회고 모드: 선택 결과 카드 (mockup 헤더 직하) -->
      <div
        v-if="isFinalMode"
        class="mb-3 bg-white rounded-3xl p-5 shadow-sm border-l-4"
        :class="finalDecision!.status === 'cancelled' ? 'border-gray-400' : 'border-emerald-500'"
      >
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-medium tracking-wider text-gray-500 mb-1">사용자 최종 선택</div>
            <div class="text-lg font-bold text-gray-900 leading-snug">{{ finalDecision!.optionLabel }}</div>
            <div class="text-xs text-gray-500 mt-1">
              {{ formatDate(finalDecision!.completedAt) }} {{ formatTime(finalDecision!.completedAt) }}
            </div>
          </div>
          <span
            class="px-3 py-1 text-xs font-bold rounded-full"
            :class="finalDecision!.status === 'cancelled'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-emerald-50 text-emerald-700'"
          >{{ finalDecision!.status === 'cancelled' ? '취소됨' : '승인 실행됨' }}</span>
        </div>
      </div>

      <!-- ============ HERO: 합의 저울 ============ -->
      <section class="bg-white rounded-3xl px-6 py-5 shadow-sm mb-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2 text-[11px] font-medium text-gray-500" style="letter-spacing: 1px;">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M6 6l-3 7a3 3 0 006 0L6 6zM18 6l-3 7a3 3 0 006 0L18 6zM9 21h6"/>
            </svg>
            <span>CONSENSUS BALANCE</span>
          </div>
          <span class="font-mono text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
            tilt {{ tiltDegrees.toFixed(1) }}°
          </span>
        </div>

        <div class="flex justify-center items-end py-2">
          <LibraScale
            :tilt="scaleTilt"
            :size="320"
            :animated="true"
            left-label="CORE"
            right-label="DOMAIN"
          />
        </div>

        <div class="grid grid-cols-3 gap-3 pt-4 mt-2 border-t border-gray-100">
          <div class="text-center">
            <div class="text-[10px] font-medium text-gray-400 tracking-wider mb-1">CONSENSUS</div>
            <div class="text-3xl font-mono font-semibold text-gray-900 leading-none">
              {{ consensusScore.toFixed(2) }}
            </div>
            <span
              class="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-mono font-medium rounded-md"
              :class="strengthBadge.class"
            >{{ strengthBadge.label }}</span>
          </div>
          <div class="text-center">
            <div class="text-[10px] font-medium text-gray-400 tracking-wider mb-1">LEAN</div>
            <div class="text-lg font-mono font-semibold leading-none" :class="leanLabel.class">
              {{ leanLabel.label }}
            </div>
            <div class="text-[11px] text-gray-400 mt-2">{{ leanLabel.note }}</div>
          </div>
          <div class="text-center">
            <div class="text-[10px] font-medium text-gray-400 tracking-wider mb-1">DURATION</div>
            <div class="text-lg font-mono font-semibold text-gray-900 leading-none">
              {{ scenario.durationSeconds.toFixed(1) }}<span class="text-xs text-gray-400 ml-0.5">s</span>
            </div>
            <div class="text-[11px] text-gray-400 mt-2">심의 소요시간</div>
          </div>
        </div>
      </section>

      <!-- ============ AGENTS | JURY 2-col ============ -->
      <div class="grid lg:grid-cols-2 gap-3 mb-3">
        <!-- AGENTS (CORE) -->
        <section class="bg-white rounded-3xl px-5 py-4 shadow-sm">
          <header class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 9h6M9 12h6M9 15h6" stroke-linecap="round"/>
            </svg>
            <span class="text-[11px] font-medium tracking-widest text-blue-700">제안 측 · AGENTS (CORE)</span>
            <span class="ml-auto text-[10px] font-mono text-gray-400">n={{ coreSpeeches.length }}</span>
          </header>
          <ul class="space-y-1.5">
            <li
              v-for="s in coreSpeeches"
              :key="s.agent"
              class="grid items-center gap-2 px-2.5 py-2 bg-blue-50 rounded-lg text-xs"
              style="grid-template-columns: 72px 1fr 60px;"
            >
              <span class="font-medium text-blue-700 truncate">{{ s.agent }}</span>
              <span class="h-1 bg-blue-100 rounded-full overflow-hidden">
                <span
                  class="block h-full bg-blue-600 rounded-full"
                  :style="{ width: agentBarPct(s) + '%' }"
                ></span>
              </span>
              <span
                class="font-mono text-right text-[11px]"
                :class="speechMagnitudeClass(s)"
              >{{ speechMagnitudeText(s) }}</span>
            </li>
          </ul>
          <p class="mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">
            <span class="text-gray-400">“</span>{{ decisionDetail || scenario.query }}<span class="text-gray-400">”</span>
          </p>
        </section>

        <!-- JURY (all opinions) -->
        <section class="bg-white rounded-3xl px-5 py-4 shadow-sm">
          <header class="flex items-center gap-2 mb-3 justify-end">
            <span class="text-[10px] font-mono text-gray-400 mr-auto">n={{ totalOpinions }}</span>
            <span class="text-[11px] font-medium tracking-widest text-emerald-700">검증 측 · JURY</span>
            <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="9" cy="7" r="3" stroke-linecap="round"/>
              <circle cx="17" cy="9" r="2" stroke-linecap="round"/>
              <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M15 21v-1a3 3 0 013-3h2a3 3 0 013 3v1" stroke-linecap="round"/>
            </svg>
          </header>
          <div class="flex h-2 rounded-full overflow-hidden mb-3 bg-gray-100">
            <span class="bg-emerald-600 h-full" :style="{ width: stackPct.inc + '%' }"></span>
            <span class="bg-gray-400 h-full" :style="{ width: stackPct.hold + '%' }"></span>
            <span class="bg-gray-300 h-full" :style="{ width: stackPct.dec + '%' }"></span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 mb-3">
            <div class="text-center py-2 bg-emerald-50 rounded-lg">
              <div class="text-xl font-mono font-semibold text-emerald-800 leading-none">{{ directionCounts.increase }}</div>
              <div class="text-[10px] text-emerald-700 mt-1">INCREASE</div>
            </div>
            <div class="text-center py-2 bg-gray-50 rounded-lg">
              <div class="text-xl font-mono font-semibold text-gray-700 leading-none">{{ directionCounts.hold }}</div>
              <div class="text-[10px] text-gray-500 mt-1">HOLD</div>
            </div>
            <div class="text-center py-2 bg-gray-50 rounded-lg">
              <div class="text-xl font-mono font-semibold text-gray-500 leading-none">{{ directionCounts.decrease }}</div>
              <div class="text-[10px] text-gray-500 mt-1">DECREASE</div>
            </div>
          </div>
          <div class="pt-2.5 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
            <span>의견 <code class="font-mono text-gray-900">{{ opinionSpeeches.length }}</code></span>
            <span>정보 <code class="font-mono text-gray-900">{{ informationalCount }}</code></span>
            <span>R2변경 <code class="font-mono text-gray-900">{{ changedCount }}</code></span>
          </div>
        </section>
      </div>

      <!-- ============ VERDICT ============ -->
      <section class="bg-white border-2 border-blue-500 rounded-3xl px-5 py-4 shadow-sm mb-3">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-2 text-[10px] font-medium tracking-widest text-gray-500">
              <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              <span v-if="isFinalMode">VERDICT · {{ finalDecision!.status === 'cancelled' ? '사용자 취소' : '사용자 승인 실행됨' }}</span>
              <span v-else>VERDICT · 합의 결과</span>
            </div>
            <div v-if="verdictItems.length" class="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <div v-for="t in verdictItems" :key="t.ticker" class="flex items-baseline gap-1.5">
                <span class="text-xs font-mono text-gray-500">{{ t.ticker }}</span>
                <span
                  class="text-base font-mono font-semibold"
                  :class="t.change >= 0 ? 'text-emerald-700' : 'text-red-700'"
                >{{ t.change > 0 ? '+' : '' }}{{ t.change }}%p</span>
              </div>
            </div>
            <div v-else class="text-sm text-gray-700 leading-snug">{{ decisionDetail }}</div>
          </div>
          <span
            class="px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap"
            :class="complianceBadge.class"
          >{{ complianceBadge.label }}</span>
        </div>
      </section>

      <!-- ============ 푸터 노트 ============ -->
      <p class="px-4 py-3 mb-8 bg-gray-100 rounded-xl text-xs text-gray-500 leading-relaxed">
        <strong class="text-gray-900 font-medium">읽는 법:</strong>
        저울이 수평일수록 합의가 강하고, 양측의 무게 차이가 클수록 기울기가 큽니다.
        CORE(제안)와 DOMAIN(검증)의 무게가 한쪽으로 치우치면 그 방향으로 기울어지며,
        합의 점수의 절대값이 클수록 강한 결정을 의미합니다.
      </p>

      <!-- ============ 세부 보기 toggle ============ -->
      <button
        @click="showDetails = !showDetails"
        class="w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
      >
        <span>{{ showDetails ? '세부 보기 접기' : '세부 보기 — 발언 · 중재 · 메트릭' }}</span>
        <svg
          class="w-4 h-4 transition-transform"
          :class="showDetails ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- ============ 세부 보기 contents ============ -->
      <!-- ================================================================ -->
      <!-- 펼침: 전체 발언 (2열 그리드) — 세부 보기 안 -->
      <!-- ================================================================ -->
      <div v-if="showDetails" class="mt-6">
        <div class="text-xs font-medium tracking-wider text-gray-500 mb-3 px-1">CORE · 시장·기회</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-5">
          <div
            v-for="speech in coreSpeeches"
            :key="speech.agent"
            class="bg-white rounded-2xl px-5 py-4 shadow-sm cursor-pointer hover:shadow-md transition"
            @click="toggleSpeech(speech.agent)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-3">
                <span class="text-base font-bold text-gray-900">{{ speech.agent }}</span>
                <span class="text-xs text-gray-400">{{ speech.role === 'informational' ? '정보' : '의견' }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span
                  v-if="deltaText(speech)"
                  class="text-xs text-gray-400"
                >{{ deltaText(speech) }}</span>
                <span class="text-lg font-bold font-mono" :class="speechMagnitudeClass(speech)">
                  {{ speechMagnitudeText(speech) }}
                </span>
              </div>
            </div>
            <div class="text-sm text-gray-600 mt-1">{{ speech.summary }}</div>

            <!-- 펼친 상세 -->
            <div
              v-if="expandedSpeech === speech.agent"
              class="mt-4 pt-4 border-t border-gray-100"
            >
              <div class="text-sm text-gray-700 leading-relaxed">{{ speech.reasoning }}</div>
              <div v-if="speech.role === 'opinion'" class="mt-3 text-xs text-gray-400">
                확신도 {{ (speech.confidence * 100).toFixed(0) }}%
              </div>
            </div>
          </div>

        </div>

        <div class="text-xs font-medium tracking-wider text-gray-500 mb-3 px-1">DOMAIN · 안전·제약</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div
            v-for="speech in domainSpeeches"
            :key="speech.agent"
            class="bg-white rounded-2xl px-5 py-4 shadow-sm cursor-pointer hover:shadow-md transition"
            @click="toggleSpeech(speech.agent)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-baseline gap-3">
                <span class="text-base font-bold text-gray-900">{{ speech.agent }}</span>
                <span class="text-xs text-gray-400">{{ speech.role === 'informational' ? '정보' : '의견' }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span
                  v-if="deltaText(speech)"
                  class="text-xs text-gray-400"
                >{{ deltaText(speech) }}</span>
                <span class="text-lg font-bold font-mono" :class="speechMagnitudeClass(speech)">
                  {{ speechMagnitudeText(speech) }}
                </span>
              </div>
            </div>
            <div class="text-sm text-gray-600 mt-1">{{ speech.summary }}</div>

            <div
              v-if="expandedSpeech === speech.agent"
              class="mt-4 pt-4 border-t border-gray-100"
            >
              <div class="text-sm text-gray-700 leading-relaxed">{{ speech.reasoning }}</div>
              <div v-if="speech.role === 'opinion'" class="mt-3 text-xs text-gray-400">
                확신도 {{ (speech.confidence * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 4+5. Mediator + Final Judge — 2열 (세부 보기) -->
      <!-- ================================================================ -->
      <div v-if="showDetails" class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <!-- Mediator 판정 -->
        <div v-if="scenario.mediatorJudgment" class="bg-white rounded-3xl p-6 shadow-sm">
          <div class="text-sm text-gray-400 mb-1">충돌 식별</div>
          <h2 class="text-xl font-bold text-gray-900 mb-5">Mediator가 무엇을 봤나</h2>

          <div v-if="scenario.mediatorJudgment.detectedConflicts.length > 0" class="mb-5">
            <div class="text-xs text-gray-500 mb-2">발견된 충돌 {{ scenario.mediatorJudgment.detectedConflicts.length }}건</div>
            <div class="space-y-2">
              <div
                v-for="(c, i) in scenario.mediatorJudgment.detectedConflicts"
                :key="i"
                class="bg-gray-50 rounded-xl p-4"
              >
                <div class="flex items-baseline gap-2 mb-1">
                  <span class="text-xs px-2 py-0.5 bg-white text-gray-700 rounded-full font-medium">{{ conflictTypeLabel(c.type) }} 충돌</span>
                  <span class="text-xs font-mono text-gray-500">{{ c.asset }}</span>
                </div>
                <div class="text-sm text-gray-800 leading-relaxed">{{ c.description }}</div>
              </div>
            </div>
          </div>

          <div class="mb-5">
            <div class="text-xs text-gray-500 mb-2">Round 2 재호출</div>
            <div v-if="scenario.mediatorJudgment.retargetedAgents.length > 0">
              <div class="text-xl font-bold text-gray-900 mb-2">{{ scenario.mediatorJudgment.retargetedAgents.length }}명</div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="agent in scenario.mediatorJudgment.retargetedAgents"
                  :key="agent"
                  class="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full"
                >{{ agent }}</span>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500">
              <div class="text-xl font-bold text-gray-400 mb-1">없음</div>
              <div>표적 재호출 없음 — Round 2는 형식적 검토</div>
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-500 mb-1">판정 근거</div>
            <div class="text-sm text-gray-700 leading-relaxed">{{ scenario.mediatorJudgment.reasoning }}</div>
          </div>
        </div>

        <!-- Final Judge 추론 -->
        <div v-if="scenario.finalJudgeReasoning" class="bg-white rounded-3xl p-6 shadow-sm">
          <div class="text-sm text-gray-400 mb-1">최종 분기 결정</div>
          <h2 class="text-xl font-bold text-gray-900 mb-5">Final Judge가 어떻게 결정했나</h2>

          <div class="mb-5">
            <div class="text-xs text-gray-500 mb-1">가중 합의 점수</div>
            <div class="text-4xl font-bold font-mono mb-1" :class="branchColorClass">
              {{ scenario.finalJudgeReasoning.weightedScore }}
            </div>
            <div class="text-sm text-gray-600">{{ scenario.finalJudgeReasoning.branchDecision }}</div>
          </div>

          <div class="h-px bg-gray-100 mb-4"></div>

          <div class="mb-4">
            <div class="text-xs text-gray-500 mb-1">추론</div>
            <div class="text-sm text-gray-700 leading-relaxed">
              {{ scenario.finalJudgeReasoning.reasoning }}
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-500 mb-2">주요 고려 사항</div>
            <ul class="space-y-1.5">
              <li
                v-for="(c, i) in scenario.finalJudgeReasoning.considerations"
                :key="i"
                class="flex items-start gap-2.5 text-sm text-gray-700"
              >
                <span class="w-1 h-1 rounded-full bg-gray-400 mt-2 flex-shrink-0"></span>
                <span class="leading-relaxed">{{ c }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 6. 4차원 메트릭 (세부 보기) -->
      <!-- ================================================================ -->
      <div v-if="showDetails" class="mb-8">
        <div class="mb-4 flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div class="text-sm text-gray-400 mb-1">벤치마크 비교</div>
            <h2 class="text-xl font-bold text-gray-900">4차원 메트릭</h2>
          </div>
          <p v-if="metrics4D" class="text-xs text-gray-500">
            {{ metrics4D.period.start }} ~ {{ metrics4D.period.end }}
            · vs <span class="font-medium">{{ metrics4D.benchmark.name }}</span>
          </p>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm">
          <!-- 로딩 -->
          <div v-if="metricsLoading" class="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div v-for="i in 4" :key="i" class="animate-pulse">
              <div class="h-3 w-12 bg-gray-100 rounded mb-2"></div>
              <div class="h-2 w-20 bg-gray-100 rounded mb-3"></div>
              <div class="h-7 w-24 bg-gray-100 rounded mb-3"></div>
              <div class="h-12 bg-gray-50 rounded-lg"></div>
            </div>
          </div>

          <!-- 에러 -->
          <div v-else-if="metricsError" class="text-center py-6">
            <div class="text-sm text-red-600 mb-2">{{ metricsError }}</div>
            <button
              @click="loadMetrics"
              class="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2"
            >다시 시도</button>
          </div>

          <!-- 정상 -->
          <div v-else-if="metrics4D" class="grid grid-cols-2 md:grid-cols-4 gap-5">
            <Metric4DCard
              v-for="key in METRIC_KEYS"
              :key="key"
              :meta="METRIC_META[key]"
              :data="metrics4D.metrics[key]"
              :benchmark-name="metrics4D.benchmark.name"
            />
          </div>

          <div v-if="metrics4D" class="mt-4 pt-3 border-t border-gray-100 text-center">
            <div class="text-[10px] text-gray-400 font-mono">
              generated {{ new Date(metrics4D.generatedAt).toLocaleString('ko-KR') }}
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 7. 푸터 — 가로 배치 -->
      <!-- ================================================================ -->
      <div class="flex items-center justify-between gap-4 pt-4 flex-wrap">
        <div class="text-xs text-gray-400">
          {{ formatDate(scenario.completedAt) }} {{ formatTime(scenario.completedAt) }}
          ·
          <span class="font-mono">{{ scenario.threadId }}</span>
        </div>
        <div class="flex gap-2">
          <button
            @click="goBack"
            class="px-5 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
          >결정 화면으로</button>
          <button
            @click="goDashboard"
            class="px-6 py-3 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-black transition"
          >대시보드로 이동</button>
        </div>
      </div>
    </div>
  </div>
</template>
