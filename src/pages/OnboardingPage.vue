<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import {
  getRecommendedHoldings,
  recommendIndexes,
  savePortfolioDefinition,
  searchKisStocks,
  type HoldingSample,
  type IndexRecommendation,
  type KisStockListing,
  type PortfolioDefinition,
  type TargetWeight,
} from "../api";

type Risk = "conservative" | "balanced" | "aggressive";
type SetupMode = "recommended" | "custom";

type DraftHolding = {
  ticker: string;
  company_name: string;
  weight: number;
  market: string;
};

const router = useRouter();

const step = ref(1);
const mode = ref<SetupMode>("custom");
const risk = ref<Risk>("balanced");
const universeKr = ref(true);
const universeUs = ref(false);
const incomePreference = ref(0.4);
const capitalKrw = ref(50_000_000);
const recommendations = ref<IndexRecommendation[]>([]);
const selectedCode = ref<string | null>(null);
const recommendedHoldings = ref<HoldingSample[]>([]);
const draftHoldings = ref<DraftHolding[]>([]);
const stockSearchQuery = ref("삼성");
const stockSearchResults = ref<KisStockListing[]>([]);
const stockSearchState = ref<"idle" | "loading" | "error">("idle");
const status = ref<"idle" | "loading" | "saving" | "saved" | "error">("idle");
const notice = ref("투자 기준을 정한 뒤 KIS 종목을 검색해서 목표 비중을 저장합니다.");

const setupSteps = [
  {
    id: 1,
    kicker: "Step 1",
    title: "투자 기준",
    desc: "성향과 기준 금액",
  },
  {
    id: 2,
    kicker: "Step 2",
    title: "종목 선택",
    desc: "KIS 마스터 검색",
  },
  {
    id: 3,
    kicker: "Step 3",
    title: "비중 저장",
    desc: "Judge 기준 확정",
  },
] as const;

const universes = computed(() => {
  const values: string[] = [];
  if (universeKr.value) values.push("KR");
  if (universeUs.value) values.push("US");
  return values.length ? values : ["KR"];
});

const selectedRecommendation = computed(() =>
  recommendations.value.find((item) => item.code === selectedCode.value) ?? recommendations.value[0] ?? null,
);

const activeHoldings = computed<DraftHolding[]>(() => {
  if (mode.value === "custom") return draftHoldings.value;
  return recommendedHoldings.value.map((item) => ({
    ticker: item.ticker,
    company_name: item.company_name,
    weight: item.target_weight,
    market: "KR",
  }));
});

const totalWeight = computed(() =>
  activeHoldings.value.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0),
);

const selectedCount = computed(() => activeHoldings.value.length);

const saveBlocker = computed(() => {
  if (activeHoldings.value.length === 0) return "종목을 1개 이상 선택해야 합니다.";
  if (activeHoldings.value.some((item) => !item.ticker.trim() || !item.company_name.trim())) {
    return "종목코드와 종목명이 비어 있는 행이 있습니다.";
  }
  if (activeHoldings.value.some((item) => item.weight <= 0)) return "모든 종목의 목표 비중이 0%보다 커야 합니다.";
  if (Math.abs(totalWeight.value - 1) > 0.01) return `현재 합계는 ${percent(totalWeight.value)}입니다. 100%로 맞춰야 합니다.`;
  return "";
});

const canSave = computed(() => {
  if (status.value === "saving") return false;
  return !saveBlocker.value;
});

const riskLabel = computed(() => {
  if (risk.value === "conservative") return "안정형";
  if (risk.value === "aggressive") return "적극투자형";
  return "위험중립형";
});

const driftThreshold = computed(() => {
  if (risk.value === "conservative") return 0.03;
  if (risk.value === "aggressive") return 0.07;
  return 0.05;
});

