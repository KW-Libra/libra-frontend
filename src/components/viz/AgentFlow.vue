<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { AgentView } from "../../view-model";

type Tone = "pos" | "neg" | "warn" | "neutral";
type JudgeRunState = "ready" | "running" | "done" | "error";

const props = withDefaults(
  defineProps<{
    agents: AgentView[];
    decisionLabel: string;
    decisionTone: Tone;
    /** Highlight a specific turn's edge */
    activeTurn?: number;
    /** Live judge state for animation cues */
    judgeState?: JudgeRunState;
    /** Run identifier — when this changes, edges re-animate in */
    runKey?: string | number | null;
    /** Compact mode for dashboard — hides skipped lane, tighter spacing */
    compact?: boolean;
  }>(),
  {
    judgeState: "ready",
    runKey: null,
    compact: false,
  },
);

/* ------------------------------------------------------------------ *
 *  Layout constants — keep dimensions explicit so the SVG can be     *
 *  scaled and stay symmetric. Single source of truth.                 *
 * ------------------------------------------------------------------ */
const W = 880;
const NODE_X = 80;
const TURN_LABEL_X = 240;
const EDGE_START_X = 268;
const JUDGE_X = 528;

// Compact-aware layout dimensions
const dim = computed(() => {
  if (props.compact) {
    return {
      ROW_GAP: 38,
      NODE_R: 13,
      NAME_X: 104,
      JUDGE_W:96,
      JUDGE_H: 50,
      VERDICT_X: 760,
      VERDICT_W: 144,
      VERDICT_H: 36,
      TOP_PAD: 36,
    };
  }
  return {
    ROW_GAP: 56,
    NODE_R: 16,
    NAME_X: 110,
    JUDGE_W:116,
    JUDGE_H: 64,
    VERDICT_X: 776,
    VERDICT_W: 168,
    VERDICT_H: 44,
    TOP_PAD: 64,
  };
});

function turnNumber(turn: string): number {
  const num = Number(turn.replace(/^T/, ""));
  return Number.isFinite(num) ? num : 0;
}

type Row = {
  agent: AgentView;
  status: "called" | "skipped";
  turnNum: number;
  y: number;
  signalColor: string;
  edgeLength: number;
  /** Animation order — 0-indexed by turn order */
  drawIdx: number;
};

function signalColor(signal: number): string {
  if (signal > 0.05) return "var(--pos)";
  if (signal < -0.05) return "var(--neg)";
  return "var(--ink-2)";
}

const calledRows = computed<Row[]>(() => {
  const callees = props.agents
    .filter((a) => a.status === "called")
    .sort((a, b) => turnNumber(a.turn) - turnNumber(b.turn));
  return callees.map((agent, idx) => ({
    agent,
    status: "called" as const,
    turnNum: turnNumber(agent.turn),
    y: dim.value.TOP_PAD + idx * dim.value.ROW_GAP,
    signalColor: signalColor(agent.signal),
    edgeLength: 0,
    drawIdx: idx,
  }));
});

const skippedRows = computed<Row[]>(() => {
  // In compact mode, skipped agents are rendered as a small text pill
  // outside the SVG, not as additional lanes.
  if (props.compact) return [];
  const calledHeight = calledRows.value.length * dim.value.ROW_GAP;
  const skippedStart = dim.value.TOP_PAD + calledHeight + 24;
  return props.agents
    .filter((a) => a.status === "skipped")
    .map((agent, idx) => ({
      agent,
      status: "skipped" as const,
      turnNum: 0,
      y: skippedStart + idx * (dim.value.ROW_GAP - 12),
      signalColor: "var(--ink-3)",
      edgeLength: 0,
      drawIdx: idx,
    }));
});

const skippedAgentList = computed(() =>
  props.agents.filter((a) => a.status === "skipped"),
);

const allRows = computed(() => [...calledRows.value, ...skippedRows.value]);

const judgeY = computed(() => {
  if (!calledRows.value.length) return 100;
  const first = calledRows.value[0].y;
  const last = calledRows.value[calledRows.value.length - 1].y;
  return (first + last) / 2;
});

const verdictY = computed(() => judgeY.value);

const totalH = computed(() => {
  const last =
    skippedRows.value[skippedRows.value.length - 1] ??
    calledRows.value[calledRows.value.length - 1];
  const minH = props.compact ? 180 : 280;
  return Math.max(minH, (last?.y ?? 100) + (props.compact ? 32 : 56));
});

