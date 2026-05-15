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

import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { resolveScenario, type AgentSpeech } from '@/mocks/scenarios'

const router = useRouter()
const route = useRoute()
const threadId = route.params.threadId as string
const scenario = resolveScenario(threadId)

const showAllSpeeches = ref(false)
const expandedSpeech = ref<string | null>(null)

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
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '위원회가 일치했습니다'
    case 'WEAK_CONSERVATIVE': return '약한 합의로 보수적으로 처리했습니다'
    case 'STRONG_CONFLICT': return '의견이 갈려 사용자에게 위임했습니다'
    case 'COMPLIANCE_VETO': return '정책 위반으로 자동 차단했습니다'
    default: return ''
  }
})

const branchSubtext = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '시스템이 자동으로 거래안을 산정했습니다'
    case 'WEAK_CONSERVATIVE': return '권고 강도를 절반으로 줄여 적용했습니다'
    case 'STRONG_CONFLICT': return '3가지 옵션 중 선택하셨습니다'
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
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 상단 네비게이션 -->
    <div class="bg-white">
      <div class="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
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

    <div class="max-w-2xl mx-auto px-6 pb-24 pt-8">
      <!-- ================================================================ -->
      <!-- 1. 헤드라인 — 가장 중요한 한 문장 -->
      <!-- ================================================================ -->
      <div class="mb-16">
        <div class="text-sm text-gray-400 mb-4">{{ scenario.triggerMeta.label }}</div>
        <h1
          class="text-3xl font-bold tracking-tight mb-3 leading-tight"
          :class="branchColorClass"
        >{{ branchHeadline }}</h1>
        <p class="text-base text-gray-600 leading-relaxed">{{ branchSubtext }}</p>
      </div>

      <!-- ================================================================ -->
      <!-- 2. 결정 요약 카드 - 핵심 숫자 한 줄 -->
      <!-- ================================================================ -->
      <div class="mb-16">
        <div class="bg-white rounded-3xl p-8 shadow-sm">
          <div class="text-sm text-gray-500 mb-2">최종 결정</div>
          <div class="text-2xl font-bold text-gray-900 mb-1 leading-snug">{{ decisionDetail }}</div>
          <div class="text-sm text-gray-500">{{ scenario.query }}</div>

          <!-- 구분선 -->
          <div class="my-6 h-px bg-gray-100"></div>

          <!-- 핵심 숫자 3개 -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-xs text-gray-500 mb-1">합의 점수</div>
              <div class="text-2xl font-bold font-mono text-gray-900">{{ scenario.consensus.round2 }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">분기</div>
              <div class="text-base font-bold font-mono" :class="branchColorClass">{{ scenario.consensus.branch }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">소요</div>
              <div class="text-2xl font-bold font-mono text-gray-900">{{ scenario.durationSeconds }}<span class="text-base font-normal text-gray-400 ml-0.5">s</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 3. 토론 요약 — 큰 숫자로 한눈에 -->
      <!-- ================================================================ -->
      <div class="mb-16">
        <div class="mb-6">
          <div class="text-sm text-gray-400 mb-2">한눈에 보기</div>
          <h2 class="text-2xl font-bold text-gray-900">11명이 무엇을 말했나</h2>
        </div>

        <div class="bg-white rounded-3xl p-8 shadow-sm">
          <!-- 큰 숫자 그리드 -->
          <div class="grid grid-cols-3 gap-4 mb-8">
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

          <!-- 구분선 -->
          <div class="h-px bg-gray-100 mb-6"></div>

          <!-- 보조 정보 -->
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">의견자</span>
              <span class="font-bold text-gray-900">{{ opinionSpeeches.length }}명</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">정보자</span>
              <span class="font-bold text-gray-900">{{ informationalCount }}명</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">R2에서 변경</span>
              <span class="font-bold text-gray-900">{{ changedCount }}명</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-gray-500">Compliance</span>
              <span
                class="font-bold"
                :class="{
                  'text-blue-600': scenario.compliance.severity === 'PASS',
                  'text-gray-700': scenario.compliance.severity === 'WARNING',
                  'text-red-600': scenario.compliance.severity === 'BLOCKING',
                }"
              >{{ scenario.compliance.severity }}</span>
            </div>
          </div>

          <!-- 전체 발언 토글 -->
          <button
            @click="showAllSpeeches = !showAllSpeeches"
            class="mt-8 w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition flex items-center justify-center gap-1.5"
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

        <!-- 펼침: 전체 발언 -->
        <div v-if="showAllSpeeches" class="mt-4 space-y-2.5">
          <!-- Core 위원회 -->
          <div class="text-xs font-medium tracking-wider text-gray-500 mt-6 mb-3 px-2">CORE · 시장·기회</div>
          <div
            v-for="speech in coreSpeeches"
            :key="speech.agent"
            class="bg-white rounded-2xl px-6 py-5 shadow-sm cursor-pointer hover:shadow-md transition"
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

          <!-- Domain 위원회 -->
          <div class="text-xs font-medium tracking-wider text-gray-500 mt-6 mb-3 px-2">DOMAIN · 안전·제약</div>
          <div
            v-for="speech in domainSpeeches"
            :key="speech.agent"
            class="bg-white rounded-2xl px-6 py-5 shadow-sm cursor-pointer hover:shadow-md transition"
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
      <!-- 4. Mediator 판정 -->
      <!-- ================================================================ -->
      <div v-if="scenario.mediatorJudgment" class="mb-16">
        <div class="mb-6">
          <div class="text-sm text-gray-400 mb-2">충돌 식별</div>
          <h2 class="text-2xl font-bold text-gray-900">Mediator가 무엇을 봤나</h2>
        </div>

        <div class="bg-white rounded-3xl p-8 shadow-sm">
          <!-- 식별된 충돌 -->
          <div v-if="scenario.mediatorJudgment.detectedConflicts.length > 0" class="mb-8">
            <div class="text-sm text-gray-500 mb-4">발견된 충돌 {{ scenario.mediatorJudgment.detectedConflicts.length }}건</div>
            <div class="space-y-3">
              <div
                v-for="(c, i) in scenario.mediatorJudgment.detectedConflicts"
                :key="i"
                class="bg-gray-50 rounded-2xl p-5"
              >
                <div class="flex items-baseline gap-2 mb-2">
                  <span class="text-xs px-2 py-0.5 bg-white text-gray-700 rounded-full font-medium">{{ conflictTypeLabel(c.type) }} 충돌</span>
                  <span class="text-xs font-mono text-gray-500">{{ c.asset }}</span>
                </div>
                <div class="text-sm text-gray-800 leading-relaxed">{{ c.description }}</div>
              </div>
            </div>
          </div>

          <!-- 재호출 대상 -->
          <div class="mb-6">
            <div class="text-sm text-gray-500 mb-3">Round 2 재호출</div>
            <div v-if="scenario.mediatorJudgment.retargetedAgents.length > 0">
              <div class="text-2xl font-bold text-gray-900 mb-2">{{ scenario.mediatorJudgment.retargetedAgents.length }}명</div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="agent in scenario.mediatorJudgment.retargetedAgents"
                  :key="agent"
                  class="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-600 rounded-full"
                >{{ agent }}</span>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500">
              <div class="text-2xl font-bold text-gray-400 mb-1">없음</div>
              <div>표적 재호출 없음 — Round 2는 형식적 검토</div>
            </div>
          </div>

          <!-- 판정 근거 -->
          <div class="pt-6 border-t border-gray-100">
            <div class="text-sm text-gray-500 mb-2">판정 근거</div>
            <div class="text-sm text-gray-700 leading-relaxed">{{ scenario.mediatorJudgment.reasoning }}</div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 5. Final Judge 추론 -->
      <!-- ================================================================ -->
      <div v-if="scenario.finalJudgeReasoning" class="mb-16">
        <div class="mb-6">
          <div class="text-sm text-gray-400 mb-2">최종 분기 결정</div>
          <h2 class="text-2xl font-bold text-gray-900">Final Judge가 어떻게 결정했나</h2>
        </div>

        <div class="bg-white rounded-3xl p-8 shadow-sm">
          <!-- 큰 점수 -->
          <div class="mb-6">
            <div class="text-sm text-gray-500 mb-1">가중 합의 점수</div>
            <div class="text-5xl font-bold font-mono mb-2" :class="branchColorClass">
              {{ scenario.finalJudgeReasoning.weightedScore }}
            </div>
            <div class="text-sm text-gray-600">{{ scenario.finalJudgeReasoning.branchDecision }}</div>
          </div>

          <!-- 구분선 -->
          <div class="h-px bg-gray-100 mb-6"></div>

          <!-- 추론 -->
          <div class="mb-6">
            <div class="text-sm text-gray-500 mb-2">추론</div>
            <div class="text-sm text-gray-700 leading-relaxed">
              {{ scenario.finalJudgeReasoning.reasoning }}
            </div>
          </div>

          <!-- 고려 사항 -->
          <div class="pt-6 border-t border-gray-100">
            <div class="text-sm text-gray-500 mb-3">주요 고려 사항</div>
            <ul class="space-y-2">
              <li
                v-for="(c, i) in scenario.finalJudgeReasoning.considerations"
                :key="i"
                class="flex items-start gap-3 text-sm text-gray-700"
              >
                <span class="w-1 h-1 rounded-full bg-gray-400 mt-2 flex-shrink-0"></span>
                <span class="leading-relaxed">{{ c }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 6. 4차원 메트릭 - placeholder -->
      <!-- ================================================================ -->
      <div class="mb-16">
        <div class="mb-6">
          <div class="text-sm text-gray-400 mb-2">벤치마크 비교</div>
          <h2 class="text-2xl font-bold text-gray-900">4차원 메트릭</h2>
          <p class="text-sm text-gray-500 mt-2 leading-relaxed">
            단일 수익률이 아닌 세후·거래비용·제약 준수까지 본 net 수익률에서 차별점.
          </p>
        </div>

        <div class="bg-white rounded-3xl p-8 shadow-sm">
          <div class="grid grid-cols-2 gap-6">
            <div v-for="(m, i) in [
              { title: 'CAGR', subtitle: '연 환산 수익률', expected: '비슷 또는 약간 낮음' },
              { title: 'Sharpe', subtitle: '위험조정 수익률', expected: '비슷' },
              { title: 'Net Return', subtitle: '세후 + 거래비용 차감', expected: '우위 가능' },
              { title: 'IPS 준수율', subtitle: '한도 위반 횟수', expected: '압도적 우위' },
            ]" :key="i">
              <div class="text-base font-bold text-gray-900 mb-1">{{ m.title }}</div>
              <div class="text-xs text-gray-500 mb-3">{{ m.subtitle }}</div>
              <div class="h-16 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                <span class="text-xs text-gray-400">차트 자리</span>
              </div>
              <div class="text-xs text-gray-600">
                <span class="text-gray-400">예상</span>
                <span class="ml-1">{{ m.expected }}</span>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t border-gray-100 text-center">
            <div class="text-xs text-gray-400">다음 iteration에서 시각화 예정</div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 7. 푸터 -->
      <!-- ================================================================ -->
      <div class="text-center pt-8">
        <div class="text-xs text-gray-400 mb-6">
          {{ formatDate(scenario.completedAt) }} {{ formatTime(scenario.completedAt) }}
          ·
          <span class="font-mono">{{ scenario.threadId }}</span>
        </div>
        <div class="flex flex-col gap-2">
          <button
            @click="goDashboard"
            class="w-full py-4 text-base font-bold bg-gray-900 text-white rounded-2xl hover:bg-black transition"
          >대시보드로 이동</button>
          <button
            @click="goBack"
            class="w-full py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition"
          >결정 화면으로</button>
        </div>
      </div>
    </div>
  </div>
</template>