<script setup lang="ts">
/**
 * src/pages/design/RunScreenDesign.vue
 *
 * 의사결정 화면 시안 v2 — §7.2 FOMC 시나리오.
 *
 * v2 개선:
 * - 헤더에 트리거 배지, 진행 단계 stepper, 포트폴리오 컨텍스트
 * - 카드에 summary 항상 표시, role 배지, hover lift, delta 화살표
 * - 합의 점수를 스케일 + 마커로 시각화
 * - 옵션 카드에 위험 라벨, 예상 변동성 메트릭
 */

import { ref, computed } from 'vue'
import {
  scenarioFomc,
  type AgentSpeech,
  type DeltaFromRound1,
} from '@/mocks/scenarioFomc'

const expandedAgent = ref<string | null>(null)
const expandedOption = ref<string | null>(null)

const coreSpeeches = computed(() =>
  scenarioFomc.speeches.filter((s) => s.committee === 'CORE')
)
const domainSpeeches = computed(() =>
  scenarioFomc.speeches.filter((s) => s.committee === 'DOMAIN')
)

const opinionCount = computed(
  () => scenarioFomc.speeches.filter((s) => s.role === 'opinion').length
)
const informationalCount = computed(
  () => scenarioFomc.speeches.filter((s) => s.role === 'informational').length
)

function toggleAgent(agent: string) {
  expandedAgent.value = expandedAgent.value === agent ? null : agent
}

function toggleOption(id: string) {
  expandedOption.value = expandedOption.value === id ? null : id
}

function magnitudeBarWidth(magnitude: number): number {
  const MAX = 10
  return Math.min(100, (Math.abs(magnitude) / MAX) * 100)
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
  // 0~1을 5단계 도트로 표현
  const filled = Math.round(confidence * 5)
  return [0, 1, 2, 3, 4].map((i) => i < filled)
}

function isSupporting(speech: AgentSpeech): boolean {
  if (!expandedOption.value) return false
  const option = scenarioFomc.options.find(
    (o) => o.id === expandedOption.value
  )
  return option?.supportingAgents.includes(speech.agent) ?? false
}

function findSpeech(agent: string): AgentSpeech | undefined {
  return scenarioFomc.speeches.find((s) => s.agent === agent)
}

const expandedAgentSpeech = computed(() =>
  expandedAgent.value ? findSpeech(expandedAgent.value) : null
)

const expandedOptionData = computed(() =>
  expandedOption.value
    ? scenarioFomc.options.find((o) => o.id === expandedOption.value)
    : null
)

// 합의 점수 스케일 (-1.0 ~ +1.0을 0%~100%로 매핑)
function scorePercent(score: number): number {
  return ((score + 1) / 2) * 100
}