const driftThresholdLabel = computed(() => percent(driftThreshold.value));
const capitalLabel = computed(() => `${Math.round(capitalKrw.value / 10000).toLocaleString("ko-KR")}만원`);
const modeLabel = computed(() => (mode.value === "recommended" ? "추천 기반" : "직접 구성"));
const stepHeadline = computed(() => setupSteps.find((item) => item.id === step.value)?.title ?? "초기 설정");
const stepSummary = computed(() => {
  if (step.value === 1) return `${riskLabel.value} · 기준금액 ${capitalLabel.value} · 이탈 기준 ${driftThresholdLabel.value}`;
  if (step.value === 2) return `${modeLabel.value} · 선택 ${selectedCount.value}종목 · 합계 ${percent(totalWeight.value)}`;
  return canSave.value ? "저장하면 Dashboard에서 KIS 잔고 동기화와 Judge 실행을 이어갑니다." : saveBlocker.value;
});

async function loadRecommendations() {
  status.value = "loading";
  notice.value = "성향에 맞는 후보 인덱스를 계산하고 있습니다.";
  try {
    recommendations.value = await recommendIndexes({
      universes: universes.value,
      risk: risk.value,
      income_preference: incomePreference.value,
      esg_exclusions: [],
      sectors_exclude: [],
    });
    selectedCode.value = recommendations.value[0]?.code ?? null;
    await loadRecommendedHoldings();
    status.value = "idle";
    notice.value =
      mode.value === "recommended"
        ? "추천 후보를 선택하거나 직접 구성으로 전환할 수 있습니다."
        : "KIS 종목 마스터에서 종목을 검색해 목표 포트폴리오에 추가하세요.";
  } catch (error) {
    status.value = "error";
    notice.value = error instanceof Error ? error.message : "추천 후보를 불러오지 못했습니다.";
  }
}

async function loadRecommendedHoldings() {
  if (!selectedCode.value) {
    recommendedHoldings.value = [];
    return;
  }
  recommendedHoldings.value = await getRecommendedHoldings(selectedCode.value, capitalKrw.value);
}

async function selectRecommendation(code: string) {
  selectedCode.value = code;
  status.value = "loading";
  try {
    await loadRecommendedHoldings();
  } finally {
    status.value = "idle";
  }
}

async function searchStocks() {
  stockSearchState.value = "loading";
  try {
    stockSearchResults.value = await searchKisStocks(stockSearchQuery.value, ["KOSPI", "KOSDAQ"], 40);
    stockSearchState.value = "idle";
  } catch (error) {
    stockSearchResults.value = [];
    stockSearchState.value = "error";
    notice.value = error instanceof Error ? error.message : "KIS 종목 목록을 불러오지 못했습니다.";
  }
}

function addHolding() {
  draftHoldings.value.push({
    ticker: "",
    company_name: "",
    weight: 0,
    market: "KR",
  });
}

function addKisStock(stock: KisStockListing) {
  if (draftHoldings.value.some((item) => item.ticker === stock.ticker)) {
    notice.value = `${stock.company_name}은 이미 목표 포트폴리오에 들어 있습니다.`;
    return;
  }
  draftHoldings.value.push({
    ticker: stock.ticker,
    company_name: stock.company_name,
    weight: 0,
    market: stock.market,
  });
  normalizeWeights();
  notice.value = `${stock.company_name}을 추가하고 선택 종목을 동일 비중으로 맞췄습니다.`;
}

function removeHolding(index: number) {
  draftHoldings.value.splice(index, 1);
  normalizeWeights();
}

function normalizeWeights() {
  const rows = draftHoldings.value.filter((item) => item.ticker.trim() && item.company_name.trim());
  if (!rows.length) return;
  const equalWeight = Math.round((1 / rows.length) * 1000) / 1000;
  rows.forEach((item, index) => {
    item.weight = index === rows.length - 1 ? Math.max(0, 1 - equalWeight * (rows.length - 1)) : equalWeight;
  });
}

