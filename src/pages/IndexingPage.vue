<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  getPortfolioDefinition,
  getRecommendedHoldings,
  recommendIndexes,
  savePortfolioDefinition,
  type HoldingSample,
  type IndexRecommendation,
  type PortfolioDefinition,
} from "../api";

const risk = ref<"conservative" | "balanced" | "aggressive">("balanced");
const universeKr = ref(true);
const universeUs = ref(false);
const incomePreference = ref(0.45);
const capitalKrw = ref(10_000_000);
const recommendations = ref<IndexRecommendation[]>([]);
const selectedCode = ref<string | null>(null);
const samples = ref<HoldingSample[]>([]);
const currentDefinition = ref<PortfolioDefinition | null>(null);
const state = ref<"idle" | "loading" | "saving" | "saved" | "error">("idle");
const notice = ref("목표 인덱스를 저장하면 Judge가 현재 KIS 잔고와 비교해 drift 기반 리밸런싱 초안을 만듭니다.");

const universes = computed(() => {
  const values: string[] = [];
  if (universeKr.value) values.push("KR");
  if (universeUs.value) values.push("US");
  return values.length ? values : ["KR"];
});

const selectedRecommendation = computed(() =>
  recommendations.value.find((item) => item.code === selectedCode.value) ?? recommendations.value[0] ?? null,
);

const riskProfile = computed(() => {
  if (risk.value === "conservative") return "안정형";
  if (risk.value === "aggressive") return "적극투자형";
  return "위험중립형";
});

const driftThreshold = computed(() => {
  if (risk.value === "conservative") return 0.03;
  if (risk.value === "aggressive") return 0.07;
  return 0.05;
});

async function loadCurrentDefinition() {
  try {
    currentDefinition.value = await getPortfolioDefinition();
  } catch {
    currentDefinition.value = null;
  }
}

async function loadRecommendations() {
  state.value = "loading";
  notice.value = "추천 후보를 계산하는 중입니다.";
  try {
    recommendations.value = await recommendIndexes({
      universes: universes.value,
      risk: risk.value,
      income_preference: incomePreference.value,
      esg_exclusions: [],
      sectors_exclude: [],
    });
    selectedCode.value = recommendations.value[0]?.code ?? null;
    await loadSamples();
    state.value = "idle";
    notice.value = "추천 후보를 선택하고 목표 인덱스로 저장할 수 있습니다.";
  } catch (error) {
    state.value = "error";
    notice.value = error instanceof Error ? error.message : "추천 후보를 불러오지 못했습니다.";
  }
}

async function loadSamples() {
  if (!selectedCode.value) {
    samples.value = [];
    return;
  }
  samples.value = await getRecommendedHoldings(selectedCode.value, capitalKrw.value);
}

async function selectRecommendation(code: string) {
  selectedCode.value = code;
  state.value = "loading";
  try {
    await loadSamples();
  } finally {
    state.value = "idle";
  }
}

async function saveAsDefinition() {
  if (!selectedRecommendation.value || samples.value.length === 0) return;
  state.value = "saving";
  const payload: PortfolioDefinition = {
    name: selectedRecommendation.value.name,
    description: selectedRecommendation.value.description,
    risk_profile: riskProfile.value,
    drift_threshold: driftThreshold.value,
    rebalancing_frequency: "임계치 도달 시",
    threshold_overridden: false,
    target_weights: samples.value.map((item) => ({
      ticker: item.ticker,
      company_name: item.company_name,
      weight: item.target_weight,
      market: "KR",
    })),
  };
  try {
    currentDefinition.value = await savePortfolioDefinition(payload);
    state.value = "saved";
    notice.value = "목표 인덱스를 저장했습니다. Dashboard에서 Judge를 실행하면 drift 기반 판단이 반영됩니다.";
  } catch (error) {
    state.value = "error";
    notice.value = error instanceof Error ? error.message : "목표 인덱스 저장에 실패했습니다.";
  }
}

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

onMounted(async () => {
  await loadCurrentDefinition();
  await loadRecommendations();
});
</script>