// 시간 포맷
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function formatKrw(n: number): string {
  return '₩' + n.toLocaleString('ko-KR')
}
function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// 옵션 tone → 색상 클래스
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
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div class="max-w-6xl mx-auto px-8 py-12">
      <!-- ================================================================ -->
      <!-- 헤더 -->
      <!-- ================================================================ -->
      <div class="mb-10">
        <!-- 트리거 배지 + 메타 -->
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              PUSH · {{ scenarioFomc.triggerMeta.label }}
            </span>
            <span class="text-xs text-gray-400 font-mono">{{
              scenarioFomc.threadId
            }}</span>
          </div>
          <div class="text-xs text-gray-400">
            {{ formatDate(scenarioFomc.completedAt) }}
            {{ formatTime(scenarioFomc.completedAt) }} ·
            <span class="font-medium text-gray-600">{{ scenarioFomc.durationSeconds }}s</span>
          </div>
        </div>

        <h1 class="text-3xl font-medium tracking-tight text-gray-900 mb-2">
          리밸런싱 검토 요청
        </h1>
        <p class="text-sm text-gray-600 mb-5 leading-relaxed">
          {{ scenarioFomc.triggerMeta.description }} —
          {{ scenarioFomc.query }}
        </p>

        <!-- 포트폴리오 컨텍스트 -->
        <div class="flex items-center gap-6 text-xs">
          <div>
            <span class="text-gray-400">포트폴리오</span>
            <span class="ml-1.5 font-medium text-gray-800">{{
              scenarioFomc.context.portfolioName
            }}</span>
          </div>
          <div class="h-3 w-px bg-gray-200"></div>
          <div>
            <span class="text-gray-400">평가액</span>
            <span class="ml-1.5 font-medium text-gray-800 font-mono">{{
              formatKrw(scenarioFomc.context.currentValueKrw)
            }}</span>
          </div>
          <div class="h-3 w-px bg-gray-200"></div>
          <div class="flex items-center gap-2">
            <span class="text-gray-400">대상 자산</span>
            <span
              v-for="a in scenarioFomc.context.affectedAssets"
              :key="a.ticker"
              class="px-2 py-0.5 bg-white border border-gray-200 rounded font-mono text-[11px] text-gray-700"
            >
              {{ a.ticker }} · {{ a.name }}
            </span>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 진행 단계 stepper -->
      <!-- ================================================================ -->
      <div class="mb-10 p-5 bg-white border border-gray-200 rounded-lg">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-medium tracking-wider text-gray-500">진행 단계</span>
          <span class="text-xs text-gray-400">
            모든 단계 완료 · 총 {{ scenarioFomc.durationSeconds }}초
          </span>
        </div>
        <div class="relative">
          <!-- 연결선 -->
          <div
            class="absolute top-3 left-3 right-3 h-px bg-gray-200"
            aria-hidden="true"
          ></div>
          <div
            class="absolute top-3 left-3 h-px bg-emerald-500"
            :style="{
              width: `calc(${
                ((scenarioFomc.stages.filter((s) => s.completed).length - 1) /
                  (scenarioFomc.stages.length - 1)) *
                100
              }% - 12px)`,
            }"
            aria-hidden="true"
          ></div>

          <!-- 단계 -->
          <div class="relative flex justify-between">
            <div
              v-for="stage in scenarioFomc.stages"
              :key="stage.name"
              class="flex flex-col items-center"
              style="width: 80px;"
            >
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center"
                :class="
                  stage.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                "
              >
                <svg
                  v-if="stage.completed"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="mt-2 text-xs font-medium text-gray-700">
                {{ stage.label }}
              </div>
              <div class="text-[10px] text-gray-400 font-mono mt-0.5">
                {{ formatDurationMs(stage.durationMs) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Compliance 띠 -->
      <!-- ================================================================ -->
      <div
        class="flex items-stretch mb-10 bg-white border border-amber-200 rounded-lg overflow-hidden"
      >
        <div class="w-1 bg-amber-400"></div>
        <div class="flex-1 flex items-center gap-3 p-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span class="text-xs font-medium tracking-wider text-amber-700">WARNING</span>
          </div>
          <div class="h-4 w-px bg-amber-200"></div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">
              {{ scenarioFomc.compliance.title }}
            </div>
            <div class="text-xs text-gray-600 mt-0.5">
              {{ scenarioFomc.compliance.detail }}
            </div>
          </div>
          <div class="text-[10px] text-gray-400 font-mono">
            {{ scenarioFomc.compliance.ruleId }}
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Core 위원회 -->
      <!-- ================================================================ -->
      <div class="mb-8">
        <div class="flex items-baseline justify-between mb-4">
          <div class="flex items-baseline gap-3">
            <span class="text-xs font-medium tracking-[0.15em] text-gray-700"
              >CORE 위원회</span
            >
            <span class="text-xs text-gray-400">
              5명 · 시장·기회 관점
            </span>
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
              isSupporting(speech)
                ? 'ring-2 ring-blue-400 ring-offset-1'
                : '',
              expandedAgent === speech.agent
                ? 'ring-2 ring-gray-700 ring-offset-1'
                : '',
            ]"
            @click="toggleAgent(speech.agent)"
          >
            <!-- 카드 헤더: 이름 + role 배지 -->
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium" :class="cardLabelText(speech)">
                {{ speech.agent }}
              </span>
              <span
                class="text-[9px] tracking-wider px-1 py-0.5 rounded font-medium"
                :class="
                  speech.role === 'informational'
                    ? 'text-gray-400 bg-gray-100'
                    : 'text-gray-500 bg-white/60'
                "
              >
                {{ speech.role === 'informational' ? '정보' : '의견' }}
              </span>
            </div>

            <!-- magnitude 큰 글씨 -->
            <div
              class="text-xl font-semibold mb-2"
              :class="cardAccentText(speech)"
            >
              <template v-if="speech.role === 'informational'">—</template>
              <template v-else-if="speech.direction === 'HOLD'">HOLD</template>
              <template v-else>
                {{ speech.magnitude > 0 ? '+' : '' }}{{ speech.magnitude }}%
              </template>
            </div>

            <!-- 강도 막대 -->
            <div
              v-if="speech.role === 'opinion' && speech.direction !== 'HOLD'"
              class="h-1 mb-2 bg-white/60 rounded-full overflow-hidden"
            >
              <div
                class="h-full"
                :class="barColorClass(speech)"
                :style="{ width: `${magnitudeBarWidth(speech.magnitude)}%` }"
              ></div>
            </div>
            <div v-else class="h-1 mb-2"></div>

            <!-- summary 한 줄 -->
            <div
              class="text-[11px] mb-2 leading-snug"
              :class="cardAccentText(speech)"
            >
              {{ speech.summary }}
            </div>

            <!-- 카드 푸터: confidence + delta -->
            <div class="flex items-center justify-between">
              <div v-if="speech.role === 'opinion'" class="flex items-center gap-0.5">
                <span
                  v-for="(dot, i) in confidenceDots(speech.confidence)"
                  :key="i"
                  class="w-1 h-1 rounded-full"
                  :class="
                    dot ? cardAccentText(speech).replace('text-', 'bg-') : 'bg-gray-200'
                  "
                ></span>
              </div>
              <div v-else></div>

              <span
                v-if="speech.deltaFromRound1 && speech.role === 'opinion'"
                class="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                :class="deltaClass(speech.deltaFromRound1)"
              >
                {{ deltaSymbol(speech.deltaFromRound1) }}
                {{ deltaText(speech.deltaFromRound1) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Domain 위원회 -->
      <!-- ================================================================ -->
      <div class="mb-6">
        <div class="flex items-baseline justify-between mb-4">
          <div class="flex items-baseline gap-3">
            <span class="text-xs font-medium tracking-[0.15em] text-gray-700"
              >DOMAIN 위원회</span
            >
            <span class="text-xs text-gray-400">
              6명 · 안전·제약 관점
            </span>
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
              isSupporting(speech)
                ? 'ring-2 ring-blue-400 ring-offset-1'
                : '',
              expandedAgent === speech.agent
                ? 'ring-2 ring-gray-700 ring-offset-1'
                : '',
            ]"
            @click="toggleAgent(speech.agent)"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium" :class="cardLabelText(speech)">
                {{ speech.agent }}
              </span>
              <span
                class="text-[9px] tracking-wider px-1 py-0.5 rounded font-medium"
                :class="
                  speech.role === 'informational'
                    ? 'text-gray-400 bg-gray-100'
                    : 'text-gray-500 bg-white/60'
                "
              >
                {{ speech.role === 'informational' ? '정보' : '의견' }}
              </span>
            </div>

            <div
              class="text-xl font-semibold mb-2"
              :class="cardAccentText(speech)"
            >
              <template v-if="speech.role === 'informational'">—</template>
              <template v-else-if="speech.direction === 'HOLD'">HOLD</template>
              <template v-else>
                {{ speech.magnitude > 0 ? '+' : '' }}{{ speech.magnitude }}%
              </template>
            </div>

            <div
              v-if="speech.role === 'opinion' && speech.direction !== 'HOLD'"
              class="h-1 mb-2 bg-white/60 rounded-full overflow-hidden"
            >
              <div
                class="h-full"
                :class="barColorClass(speech)"
                :style="{ width: `${magnitudeBarWidth(speech.magnitude)}%` }"
              ></div>
            </div>
            <div v-else class="h-1 mb-2"></div>

            <div
              class="text-[11px] mb-2 leading-snug"
              :class="cardAccentText(speech)"
            >
              {{ speech.summary }}
            </div>

            <div class="flex items-center justify-between">
              <div v-if="speech.role === 'opinion'" class="flex items-center gap-0.5">
                <span
                  v-for="(dot, i) in confidenceDots(speech.confidence)"
                  :key="i"
                  class="w-1 h-1 rounded-full"
                  :class="
                    dot ? cardAccentText(speech).replace('text-', 'bg-') : 'bg-gray-200'
                  "
                ></span>
              </div>
              <div v-else></div>

              <span
                v-if="speech.deltaFromRound1 && speech.role === 'opinion'"
                class="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                :class="deltaClass(speech.deltaFromRound1)"
              >
                {{ deltaSymbol(speech.deltaFromRound1) }}
                {{ deltaText(speech.deltaFromRound1) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 카운트 -->
        <div class="mt-3 text-[11px] text-gray-400">
          의견 {{ opinionCount }}명 · 정보 {{ informationalCount }}명 · 카드 클릭으로 상세 확인
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 위원회 카드 펼침 영역 -->
      <!-- ================================================================ -->
      <div
        v-if="expandedAgentSpeech"
        class="mb-10 p-5 bg-white rounded-lg border border-gray-200"
      >
        <div class="flex items-start gap-4">
          <div class="text-xs font-medium text-gray-400 tracking-wider pt-0.5 w-24 flex-shrink-0">
            {{ expandedAgentSpeech.committee }} · {{ expandedAgentSpeech.agent }}
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900 mb-1">
              {{ expandedAgentSpeech.summary }}
            </div>
            <div class="text-sm text-gray-600 leading-relaxed">
              {{ expandedAgentSpeech.reasoning }}
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 합의 점수 시각화 -->
      <!-- ================================================================ -->
      <div class="mb-10 p-6 bg-white border border-gray-200 rounded-lg">
        <div class="flex items-baseline justify-between mb-5">
          <div>
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">
              합의 점수
            </div>
            <div class="text-2xl font-semibold text-gray-900 font-mono">
              {{ scenarioFomc.consensus.round2 }}
              <span class="text-sm font-normal text-gray-400 ml-2">
                R1 {{ scenarioFomc.consensus.round1 }}
              </span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">
              분기
            </div>
            <div
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-red-700 bg-red-50 border border-red-200"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {{ scenarioFomc.consensus.branch }}
            </div>
          </div>
        </div>

        <!-- 스케일 -->
        <div class="relative">
          <!-- 구간 배경 -->
          <div class="relative h-2 rounded-full overflow-hidden flex">
            <div class="bg-red-200" style="width: 20%"></div>
            <div class="bg-red-100" style="width: 15%"></div>
            <div class="bg-gray-200" style="width: 30%"></div>
            <div class="bg-emerald-100" style="width: 15%"></div>
            <div class="bg-emerald-200" style="width: 20%"></div>
          </div>

          <!-- R1 마커 -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-400"
            :style="{ left: `calc(${scorePercent(scenarioFomc.consensus.round1)}% - 6px)` }"
          ></div>
          <!-- R2 마커 -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gray-900 border-2 border-white shadow"
            :style="{ left: `calc(${scorePercent(scenarioFomc.consensus.round2)}% - 7px)` }"
          ></div>
        </div>

        <!-- 라벨 -->
        <div class="flex justify-between mt-3 text-[10px] text-gray-400 font-mono">
          <span>-1.0</span>
          <span>STRONG ↓</span>
          <span>WEAK ↓</span>
          <span>CONFLICT</span>
          <span>WEAK ↑</span>
          <span>STRONG ↑</span>
          <span>+1.0</span>
        </div>

        <!-- 변화 설명 -->
        <div class="mt-4 flex items-center gap-2 text-xs text-gray-600">
          <span class="w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-400"></span>
          <span class="text-gray-500">R1</span>
          <span class="text-gray-400">→</span>
          <span class="w-3 h-3 rounded-full bg-gray-900"></span>
          <span class="text-gray-700 font-medium">R2</span>
          <span class="text-gray-400 ml-2">
            ·  Round 2에서 -0.08 변동, 충돌 미해소
          </span>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- 결정 영역 -->
      <!-- ================================================================ -->
      <div>
        <div class="mb-5">
          <h2 class="text-lg font-medium text-gray-900 mb-1">결정이 필요합니다</h2>
          <p class="text-sm text-gray-600">
            Round 2 후에도 위원회 의견이 갈렸습니다. 시스템이 결정을 사용자에게
            위임합니다.
          </p>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="option in scenarioFomc.options"
            :key="option.id"
            class="bg-white border border-gray-200 border-l-4 rounded-lg p-5 cursor-pointer transition-all hover:border-gray-400 hover:shadow-md"
            :class="[
              optionToneRing(option.tone),
              expandedOption === option.id
                ? 'ring-2 ring-blue-400 ring-offset-1'
                : '',
            ]"
            @click="toggleOption(option.id)"
          >
            <!-- 헤더: 라벨 + 위험 라벨 -->
            <div class="flex items-start justify-between mb-2">
              <div class="text-base font-medium text-gray-900">
                {{ option.label }}
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded font-medium"
                :class="riskLabelClass(option.riskLabel)"
              >
                위험 {{ option.riskLabel }}
              </span>
            </div>

            <div class="text-xs text-gray-500 mb-4 leading-relaxed">
              {{ option.description }}
            </div>

            <!-- 거래 명세 -->
            <div class="space-y-1 mb-4">
              <div
                v-for="trade in option.trades"
                :key="trade"
                class="text-sm font-mono text-gray-800"
              >
                {{ trade }}
              </div>
            </div>

            <!-- 메트릭 -->
            <div class="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <div class="text-[10px] text-gray-400 tracking-wider mb-0.5">
                  예상 변동성
                </div>
                <div class="text-sm font-mono text-gray-700">
                  {{ option.estimatedVolatility }}%
                </div>
              </div>
              <div class="text-right">
                <div class="text-[10px] text-gray-400 tracking-wider mb-0.5">
                  지지
                </div>
                <div class="text-xs text-gray-700">
                  {{ option.supportingAgents.join(' · ') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 옵션 펼침: 지지 에이전트 발언 -->
        <div
          v-if="expandedOptionData"
          class="mt-4 p-5 bg-blue-50/50 rounded-lg border border-blue-200"
        >
          <div class="flex items-baseline justify-between mb-3">
            <div class="text-sm font-medium text-gray-900">
              {{ expandedOptionData.label }} —
              <span class="font-normal text-gray-600">{{
                expandedOptionData.description
              }}</span>
            </div>
            <div class="text-[10px] text-gray-400 tracking-wider">
              지지 에이전트 {{ expandedOptionData.supportingAgents.length }}명의
              발언
            </div>
          </div>
          <div class="space-y-3">
            <div
              v-for="agentName in expandedOptionData.supportingAgents"
              :key="agentName"
              class="flex gap-3"
            >
              <div class="text-xs font-medium text-blue-700 w-20 flex-shrink-0 pt-0.5">
                {{ agentName }}
              </div>
              <div class="text-xs text-gray-700 leading-relaxed flex-1">
                {{ findSpeech(agentName)?.reasoning }}
              </div>
            </div>
          </div>
          <div class="text-[11px] text-gray-400 mt-4 italic">
            ※ 위원회 영역에서 이 옵션을 지지한 카드가 파란 ring으로 강조됩니다.
          </div>
        </div>

        <!-- 액션 영역 -->
        <div
          class="mt-8 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
        >
          <div class="text-xs text-gray-500">
            <span class="font-medium text-gray-700">옵션 선택</span>
            은 사용자가 직접 결정합니다 — 시스템은 결정을 대신하지 않습니다.
          </div>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              상세 보고서
            </button>
            <button
              class="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!expandedOption"
            >
              {{
                expandedOption
                  ? `${expandedOptionData?.label} 승인`
                  : '옵션을 선택하세요'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>