async function saveSetup() {
  if (!canSave.value) {
    notice.value = "목표 비중 합계가 100%가 되도록 조정해야 합니다.";
    return;
  }
  status.value = "saving";
  const targetWeights: TargetWeight[] = activeHoldings.value.map((item) => ({
    ticker: item.ticker.trim(),
    company_name: item.company_name.trim(),
    weight: Number(item.weight.toFixed(4)),
    market: item.market || "KR",
  }));
  const sourceName = mode.value === "recommended" ? selectedRecommendation.value?.name : "직접 구성 포트폴리오";
  const payload: PortfolioDefinition = {
    name: sourceName ?? "LIBRA 목표 포트폴리오",
    description:
      mode.value === "recommended"
        ? selectedRecommendation.value?.description ?? "추천 기반 초기 목표 포트폴리오"
        : "사용자가 직접 선택한 종목과 목표 비중",
    risk_profile: riskLabel.value,
    drift_threshold: driftThreshold.value,
    rebalancing_frequency: "임계치 도달 시",
    threshold_overridden: false,
    target_weights: targetWeights,
  };
  try {
    await savePortfolioDefinition(payload);
    status.value = "saved";
    notice.value = "초기 설정을 저장했습니다. 이제 Dashboard에서 KIS 잔고를 동기화하고 Judge를 실행할 수 있습니다.";
    setTimeout(() => router.replace("/dashboard"), 600);
  } catch (error) {
    status.value = "error";
    notice.value = error instanceof Error ? error.message : "초기 설정 저장에 실패했습니다.";
  }
}

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function weightInputValue(value: number) {
  return Math.round(value * 1000) / 10;
}

function setWeight(item: DraftHolding, value: number) {
  item.weight = Math.max(0, Math.min(1, Number.isFinite(value) ? value / 100 : 0));
}

onMounted(loadRecommendations);
onMounted(searchStocks);
</script>

