<script setup lang="ts">
import type { TimelineStep } from "../view-model";

defineProps<{
  timeline: TimelineStep[];
}>();

defineEmits<{
  selectTurn: [turn: number];
  nextTurn: [];
}>();
</script>

<template>
  <aside class="rail inspector">
    <section class="panel">
      <div class="section-title">
        <span class="title-glyph">B</span>
        <div>
          <span>Execution Boundary</span>
          <h2>자동 판단 범위</h2>
        </div>
      </div>
      <dl class="boundary-list">
        <div>
          <dt>자동 가능</dt>
          <dd>정보 부족 인지, 보류, 재판단 예약</dd>
        </div>
        <div>
          <dt>승인 필요</dt>
          <dd>사용자 원칙 밖의 매도, 대규모 리밸런싱</dd>
        </div>
        <div>
          <dt>기록 대상</dt>
          <dd>호출 이유, 미호출 이유, 다음 행동</dd>
        </div>
      </dl>
    </section>

    <section id="trace" class="panel trace-panel">
      <div class="section-title">
        <span class="title-glyph">T</span>
        <div>
          <span>Decision Replay</span>
          <h2>판단 과정</h2>
        </div>
      </div>
      <ol>
        <li v-for="step in timeline" :key="step.turn" :class="step.state">
          <button type="button" @click="$emit('selectTurn', Number(step.turn.slice(1)))">
            <span>{{ step.turn }}</span>
            <strong>{{ step.actor }} · {{ step.title }}</strong>
            <em>{{ step.body }}</em>
          </button>
        </li>
      </ol>
      <button class="ghost-button replay-button" type="button" @click="$emit('nextTurn')">다음 턴 보기</button>
    </section>
  </aside>
</template>
