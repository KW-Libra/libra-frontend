<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  backtestApi,
  type BacktestStrategyRow,
  type BacktestSummaryCard,
  type BacktestValidation,
} from '@/api/backtestValidation'

const router = useRouter()

const backtest = ref<BacktestValidation | null>(null)
const loading = ref(true)
const error = ref('')

const topEndingValue = computed(() =>
  Math.max(...(backtest.value?.strategies.map((row) => row.endingValueKrw) ?? [0]))
)
const libraStrategy = computed(() =>
  backtest.value?.strategies.find((row) => row.group === 'libra')
)
const decisionRows = computed(() => {
  if (!backtest.value) return []
  const order = ['HOLD', 'DEFER', 'REBALANCE']
  return order.map((decision) => ({
    decision,
    count: backtest.value?.decisionBreakdown[decision] ?? 0,
  }))
})
const maxDecisionCount = computed(() =>
  Math.max(...decisionRows.value.map((row) => row.count), 1)
)
const dateGapRows = computed(() => {
  if (!backtest.value) return []
  const { libraOnlyTradeDates, thresholdOnlyTradeDates } = backtest.value.thresholdEquivalence
  const length = Math.max(libraOnlyTradeDates.length, thresholdOnlyTradeDates.length)
  return Array.from({ length }, (_, index) => ({
    libraOnly: libraOnlyTradeDates[index] ?? '',
    thresholdOnly: thresholdOnlyTradeDates[index] ?? '',
  }))
})
const topAssetReturn = computed(() => {
  if (!backtest.value?.assets.length) return null
  return [...backtest.value.assets].sort((left, right) => right.priceReturnPct - left.priceReturnPct)[0]
})