const verdictFill = computed(() => {
  if (props.decisionTone === "pos") return "var(--pos-soft)";
  if (props.decisionTone === "neg") return "var(--neg-soft)";
  if (props.decisionTone === "warn") return "rgba(251, 191, 36, 0.16)";
  return "var(--paper-2)";
});

const verdictStroke = computed(() => {
  if (props.decisionTone === "pos") return "var(--pos)";
  if (props.decisionTone === "neg") return "var(--neg)";
  if (props.decisionTone === "warn") return "var(--warn)";
  return "var(--ink)";
});

const verdictTextColor = computed(() => {
  if (props.decisionTone === "pos") return "var(--pos)";
  if (props.decisionTone === "neg") return "var(--neg)";
  if (props.decisionTone === "warn") return "var(--warn)";
  return "var(--ink)";
});

function isActive(row: Row) {
  return props.activeTurn != null && row.turnNum === props.activeTurn;
}

/**
 * `animationKey` — every time runKey or judgeState transitions to "done",
 * we bump this so the edge draw-in / verdict stamp-in re-fires.
 */
const animationKey = ref(0);
watch(
  () => [props.runKey, props.judgeState],
  ([, state], [, prevState]) => {
    if (state === "done" && prevState !== "done") {
      animationKey.value += 1;
    }
  },
);
// also rev on initial mount when runKey is non-null
watch(
  () => props.runKey,
  (next, prev) => {
    if (next != null && next !== prev) animationKey.value += 1;
  },
  { immediate: true },
);

const statusBadge = computed(() => {
  if (props.judgeState === "running") {
    return { label: "RUNNING", tone: "running" as const };
  }
  if (props.judgeState === "error") {
    return { label: "ERROR", tone: "error" as const };
  }
  if (props.judgeState === "done") {
    return { label: "LIVE", tone: "live" as const };
  }
  return { label: "READY", tone: "ready" as const };
});
</script>

