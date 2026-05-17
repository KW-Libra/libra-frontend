<script setup lang="ts">
/**
 * src/pages/RunReportPage.vue
 *
 * 보고서 페이지 — 결정 화면의 "상세 보고서 보기" 버튼으로 진입.
 * 라우트: /run/:threadId/report
 *
 * 구성:
 * - 헤더 (run 메타 + 분기 + 결정 결과 한 줄)
 * - 토론 트랜스크립트 풀버전 (12 발언, Round 1 → Round 2 변화)
 * - Mediator 판정
 * - Final Judge 추론
 * - 4차원 메트릭 비교 (placeholder, 다음 iteration)
 */

import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { resolveScenario, type AgentSpeech } from '@/mocks/scenarios'

const router = useRouter()
const route = useRoute()
const threadId = route.params.threadId as string
const scenario = resolveScenario(threadId)

const coreSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.committee === 'CORE')
)
const domainSpeeches = computed(() =>
  scenario.speeches.filter((s) => s.committee === 'DOMAIN')
)

const branchTone = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return 'emerald'
    case 'WEAK_CONSERVATIVE': return 'amber'
    case 'STRONG_CONFLICT': return 'red'
    case 'COMPLIANCE_VETO': return 'red'
    default: return 'gray'
  }
})

const branchLabel = computed(() => {
  switch (scenario.consensus.branch) {
    case 'STRONG_REBALANCE': return '자동 리밸런싱 권고'
    case 'WEAK_CONSERVATIVE': return '보수적 리밸런싱 (50%)'
    case 'STRONG_CONFLICT': return '사용자 결정 필요 (3옵션)'
    case 'COMPLIANCE_VETO': return '정책 위반 자동 차단'
    default: return ''
  }
})