<template>
  <article class="onboarding-page">
    <section class="setup-hero">
      <div class="setup-hero-copy">
        <span class="eyebrow">Initial Setup</span>
        <h1>Judge가 비교할 기준 포트폴리오를 저장합니다.</h1>
        <p>{{ notice }}</p>
      </div>

      <nav class="setup-steps" aria-label="초기 설정 단계">
        <button
          v-for="item in setupSteps"
          :key="item.id"
          type="button"
          :data-active="step === item.id"
          :data-complete="step > item.id"
          @click="step = item.id"
        >
          <span>{{ item.kicker }}</span>
          <strong>{{ item.title }}</strong>
          <em>{{ item.desc }}</em>
        </button>
      </nav>

      <aside class="setup-current">
        <span class="eyebrow">Now</span>
        <strong>{{ stepHeadline }}</strong>
        <p>{{ stepSummary }}</p>
      </aside>
    </section>

    <section v-if="step === 1" class="setup-workbench">
      <form class="setup-card setup-primary" @submit.prevent="step = 2">
        <header>
          <span>Risk Profile</span>
          <strong>투자 성향</strong>
        </header>

        <div class="risk-grid">
          <button type="button" :data-active="risk === 'conservative'" @click="risk = 'conservative'">
            <span>안정형</span>
            <em>작은 이탈도 점검</em>
          </button>
          <button type="button" :data-active="risk === 'balanced'" @click="risk = 'balanced'">
            <span>중립형</span>
            <em>기본 리밸런싱 기준</em>
          </button>
          <button type="button" :data-active="risk === 'aggressive'" @click="risk = 'aggressive'">
            <span>공격형</span>
            <em>큰 이탈까지 허용</em>
          </button>
        </div>

        <div class="field-grid">
          <label class="field-card">
            <span>초기 운용 금액</span>
            <input v-model.number="capitalKrw" type="number" min="1000000" step="1000000" />
            <em>{{ capitalLabel }}</em>
          </label>
          <label class="field-card">
            <span>배당 선호</span>
            <input v-model.number="incomePreference" type="range" min="0" max="1" step="0.05" />
            <em>{{ percent(incomePreference) }}</em>
          </label>
        </div>

        <div class="market-row">
          <label :data-active="universeKr">
            <input v-model="universeKr" type="checkbox" />
            <span>국내 주식</span>
            <em>KIS 검색 가능</em>
          </label>
          <label :data-active="universeUs" data-disabled="true">
            <input v-model="universeUs" type="checkbox" disabled />
            <span>미국 주식</span>
            <em>추후 연결</em>
          </label>
        </div>

        <footer class="setup-actions">
          <button class="primary-action" type="submit">다음: 종목 선택</button>
        </footer>
      </form>

      <aside class="setup-card setup-side">
        <span class="eyebrow">Judge 기준</span>
        <strong>{{ riskLabel }}</strong>
        <dl>
          <div>
            <dt>이탈 기준</dt>
            <dd>{{ driftThresholdLabel }}</dd>
          </div>
          <div>
            <dt>기준 금액</dt>
            <dd>{{ capitalLabel }}</dd>
          </div>
          <div>
            <dt>투자 지역</dt>
            <dd>{{ universes.join(", ") }}</dd>
          </div>
        </dl>
      </aside>
    </section>

    <section v-else-if="step === 2" class="setup-workbench">
      <div class="setup-card setup-primary">
        <header>
          <span>Universe</span>
          <strong>종목 선택</strong>
        </header>

        <div class="segmented">
          <button type="button" :data-active="mode === 'recommended'" @click="mode = 'recommended'">추천 기반</button>
          <button type="button" :data-active="mode === 'custom'" @click="mode = 'custom'">직접 구성</button>
        </div>

        <section v-if="mode === 'recommended'" class="recommendation-list">
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
          <button class="secondary-action" type="button" :disabled="status === 'loading'" @click="loadRecommendations">
            {{ status === "loading" ? "계산 중" : "추천 새로고침" }}
          </button>
        </section>

        <section v-else class="stock-picker">
          <form class="stock-search" @submit.prevent="searchStocks">
            <input v-model.trim="stockSearchQuery" placeholder="삼성전자 또는 005930" />
            <button type="submit" :disabled="stockSearchState === 'loading'">
              {{ stockSearchState === "loading" ? "검색 중" : "KIS 검색" }}
            </button>
          </form>
          <div class="stock-results">
            <button
              v-for="stock in stockSearchResults"
              :key="`${stock.market}-${stock.ticker}`"
              type="button"
              class="stock-result"
              @click="addKisStock(stock)"
            >
              <span>{{ stock.market }}</span>
              <strong>{{ stock.company_name }}</strong>
              <em>{{ stock.ticker }}</em>
            </button>
          </div>
        </section>

        <footer class="setup-actions">
          <button type="button" @click="step = 1">이전</button>
          <button class="primary-action" type="button" :disabled="!selectedCount" @click="normalizeWeights(); step = 3">
            다음: 비중 확인
          </button>
        </footer>
      </div>

      <aside class="setup-card setup-side basket-card">
        <span class="eyebrow">Selected</span>
        <strong>{{ selectedCount }}종목 · {{ percent(totalWeight) }}</strong>
        <ul v-if="activeHoldings.length">
          <li v-for="item in activeHoldings" :key="`${item.ticker}-${item.company_name}`">
            <span>{{ item.ticker }}</span>
            <strong>{{ item.company_name }}</strong>
            <em>{{ percent(item.weight) }}</em>
          </li>
        </ul>
        <p v-else>검색 결과에서 종목을 누르면 이곳에 들어옵니다.</p>
      </aside>
    </section>

    <section v-else class="setup-workbench">
      <section class="setup-card setup-primary holdings-panel">
        <header>
          <span>Target Weights</span>
          <strong>합계 {{ percent(totalWeight) }}</strong>
        </header>

        <div class="holding-table">
          <div class="holding-head">
            <span>종목코드</span>
            <span>종목명</span>
            <span>목표비중</span>
            <span></span>
          </div>

          <div v-for="(item, index) in activeHoldings" :key="`${item.ticker}-${index}`" class="holding-row">
            <input v-if="mode === 'custom'" v-model="item.ticker" placeholder="005930" />
            <span v-else>{{ item.ticker }}</span>
            <input v-if="mode === 'custom'" v-model="item.company_name" placeholder="삼성전자" />
            <span v-else>{{ item.company_name }}</span>
            <input
              v-if="mode === 'custom'"
              type="number"
              min="0"
              max="100"
              step="0.1"
              :value="weightInputValue(item.weight)"
              @input="setWeight(item, Number(($event.target as HTMLInputElement).value))"
            />
            <span v-else>{{ percent(item.weight) }}</span>
            <button v-if="mode === 'custom'" type="button" @click="removeHolding(index)">삭제</button>
          </div>
        </div>

        <div v-if="mode === 'custom'" class="setup-actions compact">
          <button type="button" @click="addHolding">종목 추가</button>
          <button type="button" @click="normalizeWeights">동일 비중</button>
        </div>
      </section>

      <section class="setup-card setup-side setup-summary">
        <span class="eyebrow">Ready For Judge</span>
        <strong>{{ canSave ? "저장 가능" : "비중 조정 필요" }}</strong>
        <p>{{ canSave ? "저장 후 Dashboard에서 잔고 동기화와 AI 판단을 실행합니다." : saveBlocker }}</p>
        <div class="setup-actions">
          <button type="button" @click="step = 2">이전</button>
          <button class="primary-action" type="button" :disabled="!canSave" @click="saveSetup">
            {{ status === "saving" ? "저장 중" : "초기 설정 완료" }}
          </button>
        </div>
      </section>
    </section>
  </article>
