<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";

import { useJudgeState } from "../composables/useJudgeState";

const { latestRun, judgeState, runJudge, ensureLoaded } = useJudgeState();

const newsResponses = computed(() =>
  (latestRun.value?.agent_responses ?? []).filter((response) =>
    response.agent_id.toLowerCase().includes("news") ||
    response.agent_id.toLowerCase().includes("sentiment") ||
    response.agent_id.toLowerCase().includes("macro"),
  ),
);

const hasRun = computed(() => Boolean(latestRun.value));

onMounted(ensureLoaded);
</script>

<template>
  <article class="news-workbench">
    <section class="news-hero">
      <div>
        <span class="micro-label">Market Intake</span>
        <h1>뉴스·공시·매크로 신호를 Judge 입력으로 정리합니다.</h1>
        <p>
          JY의 뉴스/감성 패널 흐름을 LIBRA 판단 trace에 맞춰 재배치했습니다.
          최신 Judge run이 있으면 News, Sentiment, Macro 응답을 이 화면에서 확인합니다.
        </p>
      </div>
      <button class="cta cta-primary" type="button" :disabled="judgeState === 'running'" @click="runJudge">
        {{ judgeState === "running" ? "Judge 실행 중" : "시장 신호 포함 판단 실행" }}
      </button>
    </section>

    <section class="news-grid">
      <article class="news-lane">
        <header>
          <span class="micro-label">Pipeline</span>
          <strong>수집 → 정규화 → 감성/거시 해석 → Judge</strong>
        </header>
        <ol>
          <li>
            <span>01</span>
            <p>libra-ingest가 뉴스, 공시, 리포트를 KnowledgeDocument로 정규화</p>
          </li>
          <li>
            <span>02</span>
            <p>NewsAgent와 SentimentAgent가 종목별 방향성·강도·신뢰도를 산출</p>
          </li>
          <li>
            <span>03</span>
            <p>MacroAgent가 시장 환경과 섹터 편중 리스크를 보조 판단</p>
          </li>
          <li>
            <span>04</span>
            <p>Judge가 다른 에이전트 의견과 합의해 HOLD/DEFER/REBALANCE 결정</p>
          </li>
        </ol>
      </article>

      <article class="news-lane">
        <header>
          <span class="micro-label">Latest Signals</span>
          <strong>{{ newsResponses.length }}개 응답</strong>
        </header>
        <div v-if="!hasRun" class="news-empty">
          아직 실행된 Judge run이 없습니다. Dashboard에서 실행하거나 이 화면에서 바로 실행하세요.
        </div>
        <div v-else-if="!newsResponses.length" class="news-empty">
          최신 run에서 뉴스/감성/매크로 에이전트가 호출되지 않았습니다.
        </div>
        <article
          v-for="response in newsResponses"
          v-else
          :key="`${response.agent_id}-${response.turn_number}`"
          class="signal-card"
        >
          <header>
            <strong>{{ response.agent_id }}</strong>
            <span>T{{ response.turn_number }} · {{ Math.round(response.confidence * 100) }}%</span>
          </header>
          <p>{{ response.reasoning_for_judge_agent || response.query_understood }}</p>
        </article>
      </article>
    </section>

    <RouterLink class="news-link" to="/decision">Decision Trace에서 전체 판단 보기 →</RouterLink>
  </article>
</template>

<style scoped>
.news-workbench {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0 auto;
  max-width: var(--max);
  padding: 28px clamp(20px, 3vw, 40px) 64px;
  width: 100%;
}
.news-hero,
.news-lane {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.news-hero {
  align-items: end;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  padding: 28px 32px;
}
.news-hero h1 {
  font-size: clamp(30px, 4.4vw, 56px);
  letter-spacing: -0.035em;
  line-height: 1.02;
  margin: 10px 0;
  max-width: 880px;
}
.news-hero p {
  color: var(--ink-2);
  line-height: 1.6;
  margin: 0;
  max-width: 78ch;
}
.news-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
}
.news-lane {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
}
.news-lane header {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
}
.news-lane header strong {
  font-size: 18px;
}
.news-lane ol {
  display: grid;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}
.news-lane li {
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 12px;
  grid-template-columns: 42px 1fr;
  padding: 14px 0;
}
.news-lane li span,
.signal-card header span {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11px;
}
.news-lane li p,
.signal-card p,
.news-empty {
  color: var(--ink-2);
  line-height: 1.55;
  margin: 0;
}
.signal-card {
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 8px;
  padding-top: 14px;
}
.signal-card header {
  display: flex;
  justify-content: space-between;
}
.signal-card strong {
  color: var(--ink);
}
.news-empty {
  border: 1px dashed var(--rule-strong);
  padding: 24px;
}
.news-link {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 12px;
  text-decoration: none;
}
@media (max-width: 920px) {
  .news-hero {
    align-items: stretch;
    flex-direction: column;
  }
  .news-grid {
    grid-template-columns: 1fr;
  }
}
</style>
