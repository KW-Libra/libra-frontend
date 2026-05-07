<script setup lang="ts">
import { computed } from "vue";

import type { HoldingView } from "../../view-model";

const props = withDefaults(
  defineProps<{
    holdings: HoldingView[];
    /** Total portfolio value for percent labels */
    totalValue?: number | null;
  }>(),
  {
    totalValue: null,
  },
);

type Cell = {
  ticker: string;
  name: string;
  weight: number;
  pnl: number;
  pnlPct: number;
  pnlTone: "pos" | "neg" | "neutral";
  flexBasis: number; // 0..100, sums to 100 across cells in row
  rowHeight: number; // px
};

type Row = {
  rowHeight: number;
  cells: Cell[];
};

/**
 * Squarified-ish layout: greedy 2-row treemap. Heaviest holdings get full-width
 * row, smaller ones share. Keeps cell aspect ratios from going extreme.
 */
const rows = computed<Row[]>(() => {
  if (!props.holdings.length) return [];
  const sorted = [...props.holdings].sort((a, b) => b.weight - a.weight);
  const totalWeight = sorted.reduce((s, h) => s + h.weight, 0) || 1;

  // Distribute into rows by chunks of weight share. Largest goes alone if dominant.
  const result: Row[] = [];
  let queue = [...sorted];
  while (queue.length) {
    const head = queue[0];
    const headShare = head.weight / totalWeight;

    let take: HoldingView[];
    if (headShare >= 0.45) {
      // dominant -> full row alone
      take = queue.splice(0, 1);
    } else if (queue.length <= 2) {
      take = queue.splice(0, queue.length);
    } else {
      // Side panels are narrow, so pair cells instead of squeezing three tickers.
      const candidates = Math.min(2, queue.length);
      take = queue.splice(0, candidates);
    }

    const rowWeight = take.reduce((s, h) => s + h.weight, 0) || 1;
    const rowShare = rowWeight / totalWeight;
    const cells: Cell[] = take.map((h) => {
      const flex = (h.weight / rowWeight) * 100;
      const pnl = h.pnl ?? 0;
      const value = h.value ?? 0;
      const pnlPct = value ? (pnl / value) * 100 : 0;
      return {
        ticker: h.ticker,
        name: h.name,
        weight: h.weight,
        pnl,
        pnlPct,
        pnlTone: pnl > 0 ? "pos" : pnl < 0 ? "neg" : "neutral",
        flexBasis: flex,
        rowHeight: 0, // assigned below
      };
    });

    // row height proportional to row's weight share
    const minH = 64;
    const maxH = 180;
    const rowHeight = Math.max(minH, Math.min(maxH, Math.round(rowShare * 320)));
    cells.forEach((cell) => (cell.rowHeight = rowHeight));
    result.push({ rowHeight, cells });
  }

  return result;
});

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function pnlSign(pnl: number) {
  if (pnl === 0) return "";
  return pnl > 0 ? "↑" : "↓";
}

function pnlPctLabel(pct: number) {
  if (Math.abs(pct) < 0.01) return "0.0%";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

const emptyState = computed(() => !props.holdings.length);
</script>

<template>
  <figure class="cells-figure" aria-label="Portfolio allocation">
    <figcaption>
      <span class="cells-eyebrow">Allocation · {{ holdings.length }} holdings</span>
      <span v-if="totalValue" class="cells-meta">
        {{ totalValue.toLocaleString("ko-KR") }} 원
      </span>
    </figcaption>

    <div v-if="emptyState" class="cells-empty">
      KIS 동기화 후 보유 종목이 셀로 표시됩니다.
    </div>

    <div v-else class="cells-stack">
      <div
        v-for="(row, rIdx) in rows"
        :key="`row-${rIdx}`"
        class="cells-row"
        :style="{ height: `${row.rowHeight}px` }"
      >
        <article
          v-for="(cell, cIdx) in row.cells"
          :key="`${rIdx}-${cIdx}-${cell.ticker}`"
          class="cell"
          :data-tone="cell.pnlTone"
          :style="{ flexBasis: `${cell.flexBasis}%` }"
        >
          <header>
            <strong class="cell-ticker">{{ cell.ticker }}</strong>
            <span class="cell-weight">{{ percent(cell.weight) }}</span>
          </header>
          <span class="cell-name">{{ cell.name }}</span>
          <footer>
            <span class="cell-pnl" :data-tone="cell.pnlTone">
              {{ pnlSign(cell.pnl) }} {{ pnlPctLabel(cell.pnlPct) }}
            </span>
          </footer>
        </article>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.cells-figure {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}
.cells-figure figcaption {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.cells-eyebrow {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.cells-meta {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
}
.cells-empty {
  border: 1px dashed var(--rule-strong);
  color: var(--ink-3);
  font-size: 12px;
  padding: 32px 18px;
  text-align: center;
}

.cells-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cells-row {
  display: flex;
  gap: 4px;
}
.cell {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  overflow: hidden;
  padding: 12px 14px;
  position: relative;
  transition: border-color 180ms ease, transform 180ms ease, background 180ms ease;
}
.cell:hover {
  background: var(--paper-3);
  border-color: var(--rule-strong);
  transform: translateY(-1px);
  z-index: 1;
}
.cell::before {
  content: "";
  height: 3px;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}
.cell[data-tone="pos"]::before {
  background: var(--pos);
}
.cell[data-tone="neg"]::before {
  background: var(--neg);
}
.cell[data-tone="neutral"]::before {
  background: var(--ink-3);
}
/* Shimmer sweep on the top color bar — subtle so daily users won't tire of it */
.cell::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 100%
  );
  content: "";
  height: 3px;
  left: 0;
  mix-blend-mode: overlay;
  pointer-events: none;
  position: absolute;
  top: 0;
  transform: translateX(-100%);
  width: 30%;
  animation: cell-shimmer 9s ease-in-out infinite;
}
.cell:nth-of-type(2)::after { animation-delay: -1.4s; }
.cell:nth-of-type(3)::after { animation-delay: -2.8s; }
.cell:nth-of-type(4)::after { animation-delay: -4.2s; }
.cell:nth-of-type(5)::after { animation-delay: -5.6s; }
.cell:nth-of-type(6)::after { animation-delay: -7.0s; }
@keyframes cell-shimmer {
  0%, 86% { transform: translateX(-100%); opacity: 0; }
  90% { opacity: 1; }
  100% { transform: translateX(420%); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .cell::after { animation: none; opacity: 0; }
  .cell:hover { transform: none; }
}
.cell header {
  align-items: baseline;
  display: flex;
  gap: 6px;
  justify-content: space-between;
  min-width: 0;
}
.cell-ticker {
  color: var(--ink);
  font-family: "JetBrains Mono", monospace;
  font-feature-settings: "tnum";
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-weight {
  color: var(--ink-2);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.cell-name {
  color: var(--ink-2);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell footer {
  display: flex;
  justify-content: flex-end;
}
.cell-pnl {
  font-family: "JetBrains Mono", monospace;
  font-feature-settings: "tnum";
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.cell-pnl[data-tone="pos"] {
  color: var(--pos);
}
.cell-pnl[data-tone="neg"] {
  color: var(--neg);
}
.cell-pnl[data-tone="neutral"] {
  color: var(--ink-3);
}
</style>