</template>

<style scoped>
.onboarding-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.onboarding-command,
.setup-panel,
.setup-note,
.setup-summary,
.recommendation-item {
  background: var(--paper);
  border: 1px solid var(--rule);
}

.onboarding-command {
  align-items: end;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  padding: 28px 32px;
}

.onboarding-command h1 {
  color: var(--ink);
  font-size: clamp(36px, 5vw, 68px);
  letter-spacing: 0;
  line-height: 0.96;
  margin: 8px 0 12px;
  max-width: 860px;
}

.onboarding-command p,
.setup-note p,
.setup-summary p {
  color: var(--ink-2);
  margin: 0;
}

.eyebrow,
.setup-panel header span {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  text-transform: uppercase;
}

.step-meter,
.segmented,
.setup-actions,
.setup-toolbar,
.check-row {
  align-items: center;
  display: flex;
  gap: 10px;
}

.step-meter button,
.segmented button,
.preset-grid button,
.setup-actions button,
.setup-toolbar > button,
.holding-row button,
.primary-action {
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  min-height: 40px;
  padding: 0 14px;
}

.step-meter button,
.segmented button {
  min-width: 44px;
}

.step-meter button[data-active="true"],
.segmented button[data-active="true"],
.primary-action {
  background: var(--ink);
  color: var(--paper);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.setup-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) 360px;
}

.setup-flow,
.setup-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setup-panel,
.setup-note,
.setup-summary {
  padding: 22px;
}

.setup-panel header {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
}

.setup-panel header strong,
.setup-note strong,
.setup-summary strong {
  color: var(--ink);
  font-size: 20px;
}

.setup-panel label {
  color: var(--ink-2);
  display: grid;
  gap: 8px;
  font-size: 14px;
}

.setup-panel input {
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  min-height: 40px;
  padding: 0 10px;
}

.setup-note,
.setup-summary {
  display: grid;
  gap: 14px;
}

