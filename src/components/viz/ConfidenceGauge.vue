<script setup lang="ts">
import { computed } from "vue";

import { useAnimatedNumber } from "../../composables/useAnimatedNumber";

type Tone = "pos" | "neg" | "warn" | "neutral";

const props = withDefaults(
  defineProps<{
    /** 0..1 confidence */
    confidence: number;
    /** -1..1 consensus, optional */
    consensus?: number;
    tone?: Tone;
    label?: string;
    size?: number;
  }>(),
  {
    consensus: 0,
    tone: "neutral",
    label: "",
    size: 168,
  },
);

const VIEW = 168;
const RADIUS = 70;
const STROKE = 10;
const CIRCUM = 2 * Math.PI * RADIUS;

// Animated values for smooth fill / counter
const animatedConfidence = useAnimatedNumber(
  () => Math.max(0, Math.min(1, props.confidence)),
  900,
);
const animatedConsensus = useAnimatedNumber(
  () => Math.max(-1, Math.min(1, props.consensus)),
  900,
);

const dash = computed(
  () => `${animatedConfidence.value * CIRCUM} ${CIRCUM}`,
);

const arcColor = computed(() => {
  if (props.tone === "pos") return "var(--pos)";
  if (props.tone === "neg") return "var(--neg)";
  if (props.tone === "warn") return "var(--warn)";
  return "var(--ink)";
});

const pct = computed(() => Math.round(animatedConfidence.value * 100));
const consPct = computed(() => Math.round(animatedConsensus.value * 100));
const consTone = computed(() => (animatedConsensus.value >= 0 ? "pos" : "neg"));
</script>

<template>
  <figure class="gauge" :style="{ width: `${size}px` }">
    <svg
      :viewBox="`0 0 ${VIEW} ${VIEW}`"
      class="gauge-svg"
      role="img"
      :aria-label="`Confidence ${pct} percent`"
    >
      <!-- Track ring -->
      <circle
        :cx="VIEW / 2"
        :cy="VIEW / 2"
        :r="RADIUS"
        fill="none"
        stroke="var(--rule)"
        :stroke-width="STROKE"
      />
      <!-- Filled arc -->
      <circle
        class="gauge-arc"
        :cx="VIEW / 2"
        :cy="VIEW / 2"
        :r="RADIUS"
        fill="none"
        :stroke="arcColor"
        :stroke-width="STROKE"
        :stroke-dasharray="dash"
        stroke-linecap="butt"
        :transform="`rotate(-90 ${VIEW / 2} ${VIEW / 2})`"
      />
      <!-- subtle "live" tick that orbits the arc tip -->
      <circle
        class="gauge-tip"
        :cx="VIEW / 2"
        :cy="VIEW / 2 - RADIUS"
        r="3"
        :fill="arcColor"
        :transform="`rotate(${animatedConfidence * 360} ${VIEW / 2} ${VIEW / 2})`"
      />
      <text
        :x="VIEW / 2"
        :y="VIEW / 2 + 4"
        text-anchor="middle"
        font-family="Pretendard, sans-serif"
        font-size="40"
        font-weight="800"
        font-feature-settings="'tnum'"
        fill="var(--ink)"
      >
        {{ pct }}
      </text>
      <text
        :x="VIEW / 2"
        :y="VIEW / 2 + 24"
        text-anchor="middle"
        font-family="JetBrains Mono, monospace"
        font-size="9"
        letter-spacing="0.16em"
        fill="var(--ink-3)"
      >
        CONFIDENCE
      </text>
    </svg>

    <div class="gauge-foot">
      <span class="gauge-foot-label">consensus</span>
      <strong class="gauge-foot-val" :data-tone="consTone">
        {{ consPct >= 0 ? "+" : "" }}{{ consPct }}
      </strong>
    </div>
  </figure>
</template>

<style scoped>
.gauge {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}
.gauge-svg {
  display: block;
  height: auto;
  width: 100%;
}
.gauge-arc {
  transition: stroke 240ms ease;
}
.gauge-tip {
  filter: drop-shadow(0 0 4px currentColor);
  animation: tip-pulse 2.4s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes tip-pulse {
  0%, 100% { opacity: 1; r: 3; }
  50% { opacity: 0.55; r: 4.4; }
}
.gauge-foot {
  align-items: baseline;
  display: flex;
  gap: 8px;
  justify-content: center;
}
.gauge-foot-label {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.gauge-foot-val {
  font-family: "JetBrains Mono", monospace;
  font-feature-settings: "tnum";
  font-size: 13px;
  transition: color 240ms ease;
}
.gauge-foot-val[data-tone="pos"] {
  color: var(--pos);
}
.gauge-foot-val[data-tone="neg"] {
  color: var(--neg);
}

@media (prefers-reduced-motion: reduce) {
  .gauge-tip {
    animation: none;
    filter: none;
  }
}
</style>
