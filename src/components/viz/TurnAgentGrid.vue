<script setup lang="ts">
import { computed } from "vue";

import type { TimelineStep } from "../../view-model";

const props = defineProps<{
  /** Timeline steps from view-model.buildTimeline */
  timeline: TimelineStep[];
  /** Optionally select the active turn for highlighting */
  activeTurn?: number;
}>();

const AGENT_ROWS = [
  { id: "Judge", glyph: "J" },
  { id: "Disclosure", glyph: "D" },
  { id: "News", glyph: "N" },
  { id: "Report", glyph: "R" },
  { id: "Profit", glyph: "P" },
  { id: "Cost", glyph: "C" },
];

type Cell = {
  agent: string;
  glyph: string;
  turn: number;
  state: "active" | "done" | "muted" | "skip";
  phase?: string;
};

const turns = computed(() => {
  const set = new Set<number>();
  props.timeline.forEach((step) => {
    const num = Number(step.turn.replace(/^T/, ""));
    if (Number.isFinite(num)) set.add(num);
  });
  if (!set.size) [1, 2, 3, 4, 5].forEach((n) => set.add(n));
  return [...set].sort((a, b) => a - b);
});

const cells = computed<Cell[][]>(() => {
  return AGENT_ROWS.map((row) => {
    return turns.value.map((turn) => {
      const step = props.timeline.find(
        (s) => Number(s.turn.replace(/^T/, "")) === turn && s.actor === row.id,
      );
      return {
        agent: row.id,
        glyph: row.glyph,
        turn,
        state: step ? step.state : "skip",
      } satisfies Cell;
    });
  });
});

const gridCols = computed(
  () => `110px repeat(${turns.value.length}, minmax(28px, 1fr))`,
);

function cellTone(state: Cell["state"], turn: number) {
  if (props.activeTurn === turn && state !== "skip") return "active";
  return state;
}
</script>

<template>
  <figure class="grid-figure" aria-label="Turn × agent activation">
    <figcaption>
      <span class="grid-eyebrow">Turn × Agent</span>
      <span class="grid-meta">
        {{ turns.length }} turns · {{ AGENT_ROWS.length }} agents
      </span>
    </figcaption>

    <div class="grid-wrap">
      <!-- Column header: turn numbers -->
      <div class="grid-col-header" :style="{ gridTemplateColumns: gridCols }">
        <span class="grid-corner"></span>
        <span
          v-for="turn in turns"
          :key="`col-${turn}`"
          class="grid-col-label"
          :data-active="activeTurn === turn || undefined"
        >
          T{{ turn }}
        </span>
      </div>

      <!-- Rows -->
      <div class="grid-rows">
        <div
          v-for="(row, rIdx) in cells"
          :key="`row-${rIdx}`"
          class="grid-row"
          :style="{ gridTemplateColumns: gridCols }"
        >
          <span class="grid-row-label">
            <span class="grid-row-glyph">{{ AGENT_ROWS[rIdx].glyph }}</span>
            <span class="grid-row-name">{{ AGENT_ROWS[rIdx].id }}</span>
          </span>
          <span
            v-for="cell in row"
            :key="`cell-${rIdx}-${cell.turn}`"
            class="grid-cell"
            :data-state="cellTone(cell.state, cell.turn)"
          >
            <span v-if="cell.state !== 'skip'" class="grid-cell-mark"></span>
          </span>
        </div>
      </div>

      <!-- Legend -->
      <div class="grid-legend">
        <span class="grid-legend-item" data-state="active">active</span>
        <span class="grid-legend-item" data-state="done">called</span>
        <span class="grid-legend-item" data-state="muted">queued</span>
        <span class="grid-legend-item" data-state="skip">skipped</span>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.grid-figure {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}
.grid-figure figcaption {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.grid-eyebrow {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.grid-meta {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
}

.grid-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-col-header,
.grid-row {
  align-items: center;
  display: grid;
  gap: 4px;
}
.grid-corner {
  height: 1px;
}
.grid-col-label {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-align: center;
}
.grid-col-label[data-active] {
  color: var(--ink);
}
.grid-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.grid-row-label {
  align-items: center;
  display: inline-flex;
  gap: 8px;
}
.grid-row-glyph {
  border: 1px solid var(--rule-strong);
  color: var(--ink-2);
  display: inline-flex;
  font-family: "Fraunces", serif;
  font-size: 12px;
  font-weight: 500;
  height: 22px;
  justify-content: center;
  align-items: center;
  width: 22px;
}
.grid-row-name {
  color: var(--ink-2);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
}

.grid-cell {
  align-items: center;
  background: var(--paper-2);
  border: 1px solid var(--rule);
  display: flex;
  height: 28px;
  justify-content: center;
  position: relative;
}
.grid-cell-mark {
  background: currentColor;
  display: block;
  height: 6px;
  width: 6px;
}
.grid-cell[data-state="active"] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--paper);
}
.grid-cell[data-state="done"] {
  background: var(--paper-3);
  border-color: var(--rule-strong);
  color: var(--ink);
}
.grid-cell[data-state="muted"] {
  background: var(--paper-2);
  border-color: var(--rule);
  color: var(--ink-3);
}
.grid-cell[data-state="skip"] {
  background: transparent;
  border-color: var(--rule);
  color: transparent;
}

.grid-legend {
  align-items: center;
  border-top: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  gap: 14px;
  letter-spacing: 0.06em;
  padding-top: 8px;
}
.grid-legend-item {
  align-items: center;
  color: var(--ink-3);
  display: inline-flex;
  gap: 6px;
}
.grid-legend-item::before {
  content: "";
  display: inline-block;
  height: 10px;
  width: 10px;
}
.grid-legend-item[data-state="active"]::before {
  background: var(--ink);
}
.grid-legend-item[data-state="done"]::before {
  background: var(--paper-3);
  border: 1px solid var(--rule-strong);
}
.grid-legend-item[data-state="muted"]::before {
  background: var(--paper-2);
  border: 1px solid var(--rule);
}
.grid-legend-item[data-state="skip"]::before {
  background: transparent;
  border: 1px solid var(--rule);
}
</style>