.setup-toolbar {
  justify-content: space-between;
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
  min-height: 158px;
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

.stock-results {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stock-search {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) 120px;
}

.stock-search input {
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  min-height: 40px;
  padding: 0 10px;
}

.stock-search button,
.stock-result {
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  min-height: 40px;
  padding: 0 14px;
}

.stock-result {
  align-items: start;
  display: grid;
  gap: 5px;
  min-height: 94px;
  padding: 14px;
  text-align: left;
}

.stock-result span,
.stock-result em {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-style: normal;
}

.stock-result strong {
  color: var(--ink);
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holding-table {
  display: grid;
  gap: 8px;
}

.holding-head,
.holding-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(100px, 0.8fr) minmax(140px, 1.2fr) minmax(100px, 0.7fr) 76px;
}

.holding-head {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  text-transform: uppercase;
}

.holding-row {
  border-bottom: 1px solid var(--rule);
  min-height: 48px;
}

.holding-row span {
  color: var(--ink);
}

.compact {
  justify-content: flex-start;
}

@media (max-width: 980px) {
  .onboarding-command,
  .setup-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .setup-grid,
  .recommendation-list,
  .stock-results {
    grid-template-columns: 1fr;
  }

  .stock-search {
    grid-template-columns: 1fr;
  }

  .holding-head {
    display: none;
  }

  .holding-row {
    grid-template-columns: 1fr;
    padding-bottom: 12px;
  }
}

/* Usable wizard shell */
.onboarding-page {
  gap: 18px;
  margin: 0 auto;
  max-width: var(--max);
  padding: 24px clamp(20px, 3vw, 40px) 64px;
}

.setup-hero {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
  display: grid;
  gap: 22px;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.95fr);
  padding: 28px 32px;
}

.setup-hero-copy {
  min-width: 0;
}

.setup-hero-copy h1 {
  color: var(--ink);
  font-family: var(--display);
  font-size: clamp(34px, 4.4vw, 58px);
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1.02;
  margin: 10px 0 12px;
  max-width: 760px;
}

.setup-hero-copy p,
.setup-current p,
.basket-card p {
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.55;
  margin: 0;
}

.setup-steps {
  display: grid;
  gap: 10px;
}

.setup-steps button {
  align-items: center;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-button);
  color: var(--ink);
  cursor: pointer;
  display: grid;
  gap: 3px 14px;
  grid-template-columns: 72px 1fr;
  min-height: 72px;
  padding: 14px 16px;
  text-align: left;
}

.setup-steps button[data-active="true"] {
  border-color: var(--seal);
  box-shadow: inset 3px 0 0 var(--seal);
}

.setup-steps button[data-complete="true"] {
  border-color: color-mix(in oklch, var(--pos) 40%, var(--rule));
}

.setup-steps span,
.setup-steps em,
.setup-current span,
.setup-card header span,
.setup-card dt,
.setup-card li span,
.setup-card li em {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 10.5px;
  font-style: normal;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.setup-steps strong {
  color: var(--ink);
  font-size: 15px;
  grid-column: 2;
}

.setup-steps em {
  grid-column: 2;
  text-transform: none;
}

.setup-current {
  background: var(--paper);
  border: 1px dashed var(--rule-strong);
  border-radius: var(--radius-card);
  display: grid;
  gap: 8px;
  grid-column: 1 / -1;
  padding: 18px 20px;
}

.setup-current strong {
  color: var(--ink);
  font-size: 22px;
}

.setup-workbench {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
}

.setup-card {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  min-width: 0;
  padding: 22px;
}

.setup-card header {
  align-items: baseline;
  border-bottom: 1px solid var(--rule);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 14px;
}

.setup-card header strong,
.setup-side > strong {
  color: var(--ink);
  font-size: 22px;
}

.setup-primary {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.setup-side {
  display: grid;
  gap: 16px;
  align-content: start;
}

.setup-side dl {
  display: grid;
  gap: 0;
  margin: 0;
}

.setup-side dl div {
  align-items: baseline;
  border-top: 1px solid var(--rule);
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
}

.setup-side dl div:first-child {
  border-top: 0;
}

.setup-side dd {
  color: var(--ink);
  font-family: var(--mono);
  font-size: 14px;
  margin: 0;
}

.risk-grid,
.field-grid,
.market-row {
  display: grid;
  gap: 12px;
}

.risk-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.risk-grid button,
.market-row label,
.field-card,
.stock-result,
.recommendation-item {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-button);
  color: var(--ink);
}

.risk-grid button {
  cursor: pointer;
  display: grid;
  gap: 8px;
  min-height: 104px;
  padding: 16px;
  text-align: left;
}

.risk-grid button[data-active="true"],
.market-row label[data-active="true"] {
  border-color: var(--seal);
  box-shadow: inset 0 0 0 1px var(--seal);
}

.risk-grid span,
.market-row span {
  color: var(--ink);
  font-size: 16px;
  font-weight: 700;
}

.risk-grid em,
.market-row em,
.field-card em {
  color: var(--ink-3);
  font-size: 12px;
  font-style: normal;
}

.field-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.field-card {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.field-card span {
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 700;
}

.field-card input,
.stock-search input,
.holding-row input {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-button);
  color: var(--ink);
  font: inherit;
  min-height: 40px;
  min-width: 0;
  padding: 0 12px;
}

.field-card input[type="range"] {
  padding: 0;
}

.market-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.market-row label {
  align-items: center;
  cursor: pointer;
  display: grid;
  gap: 4px 12px;
  grid-template-columns: 20px 1fr;
  padding: 14px 16px;
}

.market-row input {
  grid-row: 1 / span 2;
}

.market-row label[data-disabled="true"] {
  opacity: 0.55;
}

.setup-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin-top: auto;
}