<template>
  <article class="indexing-page">
    <section class="indexing-command">
      <div>
        <span class="eyebrow">Direct Indexing</span>
        <h1>목표 인덱스</h1>
        <p>{{ notice }}</p>
      </div>
      <button type="button" :disabled="state === 'loading'" @click="loadRecommendations">
        {{ state === "loading" ? "계산 중" : "추천 새로고침" }}
      </button>
    </section>

    <section class="indexing-grid">
      <form class="indexing-panel" @submit.prevent="loadRecommendations">
        <header>
          <span>사용자 조건</span>
          <strong>추천 입력</strong>
        </header>

        <label>
          투자 성향
          <select v-model="risk">
            <option value="conservative">보수적</option>
            <option value="balanced">중립</option>
            <option value="aggressive">공격적</option>
          </select>
        </label>

        <label>
          투자금
          <input v-model.number="capitalKrw" type="number" min="1000000" step="1000000" />
        </label>

        <label>
          배당 선호
          <input v-model.number="incomePreference" type="range" min="0" max="1" step="0.05" />
          <span>{{ percent(incomePreference) }}</span>
        </label>

        <div class="check-row">
          <label><input v-model="universeKr" type="checkbox" /> 국내</label>
          <label><input v-model="universeUs" type="checkbox" /> 미국</label>
        </div>
      </form>

      <section class="indexing-panel">
        <header>
          <span>저장된 목표</span>
          <strong>{{ currentDefinition?.name ?? "없음" }}</strong>
        </header>
        <div v-if="currentDefinition" class="target-list">
          <div v-for="item in currentDefinition.target_weights" :key="item.ticker" class="target-row">
            <span>{{ item.company_name }}</span>
            <strong>{{ percent(item.weight) }}</strong>
          </div>
        </div>
        <p v-else class="muted">아직 저장된 목표 인덱스가 없습니다.</p>
      </section>
    </section>

    <section class="recommendation-list">
      <button
        v-for="item in recommendations"
        :key="item.code"
        type="button"
        class="recommendation-item"
        :class="{ selected: item.code === selectedCode }"
        @click="selectRecommendation(item.code)"
      >
        <span>{{ item.code }}</span>
        <strong>{{ item.name }}</strong>
        <em>{{ Math.round(item.score * 100) }}점</em>
        <p>{{ item.rationale }}</p>
      </button>
    </section>

    <section class="indexing-panel samples-panel">
      <header>
        <span>목표 구성</span>
        <strong>{{ selectedRecommendation?.name ?? "선택 필요" }}</strong>
      </header>
      <div class="target-list">
        <div v-for="item in samples" :key="item.ticker" class="target-row">
          <span>{{ item.company_name }} <small>{{ item.ticker }}</small></span>
          <strong>{{ percent(item.target_weight) }}</strong>
        </div>
      </div>
      <button class="save-button" type="button" :disabled="state === 'saving' || samples.length === 0" @click="saveAsDefinition">
        {{ state === "saving" ? "저장 중" : "목표 인덱스로 저장" }}
      </button>
    </section>
  </article>
</template>

<style scoped>
.indexing-page {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.indexing-command,
.indexing-panel,
.recommendation-item {
  border: 1px solid var(--rule);
  background: var(--paper);
}

.indexing-command {
  align-items: end;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 28px 32px;
}

.eyebrow,
.indexing-panel header span {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  text-transform: uppercase;
}

.indexing-command h1 {
  color: var(--ink);
  font-size: clamp(40px, 7vw, 82px);
  letter-spacing: 0;
  line-height: 0.95;
  margin: 8px 0 12px;
}

.indexing-command p,
.muted {
  color: var(--ink-2);
  margin: 0;
}

button,
select,
input {
  font: inherit;
}

button {
  border: 1px solid var(--ink);
  background: var(--ink);
  color: var(--paper);
  cursor: pointer;
  min-height: 42px;
  padding: 0 16px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.indexing-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.indexing-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
}

.indexing-panel header {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
}

.indexing-panel header strong {
  color: var(--ink);
  font-size: 18px;
}

.indexing-panel label {
  color: var(--ink-2);
  display: grid;
  gap: 8px;
  font-size: 14px;
}

.indexing-panel input,
.indexing-panel select {
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink);
  min-height: 40px;
  padding: 0 10px;
}

.check-row {
  display: flex;
  gap: 16px;
}

.check-row label {
  align-items: center;
  display: flex;
  gap: 8px;
}

.recommendation-list {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.recommendation-item {
  color: var(--ink);
  display: grid;
  gap: 8px;
  min-height: 160px;
  padding: 18px;
  text-align: left;
}

.recommendation-item.selected {
  border-color: var(--seal);
  box-shadow: inset 0 0 0 2px var(--seal);
}

.recommendation-item span,
.recommendation-item em {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-style: normal;
}

.recommendation-item strong {
  font-size: 22px;
}

.recommendation-item p {
  color: var(--ink-2);
  line-height: 1.45;
  margin: 0;
}

.target-list {
  display: grid;
  gap: 8px;
}

.target-row {
  align-items: center;
  border-bottom: 1px solid var(--rule);
  display: flex;
  justify-content: space-between;
  min-height: 40px;
}

.target-row small {
  color: var(--ink-3);
  margin-left: 6px;
}

.save-button {
  align-self: flex-start;
  margin-top: 4px;
}

@media (max-width: 860px) {
  .indexing-command,
  .indexing-grid,
  .recommendation-list {
    grid-template-columns: 1fr;
  }

  .indexing-command {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
