<script setup lang="ts">
/**
 * src/components/Metric4DCard.vue
 *
 * 4차원 메트릭의 단일 카드. Libra vs Benchmark 비교 표시.
 *
 * - series가 있으면 인라인 SVG 라인차트(스파크라인)
 * - series가 없으면 가로 막대 비교
 * - WIN/TIE/LOSE 뱃지
 *
 * 외부 차트 라이브러리 의존성 0. 의도적으로 가볍게.
 */

import { computed } from 'vue'
import type { Metric4D, MetricMeta } from '@/types/metrics4d'

const props = defineProps<{
  meta: MetricMeta
  data: Metric4D
  benchmarkName: string
}>()

function fmt(n: number, unit: '%' | 'ratio' | 'count'): string {
  if (unit === '%') return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
  if (unit === 'ratio') return n.toFixed(2)
  return n.toFixed(0)
}

function fmtAbs(n: number, unit: '%' | 'ratio' | 'count'): string {
  // 절대값 표시 (IPS 준수율 등 부호 의미 없는 경우)
  if (unit === '%') return `${n.toFixed(1)}%`
  if (unit === 'ratio') return n.toFixed(2)
  return n.toFixed(0)
}

const isPercent = computed(() => props.data.unit === '%')

const verdictLabel = computed(() => {
  if (props.data.verdict === 'WIN') return '우위'
  if (props.data.verdict === 'LOSE') return '열위'
  return '동률'
})
const verdictClass = computed(() => {
  if (props.data.verdict === 'WIN') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (props.data.verdict === 'LOSE') return 'bg-red-50 text-red-700 ring-red-200'
  return 'bg-gray-50 text-gray-700 ring-gray-200'
})

const libraDisplay = computed(() => fmtAbs(props.data.libra, props.data.unit))
const benchDisplay = computed(() => fmtAbs(props.data.benchmark, props.data.unit))
const deltaDisplay = computed(() => fmt(props.data.delta, props.data.unit))

// ──────────── SVG 라인차트 좌표 계산 ────────────
const CHART_W = 280
const CHART_H = 64
const PAD = 4

const chartPath = computed(() => {
  const s = props.data.series
  if (!s || s.libra.length < 2) return null

  const allY = [...s.libra, ...s.benchmark]
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)
  const rangeY = maxY - minY || 1
  const n = s.libra.length

  const toX = (i: number) => PAD + (i / (n - 1)) * (CHART_W - 2 * PAD)
  const toY = (y: number) => CHART_H - PAD - ((y - minY) / rangeY) * (CHART_H - 2 * PAD)

  const buildPath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`).join(' ')

  return {
    libra: buildPath(s.libra),
    benchmark: buildPath(s.benchmark),
  }
})

// ──────────── 막대 비교 (series 없을 때) ────────────
const barCompare = computed(() => {
  const l = props.data.libra
  const b = props.data.benchmark
  const max = Math.max(Math.abs(l), Math.abs(b), 1)
  return {
    libra: (Math.abs(l) / max) * 100,
    benchmark: (Math.abs(b) / max) * 100,
  }
})
</script>

<template>
  <div class="metric-card">
    <div class="flex items-baseline justify-between mb-1">
      <div>
        <div class="text-sm font-bold text-gray-900">{{ meta.title }}</div>
        <div class="text-[11px] text-gray-500">{{ meta.subtitle }}</div>
      </div>
      <span
        class="text-[10px] font-bold px-2 py-0.5 rounded-full ring-1"
        :class="verdictClass"
      >{{ verdictLabel }}</span>
    </div>

    <!-- 큰 수치 -->
    <div class="mt-2 mb-2">
      <div class="text-2xl font-bold font-mono text-gray-900 leading-none">
        {{ libraDisplay }}
      </div>
      <div class="text-[11px] text-gray-500 mt-1">
        <span class="text-gray-400">vs {{ benchmarkName }}</span>
        <span class="mx-1 text-gray-300">·</span>
        <span class="font-mono">{{ benchDisplay }}</span>
        <span
          class="ml-1.5 font-mono font-medium"
          :class="data.verdict === 'WIN' ? 'text-blue-600' : data.verdict === 'LOSE' ? 'text-red-600' : 'text-gray-500'"
        >({{ deltaDisplay }})</span>
      </div>
    </div>

    <!-- 차트 -->
    <div v-if="chartPath" class="mt-3">
      <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" class="w-full h-14" preserveAspectRatio="none">
        <path
          :d="chartPath.benchmark"
          fill="none"
          stroke="#cbd5e1"
          stroke-width="1.5"
          stroke-dasharray="3 3"
        />
        <path
          :d="chartPath.libra"
          fill="none"
          stroke="#2563eb"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <div class="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
        <span class="flex items-center gap-1">
          <span class="w-2.5 h-0.5 bg-blue-600 rounded"></span>Libra
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2.5 h-px border-t border-dashed border-gray-400"></span>{{ benchmarkName }}
        </span>
      </div>
    </div>

    <!-- series 없을 때: 막대 비교 -->
    <div v-else class="mt-3 space-y-2">
      <div>
        <div class="flex items-baseline justify-between text-[10px] text-gray-500 mb-0.5">
          <span>Libra</span>
          <span class="font-mono">{{ libraDisplay }}</span>
        </div>
        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-blue-600 rounded-full" :style="{ width: `${barCompare.libra}%` }"></div>
        </div>
      </div>
      <div>
        <div class="flex items-baseline justify-between text-[10px] text-gray-500 mb-0.5">
          <span>{{ benchmarkName }}</span>
          <span class="font-mono">{{ benchDisplay }}</span>
        </div>
        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-gray-400 rounded-full" :style="{ width: `${barCompare.benchmark}%` }"></div>
        </div>
      </div>
    </div>

    <div class="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 leading-snug">
      {{ meta.description }}
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
}
</style>