.setup-actions.compact {
  justify-content: flex-start;
  margin-top: 0;
}

.primary-action,
.secondary-action,
.setup-actions > button,
.stock-search button,
.holding-row button {
  border-radius: var(--radius-button);
  font-weight: 700;
}

.primary-action {
  background: var(--seal);
  border-color: var(--seal);
  color: var(--seal-ink);
  min-width: 150px;
}

.secondary-action {
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  color: var(--ink);
  min-height: 42px;
  padding: 0 16px;
}

.segmented {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-button);
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  width: fit-content;
}

.segmented button {
  border: 0;
  border-radius: calc(var(--radius-button) - 3px);
  min-height: 34px;
}

.segmented button[data-active="true"] {
  background: var(--ink);
  color: var(--paper);
}

.stock-picker {
  display: grid;
  gap: 14px;
}

.stock-search {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) 110px;
}

.stock-results {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stock-result {
  cursor: pointer;
  display: grid;
  gap: 6px;
  min-height: 98px;
  padding: 14px;
  text-align: left;
}

.stock-result:hover,
.recommendation-item:hover {
  border-color: var(--rule-strong);
  background: var(--paper-3);
}

.stock-result strong,
.recommendation-item strong {
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-result span,
.stock-result em {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 10.5px;
  font-style: normal;
}

.recommendation-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.recommendation-item {
  cursor: pointer;
  min-height: 160px;
  padding: 16px;
}

.recommendation-item.selected {
  border-color: var(--seal);
}

.basket-card ul {
  display: grid;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}

.basket-card li {
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 4px;
  grid-template-columns: 80px 1fr auto;
  padding: 12px 0;
}

.basket-card li:first-child {
  border-top: 0;
}

.basket-card li strong {
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holding-table {
  display: grid;
  gap: 0;
}

.holding-head,
.holding-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(90px, 0.8fr) minmax(140px, 1.3fr) minmax(100px, 0.8fr) 72px;
}

.holding-head {
  border-bottom: 1px solid var(--rule);
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  padding-bottom: 10px;
  text-transform: uppercase;
}

.holding-row {
  border-bottom: 1px solid var(--rule);
  min-height: 58px;
}

.holding-row > span {
  color: var(--ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setup-summary p {
  color: var(--ink-2);
  line-height: 1.55;
}

@media (max-width: 1100px) {
  .setup-hero,
  .setup-workbench {
    grid-template-columns: 1fr;
  }

  .stock-results,
  .recommendation-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .onboarding-page {
    padding-inline: 16px;
  }

  .setup-hero,
  .setup-card {
    padding: 18px;
  }

  .setup-steps button,
  .risk-grid,
  .field-grid,
  .market-row,
  .stock-results,
  .recommendation-list,
  .stock-search,
  .holding-row {
    grid-template-columns: 1fr;
  }

  .holding-head {
    display: none;
  }

  .setup-actions {
    justify-content: stretch;
  }

  .setup-actions > button,
  .primary-action {
    flex: 1 1 auto;
  }
}
</style>
