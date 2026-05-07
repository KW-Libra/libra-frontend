<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  /** Map of ticker -> delta weight, e.g. { "005930": 0.05, "000660": -0.03 } */
  plan: Record<string, number>;
  /** Optional ticker -> name dictionary for nicer labels */
  names?: Record<string, string>;
}>();

type Row = {
  ticker: string;
  name: string;
  delta: number;
  side: "buy" | "sell";
  /** Absolute delta as % of biggest abs(delta) — for bar width 0..1 */
  scale: number;
};

const rows = computed<Row[]>(() => {
  const entries = Object.entries(props.plan ?? {})
    .map(([ticker, weight]) => ({ ticker, weight: Number(weight) }))
    .filter((row) => Number.isFinite(row.weight))
    .sort((a, b) => b.weight - a.weight);

  if (!entries.length) return [];

  const max = Math.max(...entries.map((entry) => Math.abs(entry.weight))) || 1;
  return entries.map((entry) => ({
    ticker: entry.ticker,
    name: props.names?.[entry.ticker] ?? entry.ticker,
    delta: entry.weight,
    side: entry.weight >= 0 ? "buy" : "sell",
    scale: Math.abs(entry.weight) / max,
  }));
});

const buyCount = computed(() => rows.value.filter((r) => r.side === "buy").length);
const sellCount = computed(() => rows.value.filter((r) => r.side === "sell").length);

function deltaLabel(delta: number) {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(1)}%`;
}
</script>

<template>
  <figure class="plan-figure" aria-label="Candidate rebalance plan">
    <figcaption>
      <span class="plan-eyebrow">Candidate plan · {{ rows.length }} rows</span>
      <span class="plan-meta">
        <span class="plan-meta-buy">{{ buyCount }} buy</span>
        <span class="plan-meta-sep">·</span>
        <span class="plan-meta-sell">{{ sellCount }} sell</span>
      </span>
    </figcaption>

    <div v-if="!rows.length" class="plan-empty">
      이 판단에는 리밸런싱 후보 비중이 없습니다.
    </div>

    <div v-else class="plan-rows">
      <div v-for="row in rows" :key="row.ticker" class="plan-row" :data-side="row.side">
        <span class="plan-ticker">{{ row.ticker }}</span>
        <span class="plan-name">{{ row.name }}</span>
        <span class="plan-delta" :data-side="row.side">{{ deltaLabel(row.delta) }}</span>

        <div class="plan-track" aria-hidden="true">
          <div class="plan-axis"></div>
          <div
            v-if="row.side === 'sell'"
            class="plan-bar plan-bar-sell"
            :style="{ width: `${row.scale * 50}%` }"
          ></div>
          <div
            v-if="row.side === 'buy'"
            class="plan-bar plan-bar-buy"
            :style="{ width: `${row.scale * 50}%` }"
          ></div>
        </div>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.plan-figure {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: normal;
  word-break: normal;
}
.plan-figure figcaption {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}
.plan-eyebrow {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.plan-meta {
  color: var(--ink-3);
  display: inline-flex;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  gap: 6px;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
.plan-meta-buy {
  color: var(--pos);
}
.plan-meta-sell {
  color: var(--neg);
}
.plan-meta-sep {
  color: var(--ink-3);
}

.plan-empty {
  border: 1px dashed var(--rule-strong);
  color: var(--ink-3);
  font-size: 12px;
  padding: 32px 18px;
  text-align: center;
}

.plan-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plan-row {
  align-items: center;
  display: grid;
  gap: 6px 10px;
  grid-template-columns: 64px minmax(0, 1fr) 58px;
  min-width: 0;
  padding: 6px 6px;
  margin: 0 -6px;
  transition: background 180ms ease;
}
.plan-row:hover {
  background: var(--paper-2);
}
.plan-ticker {
  color: var(--ink);
  font-family: "JetBrains Mono", monospace;
  font-feature-settings: "tnum";
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  min-width: 0;
  white-space: nowrap;
}
.plan-name {
  color: var(--ink-2);
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-track {
  background: linear-gradient(
    to right,
    transparent 0,
    transparent calc(50% - 0.5px),
    var(--rule-strong) calc(50% - 0.5px),
    var(--rule-strong) calc(50% + 0.5px),
    transparent calc(50% + 0.5px),
    transparent 100%
  );
  height: 18px;
  grid-column: 1 / -1;
  min-width: 0;
  position: relative;
}
.plan-axis {
  display: none;
}
.plan-bar {
  height: 100%;
  position: absolute;
  top: 0;
  animation: plan-bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  transform-origin: var(--plan-origin, center);
  transform: scaleX(0);
}
@keyframes plan-bar-grow {
  to { transform: scaleX(1); }
}
.plan-bar-sell {
  background: var(--neg);
  right: 50%;
  --plan-origin: right;
}
.plan-bar-buy {
  background: var(--pos);
  left: 50%;
  --plan-origin: left;
}
.plan-rows .plan-row:nth-child(1) .plan-bar { animation-delay: 0.05s; }
.plan-rows .plan-row:nth-child(2) .plan-bar { animation-delay: 0.10s; }
.plan-rows .plan-row:nth-child(3) .plan-bar { animation-delay: 0.15s; }
.plan-rows .plan-row:nth-child(4) .plan-bar { animation-delay: 0.20s; }
.plan-rows .plan-row:nth-child(5) .plan-bar { animation-delay: 0.25s; }
.plan-rows .plan-row:nth-child(6) .plan-bar { animation-delay: 0.30s; }
.plan-rows .plan-row:nth-child(7) .plan-bar { animation-delay: 0.35s; }
.plan-rows .plan-row:nth-child(8) .plan-bar { animation-delay: 0.40s; }
@media (prefers-reduced-motion: reduce) {
  .plan-bar {
    animation: none;
    transform: scaleX(1);
  }
  .plan-row:hover {
    background: transparent;
  }
}
.plan-delta {
  font-family: "JetBrains Mono", monospace;
  font-feature-settings: "tnum";
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
.plan-delta[data-side="buy"] {
  color: var(--pos);
}
.plan-delta[data-side="sell"] {
  color: var(--neg);
}
</style>
