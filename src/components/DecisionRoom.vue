<script setup lang="ts">
import { computed } from "vue";

import type { AgentView, DecisionBadge } from "../view-model";

const props = defineProps<{
  decisionBadge: DecisionBadge;
  agents: AgentView[];
  signalAgents: AgentView[];
}>();

const calledRoute = computed(() => props.agents.filter((agent) => agent.status === "judge" || agent.status === "called"));
const skippedAgents = computed(() => props.agents.filter((agent) => agent.status === "skipped"));

function signalLeft(agent: AgentView) {
  return `${Math.max(8, Math.min(92, 50 + agent.signal * 120))}%`;
}

function signalBottom(agent: AgentView) {
  return `${Math.max(12, Math.min(86, 12 + agent.confidence * 74))}%`;
}

function signalSize(agent: AgentView) {
  return `${28 + agent.confidence * 18}px`;
}
</script>

<template>
  <section id="decision" class="decision-room">
    <section class="hero-panel">
      <div class="hero-copy">
        <span>Judge 우선 판단</span>
        <h1>Judge가 먼저 판단하고 필요한 에이전트만 호출합니다.</h1>
        <p>{{ decisionBadge.message }}</p>
      </div>
      <div class="decision-badge">
        <span>{{ decisionBadge.label }}</span>
        <strong>{{ decisionBadge.status }}</strong>
        <em>{{ decisionBadge.nextAction }}</em>
      </div>
    </section>

    <section class="route-panel" aria-label="동적 호출 경로">
      <div class="route-copy">
        <span>호출 경로</span>
        <strong>이번 판단에서 실제로 열린 경로</strong>
      </div>
      <ol class="route-line">
        <li v-for="agent in calledRoute" :key="agent.id">
          <span :style="{ color: agent.color, borderColor: agent.color }">{{ agent.glyph }}</span>
          <strong>{{ agent.name }}</strong>
          <em>{{ agent.turn }}</em>
        </li>
      </ol>
    </section>

    <section class="agent-map">
      <article v-for="agent in agents" :key="agent.id" class="agent-node" :class="agent.status">
        <div class="agent-head">
          <span class="agent-glyph" :style="{ color: agent.color, borderColor: agent.color }">{{ agent.glyph }}</span>
          <span>{{ agent.turn }}</span>
        </div>
        <strong>{{ agent.name }}</strong>
        <p>{{ agent.role }}</p>
        <small>{{ agent.reason }}</small>
      </article>
    </section>

    <section class="analysis-grid">
      <article class="panel chart-panel">
        <div class="section-title">
          <span class="title-glyph">S</span>
          <div>
            <span>신호 분포</span>
            <h2>의견 방향과 신뢰도</h2>
          </div>
        </div>
        <div class="signal-space" aria-label="에이전트 신호 공간">
          <span class="space-label left">방어</span>
          <span class="space-label right">공격</span>
          <span class="space-label top">신뢰도</span>
          <button
            v-for="agent in signalAgents"
            :key="agent.id"
            class="signal-dot"
            type="button"
            :style="{
              left: signalLeft(agent),
              bottom: signalBottom(agent),
              width: signalSize(agent),
              height: signalSize(agent),
              borderColor: agent.color,
              color: agent.color,
            }"
            :title="`${agent.name}: ${agent.reason}`"
          >
            {{ agent.glyph }}
          </button>
        </div>
      </article>

      <article class="panel evidence-panel">
        <div class="section-title">
          <span class="title-glyph">?</span>
          <div>
            <span>건너뛴 이유</span>
            <h2>미호출 이유</h2>
          </div>
        </div>
        <ul>
          <li v-for="agent in skippedAgents" :key="agent.id">
            <strong>{{ agent.name }} Agent</strong>
            <span>{{ agent.reason }}</span>
          </li>
        </ul>
      </article>
    </section>
  </section>
</template>