const decisionSummary = computed(() => {
  if (scenario.autoProposal) {
    return scenario.autoProposal.trades.map((t) => `${t.ticker} ${t.change > 0 ? '+' : ''}${t.change}%p`).join(', ')
  }
  if (scenario.conservativeProposal) {
    return scenario.conservativeProposal.conservativeTrades.map((t) => `${t.ticker} ${t.change > 0 ? '+' : ''}${t.change}%p`).join(', ')
  }
  if (scenario.options && scenario.options.length > 0) {
    return `${scenario.options.length}개 옵션 제시 — 사용자 선택`
  }
  if (scenario.vetoOptions) {
    return `자동 차단 — ${scenario.vetoOptions.length}개 후속 옵션 제시`
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
  if (s.direction === 'HOLD') return 'text-gray-600'
  if (s.direction === 'DECREASE') return 'text-red-700'
  return 'text-emerald-700'
}

function deltaText(s: AgentSpeech): string {
  if (s.role === 'informational') return ''
  if (s.deltaFromRound1 === 'STRENGTHENED') return '↗ 강화'
  if (s.deltaFromRound1 === 'WEAKENED') return '↘ 약화'
  if (s.deltaFromRound1 === 'UNCHANGED') return '— 유지'
  return ''
}

function deltaClass(s: AgentSpeech): string {
  if (s.deltaFromRound1 === 'STRENGTHENED') return 'text-blue-600 bg-blue-50'
  if (s.deltaFromRound1 === 'WEAKENED') return 'text-amber-600 bg-amber-50'
  return 'text-gray-400 bg-gray-50'
}

function conflictTypeLabel(type: string): string {
  if (type === 'direction') return '방향 충돌'
  if (type === 'magnitude') return '강도 충돌'
  if (type === 'dimension') return '차원 충돌'
  return type
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function goBack() {
  router.push(`/run/${threadId}/result`)
}
function goDashboard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 상단 네비게이션 -->
    <div class="border-b border-gray-200 bg-white">
      <div class="max-w-5xl mx-auto px-8 py-3 flex items-center justify-between">
        <button
          @click="goBack"
          class="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 transition"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          결정 화면으로
        </button>
        <button
          @click="goDashboard"
          class="text-xs text-gray-600 hover:text-gray-900 transition"
        >대시보드</button>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-8 py-10">
      <!-- 헤더 -->
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full"
            :class="{
              'text-emerald-700 bg-emerald-50 border-emerald-200': branchTone === 'emerald',
              'text-amber-700 bg-amber-50 border-amber-200': branchTone === 'amber',
              'text-red-700 bg-red-50 border-red-200': branchTone === 'red',
            }"
          >
            <span class="text-[10px] tracking-wider">상세 보고서</span>
          </span>
          <span class="text-xs text-gray-400 font-mono">{{ scenario.threadId }}</span>
        </div>

        <h1 class="text-3xl font-medium tracking-tight text-gray-900 mb-3">
          {{ scenario.triggerMeta.label }}
        </h1>
        <p class="text-sm text-gray-600 leading-relaxed mb-5">{{ scenario.query }}</p>

        <!-- 메타 라인 -->
        <div class="flex items-center gap-6 text-xs flex-wrap">
          <div>
            <span class="text-gray-400">실행 시각</span>
            <span class="ml-1.5 font-medium text-gray-800 font-mono">
              {{ formatDate(scenario.completedAt) }} {{ formatTime(scenario.completedAt) }}
            </span>
          </div>
          <div class="h-3 w-px bg-gray-200"></div>
          <div>
            <span class="text-gray-400">소요 시간</span>
            <span class="ml-1.5 font-medium text-gray-800 font-mono">{{ scenario.durationSeconds }}s</span>
          </div>
          <div class="h-3 w-px bg-gray-200"></div>
          <div>
            <span class="text-gray-400">트리거</span>
            <span class="ml-1.5 font-medium text-gray-800">{{ scenario.triggerMeta.type.toUpperCase() }}</span>
          </div>
        </div>
      </div>

      <!-- 결과 요약 카드 (큰 박스) -->
      <div
        class="mb-12 p-6 rounded-lg border-l-4"
        :class="{
          'bg-emerald-50/30 border-emerald-200 border-l-emerald-500': branchTone === 'emerald',
          'bg-amber-50/30 border-amber-200 border-l-amber-400': branchTone === 'amber',
          'bg-red-50/30 border-red-200 border-l-red-500': branchTone === 'red',
        }"
        style="border-width: 1px; border-left-width: 4px;"
      >
        <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">최종 결정</div>
        <div class="text-xl font-medium text-gray-900 mb-3">{{ branchLabel }}</div>
        <div class="text-sm text-gray-700 mb-4">{{ decisionSummary }}</div>
        <div class="flex items-baseline gap-6 text-xs">
          <div>
            <span class="text-gray-500">합의 점수</span>
            <span class="ml-2 font-mono font-semibold text-gray-900">{{ scenario.consensus.round2 }}</span>
            <span class="ml-1 text-gray-400 font-mono">(R1 {{ scenario.consensus.round1 }})</span>
          </div>
          <div>
            <span class="text-gray-500">분기 코드</span>
            <span class="ml-2 font-mono text-gray-900">{{ scenario.consensus.branch }}</span>
          </div>
          <div>
            <span class="text-gray-500">Compliance</span>
            <span
              class="ml-2 font-mono font-medium"
              :class="{
                'text-emerald-700': scenario.compliance.severity === 'PASS',
                'text-amber-700': scenario.compliance.severity === 'WARNING',
                'text-red-700': scenario.compliance.severity === 'BLOCKING',
              }"
            >{{ scenario.compliance.severity }}</span>
          </div>
        </div>
      </div>

      <!-- 섹션 1: 토론 트랜스크립트 -->
      <section class="mb-12">
        <div class="flex items-baseline justify-between mb-2">
          <h2 class="text-lg font-medium text-gray-900">1. 토론 트랜스크립트</h2>
          <span class="text-xs text-gray-400">12명 발언 · Round 1 → Round 2</span>
        </div>
        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          11명의 AI 에이전트와 Compliance Rule Engine이 같은 입력을 동시에 평가한 결과입니다.
          각 발언은 *의견 또는 정보* 로 구분되며, Round 2에서 의견 갱신이 일어났는지 표시됩니다.
        </p>

        <!-- Core 위원회 -->
        <div class="mb-8">
          <div class="text-xs font-medium tracking-[0.15em] text-gray-700 mb-3">
            CORE 위원회 · 시장·기회 관점
          </div>
          <div class="space-y-3">
            <div
              v-for="speech in coreSpeeches"
              :key="speech.agent"
              class="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-start gap-4">
                <div class="w-24 flex-shrink-0">
                  <div class="text-sm font-medium text-gray-900">{{ speech.agent }}</div>
                  <div class="text-[10px] text-gray-400 mt-0.5">
                    {{ speech.role === 'informational' ? '정보' : '의견' }}
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-3 mb-2">
                    <span class="text-lg font-semibold font-mono" :class="speechMagnitudeClass(speech)">{{ speechMagnitudeText(speech) }}</span>
                    <span v-if="speech.role === 'opinion'" class="text-xs text-gray-500">
                      conf {{ speech.confidence.toFixed(2) }}
                    </span>
                    <span
                      v-if="deltaText(speech)"
                      class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      :class="deltaClass(speech)"
                    >{{ deltaText(speech) }}</span>
                  </div>
                  <div class="text-sm font-medium text-gray-800 mb-1">{{ speech.summary }}</div>
                  <div class="text-xs text-gray-600 leading-relaxed">{{ speech.reasoning }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Domain 위원회 -->
        <div>
          <div class="text-xs font-medium tracking-[0.15em] text-gray-700 mb-3">
            DOMAIN 위원회 · 안전·제약 관점
          </div>
          <div class="space-y-3">
            <div
              v-for="speech in domainSpeeches"
              :key="speech.agent"
              class="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-start gap-4">
                <div class="w-24 flex-shrink-0">
                  <div class="text-sm font-medium text-gray-900">{{ speech.agent }}</div>
                  <div class="text-[10px] text-gray-400 mt-0.5">
                    {{ speech.role === 'informational' ? '정보' : '의견' }}
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-3 mb-2">
                    <span class="text-lg font-semibold font-mono" :class="speechMagnitudeClass(speech)">{{ speechMagnitudeText(speech) }}</span>
                    <span v-if="speech.role === 'opinion'" class="text-xs text-gray-500">
                      conf {{ speech.confidence.toFixed(2) }}
                    </span>
                    <span
                      v-if="deltaText(speech)"
                      class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      :class="deltaClass(speech)"
                    >{{ deltaText(speech) }}</span>
                  </div>
                  <div class="text-sm font-medium text-gray-800 mb-1">{{ speech.summary }}</div>
                  <div class="text-xs text-gray-600 leading-relaxed">{{ speech.reasoning }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 섹션 2: Mediator 판정 -->
      <section v-if="scenario.mediatorJudgment" class="mb-12">
        <div class="flex items-baseline justify-between mb-2">
          <h2 class="text-lg font-medium text-gray-900">2. Mediator 판정</h2>
          <span class="text-xs text-gray-400">Round 1 후 충돌 식별 및 표적 재호출</span>
        </div>
        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          Mediator는 1차 의견을 보고 *충돌이 일어났는지* 식별하며, *누구를 다시 호출할지* 결정합니다.
        </p>

        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <!-- 식별된 충돌 -->
          <div class="mb-5">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">식별된 충돌</div>
            <div class="space-y-2">
              <div
                v-for="(c, i) in scenario.mediatorJudgment.detectedConflicts"
                :key="i"
                class="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <span class="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium flex-shrink-0">{{ conflictTypeLabel(c.type) }}</span>
                <span class="text-xs font-mono text-gray-500 flex-shrink-0">{{ c.asset }}</span>
                <span class="text-xs text-gray-700 flex-1">{{ c.description }}</span>
              </div>
            </div>
          </div>

          <!-- 표적 재호출 -->
          <div class="mb-5">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">Round 2 재호출 대상</div>
            <div v-if="scenario.mediatorJudgment.retargetedAgents.length > 0" class="flex flex-wrap gap-1.5">
              <span
                v-for="agent in scenario.mediatorJudgment.retargetedAgents"
                :key="agent"
                class="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded"
              >{{ agent }}</span>
            </div>
            <div v-else class="text-xs text-gray-500 italic">표적 재호출 없음 — Round 2는 형식적 검토</div>
          </div>

          <!-- 판정 근거 -->
          <div>
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">판정 근거</div>
            <div class="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded">
              {{ scenario.mediatorJudgment.reasoning }}
            </div>
          </div>
        </div>
      </section>

      <!-- 섹션 3: Final Judge 추론 -->
      <section v-if="scenario.finalJudgeReasoning" class="mb-12">
        <div class="flex items-baseline justify-between mb-2">
          <h2 class="text-lg font-medium text-gray-900">3. Final Judge 추론</h2>
          <span class="text-xs text-gray-400">최종 분기 결정 및 근거</span>
        </div>
        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          Final Judge는 모든 trace (12 발언 + Mediator + Compliance) 를 통합해 *분기 결정* 을 내립니다.
          분기 자체는 결정론적 룰로 정해지고, Final Judge는 그 안에서 reasoning과 trade 세부를 산정합니다.
        </p>

        <div class="bg-white border border-gray-200 rounded-lg p-5">
          <div class="grid grid-cols-2 gap-4 mb-5">
            <div class="p-3 bg-gray-50 rounded">
              <div class="text-[10px] text-gray-500 tracking-wider mb-1">가중 합의 점수</div>
              <div class="text-lg font-mono font-semibold text-gray-900">{{ scenario.finalJudgeReasoning.weightedScore }}</div>
            </div>
            <div class="p-3 bg-gray-50 rounded">
              <div class="text-[10px] text-gray-500 tracking-wider mb-1">분기 결정</div>
              <div class="text-sm font-mono font-semibold text-gray-900">{{ scenario.finalJudgeReasoning.branchDecision }}</div>
            </div>
          </div>

          <div class="mb-5">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">추론</div>
            <div class="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded">
              {{ scenario.finalJudgeReasoning.reasoning }}
            </div>
          </div>

          <div>
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">주요 고려 사항</div>
            <ul class="space-y-1.5">
              <li
                v-for="(c, i) in scenario.finalJudgeReasoning.considerations"
                :key="i"
                class="flex items-start gap-2 text-xs text-gray-700"
              >
                <span class="text-gray-400 mt-0.5">·</span>
                <span class="flex-1">{{ c }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 섹션 4: 4차원 메트릭 비교 (placeholder) -->
      <section class="mb-12">
        <div class="flex items-baseline justify-between mb-2">
          <h2 class="text-lg font-medium text-gray-900">4. 4차원 메트릭 비교</h2>
          <span class="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">다음 iteration</span>
        </div>
        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          Libra와 벤치마크 3종을 4차원으로 비교합니다.
          단일 수익률이 아닌 *세후 + 거래비용 + 제약 준수* 까지 본 net 수익률에서 차별점을 강조합니다.
        </p>

        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="(label, i) in [
              { title: 'CAGR (수익률)', subtitle: '연 환산 수익률', expected: '△ 비슷 또는 약간 낮음' },
              { title: 'Sharpe Ratio', subtitle: '위험조정 수익률', expected: '△ 비슷' },
              { title: 'Net Return', subtitle: '세후 + 거래비용 차감', expected: '✅ 우위 가능' },
              { title: 'IPS 준수율', subtitle: '한도 위반 횟수', expected: '✅ 압도적 우위' },
            ]"
            :key="i"
            class="p-5 bg-white border border-gray-200 rounded-lg border-dashed"
          >
            <div class="text-sm font-medium text-gray-900 mb-1">{{ label.title }}</div>
            <div class="text-xs text-gray-500 mb-3">{{ label.subtitle }}</div>
            <div class="h-20 flex items-center justify-center bg-gray-50 rounded mb-3">
              <span class="text-xs text-gray-400">차트 자리</span>
            </div>
            <div class="text-[11px] text-gray-600">예상: {{ label.expected }}</div>
          </div>
        </div>

        <div class="mt-4 text-[11px] text-gray-400 italic text-center">
          ※ 4차원 메트릭 차트는 발표 자료(PPT) 또는 다음 iteration에서 시각화 예정
        </div>
      </section>

      <!-- 푸터 -->
      <div class="border-t border-gray-200 pt-6 flex items-center justify-between">
        <div class="text-[11px] text-gray-400">
          Libra · Agentic AI Portfolio Rebalancing · 시안 단계 (백엔드 미연결)
        </div>
        <div class="flex gap-2">
          <button
            @click="goBack"
            class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition"
          >결정 화면으로</button>
          <button
            @click="goDashboard"
            class="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-black transition"
          >대시보드</button>
        </div>
      </div>
    </div>
  </div>
</template>