<template>
  <figure class="funnel-figure" :data-state="judgeState" :data-compact="compact || undefined">
    <figcaption>
      <span class="funnel-eyebrow">Orchestration</span>
      <div class="funnel-status">
        <span
          class="funnel-status-pill"
          :data-tone="statusBadge.tone"
        >
          <span class="funnel-status-dot" aria-hidden="true"></span>
          {{ statusBadge.label }}
        </span>
        <span class="funnel-meta">
          <span>{{ calledRows.length }} consulted</span>
          <span class="funnel-meta-sep">·</span>
          <span class="funnel-meta-skip">
            {{ compact ? skippedAgentList.length : skippedRows.length }} skipped
          </span>
        </span>
      </div>
    </figcaption>

    <svg
      :viewBox="`0 0 ${W} ${totalH}`"
      preserveAspectRatio="xMidYMin meet"
      class="funnel-svg"
      role="img"
    >
      <defs>
        <marker
          id="funnel-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>

      <!-- Edges from each called agent into Judge's left edge -->
      <g :key="`edges-${animationKey}`">
        <line
          v-for="row in calledRows"
          :key="`edge-${row.agent.id}`"
          class="funnel-edge"
          :class="{ 'is-active': isActive(row) }"
          :x1="EDGE_START_X"
          :y1="row.y"
          :x2="JUDGE_X - dim.JUDGE_W / 2 - 2"
          :y2="judgeY"
          :stroke="row.signalColor"
          :stroke-width="isActive(row) ? 2.4 : 1.4"
          :opacity="isActive(row) ? 1 : 0.85"
          marker-end="url(#funnel-arrow)"
          :style="{
            color: row.signalColor,
            '--draw-delay': `${row.drawIdx * 0.18}s`,
          }"
        />
      </g>

      <!-- Single arrow Judge → Decision -->
      <line
        :key="`verdict-arrow-${animationKey}`"
        class="funnel-verdict-arrow"
        :x1="JUDGE_X + dim.JUDGE_W / 2"
        :y1="judgeY"
        :x2="dim.VERDICT_X - dim.VERDICT_W / 2 - 2"
        :y2="verdictY"
        :stroke="verdictStroke"
        stroke-width="2"
        marker-end="url(#funnel-arrow)"
        :style="{
          color: verdictStroke,
          '--draw-delay': `${calledRows.length * 0.18}s`,
        }"
      />

      <!-- Agent rows -->
      <g v-for="row in allRows" :key="`row-${row.agent.id}`" class="funnel-row">
        <!-- Mini-glyph -->
        <rect
          class="funnel-glyph"
          :x="NODE_X - dim.NODE_R"
          :y="row.y - dim.NODE_R"
          :width="dim.NODE_R * 2"
          :height="dim.NODE_R * 2"
          :fill="row.status === 'called' ? 'var(--ink)' : 'transparent'"
          :stroke="row.status === 'called' ? 'var(--ink)' : 'var(--rule-strong)'"
          stroke-width="1"
          :stroke-dasharray="row.status === 'skipped' ? '2 3' : ''"
          :data-status="row.status"
        />
        <text
          :x="NODE_X"
          :y="row.y + 4"
          text-anchor="middle"
          font-family="Pretendard, sans-serif"
          font-size="13"
          font-weight="700"
          :fill="row.status === 'called' ? 'var(--paper)' : 'var(--ink-3)'"
        >
          {{ row.agent.glyph }}
        </text>

        <text
          :x="dim.NAME_X"
          :y="row.y + 4"
          font-family="Pretendard, sans-serif"
          font-size="13"
          font-weight="500"
          :fill="row.status === 'called' ? 'var(--ink)' : 'var(--ink-3)'"
        >
          {{ row.agent.name }}
        </text>

        <text
          v-if="row.status === 'called'"
          :x="TURN_LABEL_X"
          :y="row.y + 4"
          font-family="JetBrains Mono, monospace"
          font-size="11"
          font-weight="500"
          letter-spacing="0.04em"
          :fill="isActive(row) ? 'var(--ink)' : 'var(--ink-3)'"
        >
          T{{ row.turnNum }}
        </text>
        <text
          v-else
          :x="TURN_LABEL_X"
          :y="row.y + 4"
          font-family="JetBrains Mono, monospace"
          font-size="10"
          letter-spacing="0.08em"
          fill="var(--ink-3)"
        >
          SKIP
        </text>
      </g>

      <!-- Judge box -->
      <g :transform="`translate(${JUDGE_X}, ${judgeY})`" class="funnel-judge">
        <!-- breathing halo (CSS animated) -->
        <rect
          class="funnel-judge-halo"
          :x="-dim.JUDGE_W / 2 - 4"
          :y="-dim.JUDGE_H / 2 - 4"
          :width="dim.JUDGE_W + 8"
          :height="dim.JUDGE_H + 8"
          fill="none"
          :stroke="verdictStroke"
          stroke-width="1"
        />
        <rect
          class="funnel-judge-box"
          :x="-dim.JUDGE_W / 2"
          :y="-dim.JUDGE_H / 2"
          :width="dim.JUDGE_W"
          :height="dim.JUDGE_H"
          fill="var(--ink)"
        />
        <text
          x="0"
          y="-2"
          text-anchor="middle"
          font-family="Pretendard, sans-serif"
          font-size="18"
          font-weight="800"
          letter-spacing="0.02em"
          fill="var(--paper)"
        >
          JUDGE
        </text>
        <text
          x="0"
          y="16"
          text-anchor="middle"
          font-family="JetBrains Mono, monospace"
          font-size="10"
          letter-spacing="0.16em"
          fill="rgba(255, 255, 255, 0.6)"
        >
          ORCHESTRATOR
        </text>
        <!-- spinner ring (only when running) -->
        <circle
          v-if="judgeState === 'running'"
          class="funnel-judge-ring"
          cx="0"
          :cy="dim.JUDGE_H / 2 + 12"
          r="5"
          fill="var(--seal)"
        />
      </g>

      <!-- Decision verdict chip -->
      <g
        :key="`verdict-${animationKey}-${decisionLabel}`"
        :transform="`translate(${dim.VERDICT_X}, ${verdictY})`"
        class="funnel-verdict"
      >
        <rect
          :x="-dim.VERDICT_W / 2"
          :y="-dim.VERDICT_H / 2"
          :width="dim.VERDICT_W"
          :height="dim.VERDICT_H"
          :fill="verdictFill"
          :stroke="verdictStroke"
          stroke-width="1.6"
        />
        <text
          y="6"
          text-anchor="middle"
          font-family="Pretendard, sans-serif"
          font-size="15"
          font-weight="700"
          letter-spacing="0.04em"
          :fill="verdictTextColor"
        >
          {{ decisionLabel }}
        </text>
      </g>
    </svg>

    <!-- In compact mode, surface skipped agents as a slim pill row instead of a SVG lane -->
    <div
      v-if="compact && skippedAgentList.length"
      class="funnel-skipped-row"
      aria-label="Skipped agents"
    >
      <span class="funnel-skipped-label">Skipped</span>
      <span
        v-for="agent in skippedAgentList"
        :key="`skip-pill-${agent.id}`"
        class="funnel-skipped-pill"
      >
        <span class="funnel-skipped-glyph">{{ agent.glyph }}</span>
        {{ agent.name }}
      </span>
    </div>
  </figure>
