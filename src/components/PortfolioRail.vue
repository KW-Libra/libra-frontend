<script setup lang="ts">
import type { HoldingView } from "../view-model";

defineProps<{
  holdings: HoldingView[];
  totalValueLabel: string;
  marketImage: string;
  notice: string;
}>();

function formatKrw(value: number | null | undefined) {
  if (value == null) return "-";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
</script>

<template>
  <aside id="portfolio" class="rail">
    <section class="panel portfolio-panel">
      <div class="section-title">
        <span class="title-glyph">₩</span>
        <div>
          <span>Current Portfolio</span>
          <h2>보유 종목</h2>
        </div>
      </div>
      <div class="total-value">{{ totalValueLabel }}원</div>
      <p v-if="notice" class="portfolio-notice">{{ notice }}</p>
      <div class="portfolio-bars">
        <div v-for="holding in holdings" :key="holding.ticker" class="portfolio-bar">
          <span>{{ holding.name }}</span>
          <strong :style="{ width: percent(holding.weight) }"></strong>
        </div>
      </div>
      <ul class="holding-list">
        <li v-for="holding in holdings" :key="holding.ticker">
          <div>
            <strong>{{ holding.name }}</strong>
            <span>{{ holding.ticker }}</span>
          </div>
          <div class="holding-number">
            <strong>{{ percent(holding.weight) }}</strong>
            <span :class="{ negative: (holding.pnl ?? 0) < 0 }">{{ formatKrw(holding.pnl) }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section class="panel market-panel">
      <img :src="marketImage" alt="실시간 시장 차트" />
      <div>
        <span>Market Context</span>
        <strong>가격 반응은 약하지만 방향성이 확정되지 않았습니다.</strong>
      </div>
      <svg class="mini-chart" viewBox="0 0 220 70" role="img" aria-label="시장 반응 선">
        <polyline class="mini-chart-line" points="0,25 44,42 88,35 132,48 176,37 220,39" stroke-width="4" />
        <line class="mini-chart-base" x1="0" y1="40" x2="220" y2="40" stroke-dasharray="4 6" />
      </svg>
    </section>
  </aside>
</template>