onMounted(async () => {
  try {
    const response = await backtestApi.publicRss3yValidation()
    backtest.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : '백테스트 API를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

function goDashboard() {
  router.push('/dashboard')
}

function summaryToneClass(card: BacktestSummaryCard): string {
  if (card.tone === 'blue') return 'text-blue-600'
  if (card.tone === 'red') return 'text-red-600'
  return 'text-gray-900'
}

function strategyToneClass(row: BacktestStrategyRow): string {
  if (row.group === 'libra') return 'text-blue-600'
  if (row.gapVsLibraPctPoints > 0) return 'text-gray-900'
  return 'text-gray-500'
}

function strategyBarClass(row: BacktestStrategyRow): string {
  if (row.group === 'libra') return 'bg-blue-500'
  if (row.gapVsLibraPctPoints > 0) return 'bg-gray-800'
  return 'bg-gray-300'
}

function strategyBarWidth(row: BacktestStrategyRow): string {
  if (topEndingValue.value <= 0) return '8%'
  const width = (row.endingValueKrw / topEndingValue.value) * 100
  return `${Math.max(8, width).toFixed(1)}%`
}

function formatKrwEok(value: number): string {
  return `₩${(value / 100_000_000).toFixed(1)}억`
}

function formatKrw(value: number): string {
  return `₩${formatNumber(value)}`
}

function formatKrwMan(value: number): string {
  return `₩${(value / 10_000).toFixed(0)}만`
}

function formatReturn(value: number): string {
  return `${value.toFixed(3)}%`
}

function formatPctPoint(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%p`
}

function formatGap(value: number): string {
  if (value === 0) return '기준'
  return `${value > 0 ? '+' : ''}${value.toFixed(3)}%p`
}

function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR')
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

function decisionBarWidth(count: number): string {
  return `${Math.max(4, (count / maxDecisionCount.value) * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded bg-gray-900 text-white flex items-center justify-center text-sm font-bold">L</div>
          <span class="text-lg font-semibold tracking-tight">Libra</span>
        </div>
        <button
          @click="goDashboard"
          class="text-xs text-gray-600 hover:text-gray-900 transition"
        >대시보드</button>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-8 py-10">
      <section class="mb-8">
        <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">BACKTESTING</div>
        <h1 class="text-2xl font-medium tracking-tight mb-2">LIBRA 3년 백테스트</h1>
        <p class="text-sm text-gray-600">
          public-rss-3y 풀런 산출물 기준으로 LIBRA와 기계적 기준선을 비교합니다.
        </p>
      </section>

      <section v-if="loading" class="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
        백테스트 산출물을 불러오는 중입니다.
      </section>

      <section v-else-if="error" class="bg-white border border-red-200 rounded-lg p-6 text-sm text-red-600">
        <div class="font-medium mb-2">백테스트 API가 연결되지 않았습니다</div>
        <div class="text-red-500">{{ error }}</div>
        <div class="mt-3 text-xs text-gray-500">
          운영에서는 백엔드가 <span class="font-mono">GET /api/backtests/public-rss-3y/validation</span>
          응답을 제공해야 합니다.
        </div>
      </section>

      <template v-else-if="backtest">
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between gap-4 mb-5">
              <div>
                <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">검증 결론</div>
                <h2 class="text-lg font-medium text-gray-900">{{ backtest.headline }}</h2>
              </div>
              <div class="text-right text-xs text-gray-400">{{ backtest.period }}</div>
            </div>
            <p class="text-sm text-gray-600 leading-relaxed">{{ backtest.subtext }}</p>
          </div>

          <div class="bg-gray-900 text-white rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-400 mb-2">LIBRA return</div>
            <div class="text-3xl font-semibold font-mono mb-2">
              {{ libraStrategy ? formatReturn(libraStrategy.totalReturnPct) : '-' }}
            </div>
            <div class="text-xs text-gray-400">
              {{ backtest.replayDays }} trading days · LLM cost ${{ backtest.llmCostUsd.toFixed(2) }}
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            v-for="card in backtest.summaryCards"
            :key="card.label"
            class="bg-white border border-gray-200 rounded-lg p-5"
          >
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-2">{{ card.label }}</div>
            <div class="text-2xl font-semibold font-mono" :class="summaryToneClass(card)">
              {{ card.value }}
            </div>
            <div class="text-xs text-gray-400 mt-2 leading-relaxed">{{ card.caption }}</div>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between gap-4 mb-5">
              <div>
                <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">실험 설정</div>
                <h2 class="text-lg font-medium text-gray-900">동일 fixture 기준 비교</h2>
              </div>
              <div class="text-right text-xs text-gray-400">{{ backtest.assumptions.assetCount }} assets</div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div class="text-xs text-gray-500 mb-1">초기 자산</div>
                <div class="text-base font-semibold font-mono text-gray-900">{{ formatKrwEok(backtest.assumptions.initialValueKrw) }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">거래비용</div>
                <div class="text-base font-semibold font-mono text-gray-900">{{ backtest.assumptions.transactionCostBp }}bp</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Threshold</div>
                <div class="text-base font-semibold font-mono text-gray-900">{{ backtest.assumptions.thresholdBandPct.toFixed(1) }}%</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Risk parity lookback</div>
                <div class="text-base font-semibold font-mono text-gray-900">{{ backtest.assumptions.riskParityLookbackDays }}일</div>
              </div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">가격 구간 리더</div>
            <template v-if="topAssetReturn">
              <div class="text-lg font-medium text-gray-900">{{ topAssetReturn.name }}</div>
              <div class="text-3xl font-semibold font-mono text-blue-600 mt-2">
                {{ formatReturn(topAssetReturn.priceReturnPct) }}
              </div>
              <div class="text-xs text-gray-400 mt-2">
                {{ formatKrw(topAssetReturn.startPrice) }} -> {{ formatKrw(topAssetReturn.endPrice) }}
              </div>
            </template>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-5">Universe / 목표 비중</div>
            <div class="space-y-4">
              <div
                v-for="asset in backtest.assets"
                :key="asset.ticker"
              >
                <div class="flex items-baseline justify-between gap-3 mb-2">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ asset.name }}</div>
                    <div class="text-xs text-gray-400 font-mono">{{ asset.ticker }}</div>
                  </div>
                  <div class="text-sm font-semibold font-mono text-gray-900">{{ asset.targetWeightPct.toFixed(1) }}%</div>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-gray-800 rounded-full" :style="{ width: `${asset.targetWeightPct}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-5">구간 가격 수익률</div>
            <table class="w-full min-w-[480px] text-xs">
              <thead>
                <tr class="text-left text-gray-400">
                  <th class="font-medium pb-3">Asset</th>
                  <th class="font-medium pb-3 text-right">Start</th>
                  <th class="font-medium pb-3 text-right">End</th>
                  <th class="font-medium pb-3 text-right">Return</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="asset in backtest.assets"
                  :key="`price-${asset.ticker}`"
                  class="border-t border-gray-100"
                >
                  <td class="py-3">
                    <div class="font-medium text-gray-900">{{ asset.name }}</div>
                    <div class="font-mono text-gray-400">{{ asset.ticker }}</div>
                  </td>
                  <td class="py-3 text-right font-mono text-gray-700">{{ formatKrw(asset.startPrice) }}</td>
                  <td class="py-3 text-right font-mono text-gray-700">{{ formatKrw(asset.endPrice) }}</td>
                  <td
                    class="py-3 text-right font-mono font-semibold"
                    :class="asset.priceReturnPct >= 0 ? 'text-blue-600' : 'text-red-600'"
                  >
                    {{ formatReturn(asset.priceReturnPct) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-5">리플레이 품질</div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-gray-500 mb-1">완료 상태</div>
                <div class="text-lg font-semibold" :class="backtest.audit.complete ? 'text-blue-600' : 'text-red-600'">
                  {{ backtest.audit.complete ? 'Complete' : 'Incomplete' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Fixture 날짜</div>
                <div class="text-lg font-semibold" :class="backtest.audit.datesMatchFixturePrefix ? 'text-blue-600' : 'text-red-600'">
                  {{ backtest.audit.datesMatchFixturePrefix ? 'Matched' : 'Mismatch' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">오류</div>
                <div class="text-lg font-semibold text-gray-900">
                  {{ backtest.audit.rawErrorCount + backtest.audit.auditErrorCount }}
                </div>
                <div class="text-xs text-gray-400">raw {{ backtest.audit.rawErrorCount }} · audit {{ backtest.audit.auditErrorCount }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Weight sum</div>
                <div class="text-lg font-semibold font-mono text-gray-900">
                  {{ backtest.audit.minWeightSum.toFixed(6) }}-{{ backtest.audit.maxWeightSum.toFixed(6) }}
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-5">LLM 사용량</div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-gray-500 mb-1">Requests</div>
                <div class="text-lg font-semibold font-mono text-gray-900">
                  {{ formatNumber(backtest.cost.requestCount) }}
                </div>
                <div class="text-xs text-gray-400 truncate">{{ backtest.cost.models.join(', ') }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Cost/day</div>
                <div class="text-lg font-semibold font-mono text-gray-900">
                  {{ formatUsd(backtest.cost.costPerReplayDayUsd) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Input tokens</div>
                <div class="text-lg font-semibold font-mono text-gray-900">
                  {{ formatNumber(backtest.cost.inputTokens) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">Output tokens</div>
                <div class="text-lg font-semibold font-mono text-gray-900">
                  {{ formatNumber(backtest.cost.outputTokens) }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-5">판단 분포</div>
            <div class="space-y-4">
              <div
                v-for="row in decisionRows"
                :key="row.decision"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="text-sm font-medium text-gray-900">{{ row.decision }}</div>
                  <div class="text-sm font-semibold font-mono text-gray-900">{{ row.count }}</div>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="row.decision === 'REBALANCE' ? 'bg-blue-500' : 'bg-gray-700'"
                    :style="{ width: decisionBarWidth(row.count) }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <div class="flex items-baseline justify-between mb-5">
              <div class="text-xs font-medium tracking-wider text-gray-500">Threshold 날짜 비교</div>
              <div
                class="text-xs font-medium"
                :class="backtest.thresholdEquivalence.sameTradeDatesAsThresholdBand ? 'text-blue-600' : 'text-red-600'"
              >
                {{ backtest.thresholdEquivalence.sameTradeDatesAsThresholdBand ? 'same dates' : 'different dates' }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div class="text-gray-400 mb-2">LIBRA only</div>
                <div class="space-y-1.5">
                  <div
                    v-for="row in dateGapRows"
                    :key="`libra-${row.libraOnly || row.thresholdOnly}`"
                    class="font-mono text-gray-700 h-5"
                  >
                    {{ row.libraOnly || '-' }}
                  </div>
                </div>
              </div>
              <div>
                <div class="text-gray-400 mb-2">Threshold only</div>
                <div class="space-y-1.5">
                  <div
                    v-for="row in dateGapRows"
                    :key="`threshold-${row.thresholdOnly || row.libraOnly}`"
                    class="font-mono text-gray-700 h-5"
                  >
                    {{ row.thresholdOnly || '-' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-5">전략 순위</div>
            <div class="space-y-4">
              <div
                v-for="row in backtest.strategies"
                :key="row.strategy"
              >
                <div class="flex items-baseline justify-between gap-3 mb-2">
                  <div class="min-w-0">
                    <div class="text-sm font-medium truncate" :class="strategyToneClass(row)">
                      {{ row.strategy }}
                    </div>
                    <div class="text-xs text-gray-400">
                      {{ row.trades }} trades · Sharpe {{ row.sharpe.toFixed(3) }} · MDD {{ row.maxDrawdownPct.toFixed(3) }}%
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="text-sm font-semibold font-mono" :class="strategyToneClass(row)">
                      {{ formatReturn(row.totalReturnPct) }}
                    </div>
                    <div class="text-xs text-gray-400 font-mono">
                      {{ formatGap(row.gapVsLibraPctPoints) }}
                    </div>
                  </div>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="strategyBarClass(row)"
                    :style="{ width: strategyBarWidth(row) }"
                  ></div>
                </div>
                <div class="text-[11px] text-gray-400 font-mono mt-1">
                  {{ formatKrwEok(row.endingValueKrw) }}
                </div>
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-gray-100 overflow-x-auto">
              <table class="w-full min-w-[680px] text-xs">
                <thead>
                  <tr class="text-left text-gray-400">
                    <th class="font-medium pb-3">Strategy</th>
                    <th class="font-medium pb-3 text-right">Ann. return</th>
                    <th class="font-medium pb-3 text-right">Vol</th>
                    <th class="font-medium pb-3 text-right">Turnover</th>
                    <th class="font-medium pb-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in backtest.strategies"
                    :key="`table-${row.strategy}`"
                    class="border-t border-gray-100"
                  >
                    <td class="py-3 font-medium" :class="strategyToneClass(row)">{{ row.strategy }}</td>
                    <td class="py-3 text-right font-mono text-gray-700">{{ formatReturn(row.annualizedReturnPct) }}</td>
                    <td class="py-3 text-right font-mono text-gray-700">{{ formatReturn(row.annualizedVolatilityPct) }}</td>
                    <td class="py-3 text-right font-mono text-gray-700">{{ formatKrwEok(row.turnoverKrw) }}</td>
                    <td class="py-3 text-right font-mono text-gray-700">{{ formatKrwMan(row.transactionCostKrw) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-6">
            <div class="bg-white border border-gray-200 rounded-lg p-5">
              <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">검증 메모</div>
              <ul class="space-y-3">
                <li
                  v-for="finding in backtest.findings"
                  :key="finding"
                  class="flex items-start gap-2.5 text-xs text-gray-700"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></span>
                  <span class="leading-relaxed">{{ finding }}</span>
                </li>
              </ul>
            </div>

            <div class="bg-white border border-gray-200 rounded-lg p-5">
              <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">리밸런싱 로그</div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="date in backtest.rebalanceDates"
                  :key="date"
                  class="px-2.5 py-1 rounded bg-gray-100 text-[11px] font-mono text-gray-700"
                >
                  {{ date }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section class="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <div class="flex items-baseline justify-between gap-4 mb-5">
            <div>
              <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">LIBRA 리밸런싱 후보안</div>
              <h2 class="text-lg font-medium text-gray-900">{{ backtest.rebalancePlans.length }}회 실행</h2>
            </div>
            <div class="text-xs text-gray-400">ticker별 목표 변경 폭</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div
              v-for="plan in backtest.rebalancePlans"
              :key="plan.date"
              class="rounded-lg bg-gray-50 p-4"
            >
              <div class="text-xs font-mono text-gray-500 mb-3">{{ plan.date }}</div>
              <div class="space-y-2">
                <div
                  v-for="change in plan.changes"
                  :key="`${plan.date}-${change.ticker}`"
                  class="flex items-center justify-between gap-3"
                >
                  <div class="text-xs font-mono text-gray-700">{{ change.ticker }}</div>
                  <div
                    class="text-xs font-semibold font-mono"
                    :class="change.deltaPctPoints >= 0 ? 'text-blue-600' : 'text-red-600'"
                  >
                    {{ formatPctPoint(change.deltaPctPoints) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