</template>

<style scoped>
.funnel-figure {
  border: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: normal;
  padding: 22px 24px;
  position: relative;
  transition: border-color 220ms ease;
  word-break: normal;
}
.funnel-figure[data-state="running"] {
  border-color: var(--seal);
}
.funnel-figure figcaption {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
}
.funnel-eyebrow {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.funnel-status {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: flex-end;
  min-width: 0;
}
.funnel-status-pill {
  align-items: center;
  border: 1px solid var(--rule-strong);
  color: var(--ink-2);
  display: inline-flex;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  gap: 6px;
  letter-spacing: 0.14em;
  padding: 4px 10px;
}
.funnel-status-pill[data-tone="live"] {
  border-color: var(--pos);
  color: var(--pos);
}
.funnel-status-pill[data-tone="running"] {
  border-color: var(--seal);
  color: var(--seal);
}
.funnel-status-pill[data-tone="error"] {
  border-color: var(--neg);
  color: var(--neg);
}
.funnel-status-dot {
  border-radius: 50%;
  height: 6px;
  width: 6px;
  background: currentColor;
  display: inline-block;
  animation: pill-pulse 1.8s ease-in-out infinite;
}
.funnel-status-pill[data-tone="running"] .funnel-status-dot {
  animation: pill-pulse 0.7s ease-in-out infinite;
}
.funnel-status-pill[data-tone="error"] .funnel-status-dot {
  animation: none;
}
@keyframes pill-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.7); }
}

.funnel-meta {
  align-items: baseline;
  color: var(--ink-2);
  display: inline-flex;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  gap: 6px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.funnel-meta-sep,
.funnel-meta-skip {
  color: var(--ink-3);
}
.funnel-svg {
  display: block;
  height: auto;
  max-width: 100%;
  overflow: visible;
  width: 100%;
}

/* ── Edge draw-in animation: stroke-dashoffset trick ─────── */
.funnel-edge,
.funnel-verdict-arrow {
  stroke-dasharray: 320;
  stroke-dashoffset: 320;
  animation: funnel-draw 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  animation-delay: var(--draw-delay, 0s);
}
@keyframes funnel-draw {
  to { stroke-dashoffset: 0; }
}

/* ── Judge breathing halo ─────────────────────────────────── */
.funnel-judge-halo {
  opacity: 0.35;
  animation: judge-breathe 4.2s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes judge-breathe {
  0%, 100% { opacity: 0.18; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.04); }
}
.funnel-figure[data-state="running"] .funnel-judge-halo {
  animation-duration: 0.9s;
  opacity: 0.65;
}

/* ── Judge running ring pulse ─────────────────────────────── */
.funnel-judge-ring {
  animation: ring-pulse 0.9s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes ring-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.6); }
}

/* ── Verdict chip stamp-in ────────────────────────────────── */
.funnel-verdict {
  animation: verdict-fade 0.35s ease forwards;
  animation-delay: 0.4s;
  opacity: 0;
}
@keyframes verdict-fade {
  to { opacity: 1; }
}

/* ── Row hover lift ───────────────────────────────────────── */
.funnel-row {
  transition: opacity 180ms ease;
}
.funnel-row:hover {
  opacity: 1;
}
.funnel-figure:hover .funnel-row {
  opacity: 0.7;
}
.funnel-figure:hover .funnel-row:hover {
  opacity: 1;
}

/* ── Reduced motion: kill triggered animations ────────────── */
/* Compact-mode tweaks: tighter container padding */
.funnel-figure[data-compact] {
  gap: 10px;
  padding: 16px 20px;
}

.funnel-skipped-row {
  align-items: center;
  border-top: 1px dashed var(--rule);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
}
.funnel-skipped-label {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.funnel-skipped-pill {
  align-items: center;
  border: 1px dashed var(--rule-strong);
  color: var(--ink-3);
  display: inline-flex;
  font-family: "Pretendard", sans-serif;
  font-size: 11px;
  gap: 6px;
  padding: 3px 9px;
}
.funnel-skipped-glyph {
  color: var(--ink-2);
  font-family: "Pretendard", sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

@media (prefers-reduced-motion: reduce) {
  .funnel-edge,
  .funnel-verdict-arrow {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
    animation: none;
  }
  .funnel-judge-halo,
  .funnel-judge-ring,
  .funnel-status-dot {
    animation: none;
  }
  .funnel-verdict {
    animation: none;
    opacity: 1;
  }
}
</style>
