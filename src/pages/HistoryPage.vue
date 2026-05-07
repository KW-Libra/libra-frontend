<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";

import {
  createDecisionEvaluation,
  executeKisDemoOrders,
  getDecisionEvaluations,
  getKisDemoOrderProposal,
  getDecisionRun,
  getDecisionRuns,
  type DecisionEvaluationResult,
  type DecisionExecutionOrderItem,
  type DecisionExecutionResult,
  type DecisionRunDetail,
  type DecisionRunSummary,
} from "../api";

const runs = ref<DecisionRunSummary[]>([]);
const detail = ref<DecisionRunDetail | null>(null);
const evaluations = ref<DecisionEvaluationResult[]>([]);
const executions = ref<DecisionExecutionResult[]>([]);
const loading = ref(false);
const loadingDetail = ref(false);
const evaluating = ref(false);
const executing = ref(false);
const quoteBusy = ref(false);
const error = ref("");
const notice = ref("저장된 Judge run을 불러오는 중입니다.");
const orderDraft = ref<
  Record<string, { quantity: number; orderType: "00" | "01"; priceKrw: number }>
>({});

const form = reactive({
  horizon: "1w",
  realizedReturnPct: 0,
  costPct: 0,
  userFeedback: "",
});

const latestRun = computed(() => runs.value[0] ?? null);
const selectedId = computed(() => detail.value?.summary.id ?? "");
const planRows = computed(() =>
  Object.entries(detail.value?.candidate_rebalance_plan ?? {}).sort(
    (left, right) => right[1] - left[1],
  ),
);
const calledAgents = computed(() => detail.value?.called_agents ?? []);
const latestEvaluation = computed(() => evaluations.value[0] ?? null);
const portfolioBaseValue = computed(() => {
  const portfolio = detail.value?.result.portfolio;
  const explicitValue = Number(portfolio?.total_value_krw ?? 0);
  if (explicitValue > 0) return explicitValue;
  return (
    portfolio?.holdings.reduce(
      (sum, holding) => sum + Number(holding.market_value_krw ?? 0),
      0,
    ) ?? 0
  );
});
const executionAllowed = computed(
  () =>
    detail.value?.summary.decision === "REBALANCE" &&
    calledAgents.value.includes("profit") &&
    calledAgents.value.includes("cost") &&
    planRows.value.length > 0,
);
const executableOrders = computed<DecisionExecutionOrderItem[]>(() =>
  planRows.value
    .map(([ticker, weight]) => {
      const draft = orderDraft.value[ticker];
      return {
        ticker,
        side: sideForWeight(weight),
        quantity: Math.max(0, Number(draft?.quantity ?? 0)),
        price_krw: Number(draft?.priceKrw ?? 0),
        order_type: draft?.orderType ?? "01",
      };
    })
    .filter((order) => order.quantity > 0),
);

const decisionTone = computed(() => {
  const status = detail.value?.summary.decision;
  if (status === "REBALANCE") return "pos";
  if (status === "USER_DECISION_REQUIRED") return "neg";
  if (status === "DEFER") return "warn";
  return "neutral";
});

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRatio(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(2);
}

function formatKrw(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function decisionLabel(decision: string | null | undefined) {
  const labels: Record<string, string> = {
    HOLD: "Hold",
    DEFER: "Defer",
    REBALANCE: "Rebalance",
    USER_DECISION_REQUIRED: "User decides",
  };
  return decision ? (labels[decision] ?? decision) : "No runs";
}

function boolLabel(value: boolean | null) {
  if (value == null) return "-";
  return value ? "맞음" : "빗나감";
}

function executionGateLabel() {
  if (!detail.value) return "판단을 먼저 선택하세요.";
  if (detail.value.summary.decision !== "REBALANCE")
    return "REBALANCE 판단에서만 주문 실행을 열어둡니다.";
  if (!calledAgents.value.includes("profit") || !calledAgents.value.includes("cost")) {
    return "Profit/Cost 검토가 끝난 REBALANCE만 실행할 수 있습니다.";
  }
  if (!planRows.value.length) return "실행할 후보 리밸런싱 플랜이 없습니다.";
  return "모의투자만 지원합니다. 수량이 0인 행은 전송하지 않습니다.";
}

function sideForWeight(weight: number): "BUY" | "SELL" {
  return weight >= 0 ? "BUY" : "SELL";
}

function sideLabel(weight: number) {
  return sideForWeight(weight) === "BUY" ? "매수" : "매도";
}

function resetOrderDraft(runDetail: DecisionRunDetail) {
  const next: Record<
    string,
    { quantity: number; orderType: "00" | "01"; priceKrw: number }
  > = {};
  Object.keys(runDetail.candidate_rebalance_plan ?? {}).forEach((ticker) => {
    next[ticker] = { quantity: 0, orderType: "01", priceKrw: 0 };
  });
  orderDraft.value = next;
}

async function autoDraftKisOrders() {
  if (!detail.value || !planRows.value.length) return;
  if (portfolioBaseValue.value <= 0) {
    notice.value = "주문 수량 산출에 사용할 포트폴리오 평가금액이 없습니다.";
    return;
  }

  quoteBusy.value = true;
  error.value = "";
  try {
    const proposals = await getKisDemoOrderProposal(detail.value.summary.id);
    const next = { ...orderDraft.value };
    const skipped: string[] = [];
    let ready = 0;

    for (const proposal of proposals) {
      next[proposal.ticker] = {
        quantity: proposal.quantity,
        orderType: proposal.order_type ?? "01",
        priceKrw: Number(proposal.price_krw ?? 0),
      };

      if (proposal.quantity > 0) {
        ready += 1;
      } else {
        skipped.push(proposal.ticker);
      }
    }

    orderDraft.value = next;
    notice.value = skipped.length
      ? `KIS 현재가로 ${ready}개 주문 수량을 산출했습니다. 제외: ${skipped.join(", ")}`
      : `KIS 현재가로 ${ready}개 주문 수량을 산출했습니다. 기준 평가금액 ${formatKrw(portfolioBaseValue.value)}.`;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
    notice.value = "KIS 현재가 기반 주문 수량 산출에 실패했습니다.";
  } finally {
    quoteBusy.value = false;
  }
}

async function loadRuns() {
  loading.value = true;
  error.value = "";
  try {
    runs.value = await getDecisionRuns();
    notice.value = runs.value.length
      ? "최근 20개의 사용자별 판단 이력입니다."
      : "아직 저장된 Judge run이 없습니다.";
    if (runs.value[0]) {
      await selectRun(runs.value[0].id);
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
    notice.value = "판단 이력을 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}

async function selectRun(id: string) {
  loadingDetail.value = true;
  error.value = "";
  try {
    const [runDetail, runEvaluations] = await Promise.all([
      getDecisionRun(id),
      getDecisionEvaluations(id),
    ]);
    detail.value = runDetail;
    evaluations.value = runEvaluations;
    executions.value = runDetail.executions ?? [];
    resetOrderDraft(runDetail);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    loadingDetail.value = false;
  }
}

async function submitDemoOrders() {
  if (!detail.value || !executableOrders.value.length) return;
  executing.value = true;
  error.value = "";
  try {
    const saved = await executeKisDemoOrders(detail.value.summary.id, {
      orders: executableOrders.value,
      dry_run: false,
    });
    executions.value = [...saved, ...executions.value];
    resetOrderDraft(detail.value);
    notice.value = "KIS 모의투자 주문을 저장했습니다.";
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    executing.value = false;
  }
}

async function submitEvaluation() {
  if (!detail.value) return;
  evaluating.value = true;
  error.value = "";
  try {
    const saved = await createDecisionEvaluation(detail.value.summary.id, {
      horizon: form.horizon,
      realized_return_pct: Number(form.realizedReturnPct),
      cost_pct: Number(form.costPct),
      user_feedback: form.userFeedback.trim() || null,
    });
    evaluations.value = [
      saved,
      ...evaluations.value.filter((item) => item.horizon !== saved.horizon),
    ];
    form.userFeedback = "";
    notice.value = "평가가 저장됐습니다.";
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    evaluating.value = false;
  }
}

onMounted(loadRuns);
</script>

<template>
  <article class="board">
    <!-- ── HERO ─────────────────────────────────────────────── -->
    <section class="board-hero">
      <div class="hero-figure-block">
        <span class="hero-eyebrow">Decision Memory · {{ runs.length }} runs</span>
        <h2 class="hero-figure">
          <span>{{ runs.length }}</span>
          <small>runs</small>
        </h2>
        <div class="hero-delta">
          <span class="delta-meta">latest · {{ formatDate(latestRun?.created_at) }}</span>
          <span class="delta-meta">
            confidence · {{ formatRatio(latestRun?.confidence, 0) }}
          </span>
        </div>
      </div>

      <div class="hero-actions">
        <button class="cta-line" type="button" :disabled="loading" @click="loadRuns">
          {{ loading ? "Refreshing" : "Refresh" }}
        </button>
        <RouterLink class="cta-solid" to="/dashboard">Dashboard</RouterLink>
      </div>
    </section>

    <!-- ── STATS ─────────────────────────────────────────────── -->
    <section class="board-stats">
      <div class="stat">
        <span>Latest verdict</span>
        <strong>{{ decisionLabel(latestRun?.decision) }}</strong>
        <em>{{ latestRun?.urgency ?? "—" }}</em>
      </div>
      <div class="stat">
        <span>Confidence</span>
        <strong>{{ formatRatio(latestRun?.confidence, 0) }}</strong>
        <em>{{ latestRun?.model ?? "—" }}</em>
      </div>
      <div class="stat">
        <span>Consensus</span>
        <strong>{{ formatScore(latestRun?.consensus_score) }}</strong>
        <em>divergence {{ formatScore(latestRun?.divergence_score) }}</em>
      </div>
      <div class="stat">
        <span>Evaluations</span>
        <strong>{{ evaluations.length }}</strong>
        <em>latest · {{ latestEvaluation?.horizon ?? "—" }}</em>
      </div>
    </section>

    <p v-if="error" class="board-error">{{ error }}</p>

    <!-- ── TWO-COL: RUN LIST + DETAIL ─────────────────────── -->
    <section class="history-layout">
      <aside class="history-list">
        <header class="list-head">
          <span class="block-eyebrow">Saved decisions</span>
          <span class="block-meta">{{ runs.length }}</span>
        </header>
        <p v-if="!runs.length" class="pair-empty">
          Dashboard에서 Run Judge를 실행하면 이곳에 기록됩니다.
        </p>
        <ol v-else class="run-feed">
          <li v-for="run in runs" :key="run.id">
            <button
              class="run-row"
              type="button"
              :data-active="selectedId === run.id"
              @click="selectRun(run.id)"
            >
              <span class="run-row-id">{{ shortId(run.id) }}</span>
              <span class="run-row-verdict">
                {{ decisionLabel(run.decision) }} · {{ run.urgency }}
              </span>
              <span class="run-row-meta">{{ run.model }} · {{ run.trigger_type }}</span>
              <span class="run-row-query">{{ run.query }}</span>
              <time class="run-row-time">{{ formatDate(run.created_at) }}</time>
            </button>
          </li>
        </ol>
      </aside>

      <section v-if="detail" class="history-detail">
        <!-- Selected run banner -->
        <section class="board-verdict" :data-tone="decisionTone">
          <div class="verdict-copy">
            <span class="verdict-eyebrow">Run · {{ shortId(detail.summary.id) }}</span>
            <h3>{{ decisionLabel(detail.summary.decision) }}</h3>
            <p>"{{ detail.summary.query }}"</p>
          </div>
          <div class="verdict-meta">
            <span class="verdict-conf">
              confidence
              <strong>{{ formatRatio(detail.summary.confidence, 0) }}</strong>
            </span>
            <span class="verdict-when">
              {{ calledAgents.length }} agents · {{ planRows.length }} plan rows
            </span>
            <RouterLink class="verdict-cta" to="/decision">Open trace →</RouterLink>
          </div>
        </section>

        <!-- After-action + execution gate -->
        <section class="board-pair">
          <article class="pair-block">
            <header>
              <span class="block-eyebrow">After-action</span>
              <span class="block-meta">
                {{ latestEvaluation?.verdict ?? "Not reviewed" }}
              </span>
            </header>
            <p class="block-body">
              {{
                latestEvaluation
                  ? `${latestEvaluation.horizon} · ${formatDate(latestEvaluation.evaluated_at)}`
                  : "사후 평가를 저장하면 다음 판단의 회고로 반영됩니다."
              }}
            </p>
          </article>
          <article class="pair-block">
            <header>
              <span class="block-eyebrow">Execution gate</span>
              <span class="block-meta">{{ executableOrders.length }} ready</span>
            </header>
            <p class="block-body">{{ executionGateLabel() }}</p>
          </article>
        </section>

        <!-- Plan table -->
        <section class="data-block">
          <header>
            <span class="block-eyebrow">Candidate rebalance plan</span>
            <span class="block-meta">
              {{ planRows.length }} rows · base {{ formatKrw(portfolioBaseValue) }}
            </span>
          </header>
          <div v-if="planRows.length" class="plain-table-wrap">
            <table class="plain-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th>Delta</th>
                  <th>Qty</th>
                  <th>Type</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[ticker, weight] in planRows" :key="ticker">
                  <td class="mono">{{ ticker }}</td>
                  <td>{{ sideLabel(weight) }}</td>
                  <td :data-tone="weight >= 0 ? 'pos' : 'neg'">
                    {{ formatRatio(weight, 1) }}
                  </td>
                  <td>
                    <input
                      v-if="orderDraft[ticker]"
                      v-model.number="orderDraft[ticker].quantity"
                      class="cell-input"
                      min="0"
                      type="number"
                    />
                  </td>
                  <td>
                    <select
                      v-if="orderDraft[ticker]"
                      v-model="orderDraft[ticker].orderType"
                      class="cell-input"
                    >
                      <option value="01">시장가</option>
                      <option value="00">지정가</option>
                    </select>
                  </td>
                  <td>
                    <input
                      v-if="orderDraft[ticker]"
                      v-model.number="orderDraft[ticker].priceKrw"
                      class="cell-input"
                      :disabled="orderDraft[ticker].orderType === '01'"
                      min="0"
                      step="1"
                      type="number"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="pair-empty">이 판단에는 리밸런싱 후보 비중이 없습니다.</p>
          <div v-if="planRows.length" class="block-action-row">
            <p>{{ executionGateLabel() }}</p>
            <div class="execution-actions">
              <button
                class="cta-line"
                type="button"
                :disabled="quoteBusy || !planRows.length"
                @click="autoDraftKisOrders"
              >
                {{ quoteBusy ? "가격 조회 중" : "KIS 현재가로 수량 산출" }}
              </button>
              <button
                class="cta-solid"
                type="button"
                :disabled="executing || !executionAllowed || !executableOrders.length"
                @click="submitDemoOrders"
              >
                {{ executing ? "Submitting" : "Send demo orders" }}
              </button>
            </div>
          </div>
        </section>

        <!-- Executions list -->
        <section v-if="executions.length" class="data-block">
          <header>
            <span class="block-eyebrow">Executions</span>
            <span class="block-meta">{{ executions.length }}</span>
          </header>
          <div class="plain-table-wrap">
            <table class="plain-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Order no</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="execution in executions"
                  :key="`${execution.id}-${execution.created_at}`"
                >
                  <td class="mono">{{ execution.ticker }}</td>
                  <td>{{ execution.side === "BUY" ? "매수" : "매도" }}</td>
                  <td>{{ execution.quantity }}</td>
                  <td class="mono">{{ execution.order_no ?? "—" }}</td>
                  <td>{{ execution.status }} · {{ execution.message ?? "—" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Trade evaluation -->
        <section class="data-block">
          <header>
            <span class="block-eyebrow">Trade evaluation</span>
            <span class="block-meta">
              {{ evaluations.length }} records · {{ latestEvaluation?.verdict ?? "No evaluation" }}
            </span>
          </header>
          <div v-if="evaluations.length" class="plain-table-wrap">
            <table class="plain-table">
              <thead>
                <tr>
                  <th>Horizon</th>
                  <th>Verdict</th>
                  <th>Direction</th>
                  <th>Cost</th>
                  <th>Evaluated</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="evaluation in evaluations"
                  :key="`${evaluation.id}-${evaluation.horizon}`"
                >
                  <td>{{ evaluation.horizon }}</td>
                  <td>{{ evaluation.verdict }}</td>
                  <td>{{ boolLabel(evaluation.direction_accuracy) }}</td>
                  <td>{{ formatScore(evaluation.cost_efficiency) }}</td>
                  <td>{{ formatDate(evaluation.evaluated_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <form class="eval-form" @submit.prevent="submitEvaluation">
            <label class="eval-field">
              <span>Horizon</span>
              <select v-model="form.horizon" class="cell-input">
                <option value="1w">1w</option>
                <option value="1m">1m</option>
                <option value="3m">3m</option>
              </select>
            </label>
            <label class="eval-field">
              <span>Return %</span>
              <input
                v-model.number="form.realizedReturnPct"
                class="cell-input"
                required
                type="number"
                step="0.01"
              />
            </label>
            <label class="eval-field">
              <span>Cost %</span>
              <input
                v-model.number="form.costPct"
                class="cell-input"
                type="number"
                step="0.01"
              />
            </label>
            <label class="eval-field eval-field-wide">
              <span>Feedback</span>
              <textarea
                v-model="form.userFeedback"
                class="cell-input cell-textarea"
                rows="3"
              />
            </label>
            <button class="cta-solid" type="submit" :disabled="evaluating">
              {{ evaluating ? "Evaluating" : "Save evaluation" }}
            </button>
          </form>
        </section>
      </section>

      <section v-else class="history-detail history-detail-empty">
        <p class="pair-empty">왼쪽에서 판단을 선택하세요.</p>
      </section>
    </section>

    <p class="board-notice">{{ notice }}</p>
  </article>
</template>

<style scoped>
.board-error {
  border: 1px solid var(--neg);
  border-left-width: 3px;
  color: var(--neg);
  font-size: 13px;
  margin: 0;
  padding: 10px 14px;
}

.history-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
}
@media (max-width: 1080px) {
  .history-layout {
    grid-template-columns: 1fr;
  }
}

.history-list {
  border-right: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 18px;
}
@media (max-width: 1080px) {
  .history-list {
    border-right: 0;
    padding-right: 0;
  }
}
.list-head {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding-bottom: 6px;
}
.run-feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.run-row {
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 0;
  color: var(--ink);
  cursor: pointer;
  display: grid;
  gap: 4px;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto auto auto;
  padding: 12px 14px;
  text-align: left;
  transition: border-color 120ms ease, background 120ms ease;
}
.run-row:hover {
  border-color: var(--rule-strong);
}
.run-row[data-active="true"] {
  background: var(--paper-2);
  border-color: var(--ink);
}
.run-row-id {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  grid-column: 1 / 2;
  letter-spacing: 0.06em;
}
.run-row-time {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  grid-column: 2 / 3;
  text-align: right;
}
.run-row-verdict {
  font-size: 14px;
  font-weight: 600;
  grid-column: 1 / -1;
}
.run-row-meta {
  color: var(--ink-3);
  font-size: 11px;
  grid-column: 1 / -1;
}
.run-row-query {
  color: var(--ink-2);
  font-size: 12px;
  grid-column: 1 / -1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.history-detail-empty {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 240px;
}

.data-block {
  border-top: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
}
.data-block > header {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.block-body {
  color: var(--ink-2);
  font-size: 13px;
  margin: 0;
}
.block-action-row {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}
.block-action-row p {
  color: var(--ink-3);
  font-size: 12px;
  margin: 0;
}
.execution-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.plain-table-wrap {
  overflow-x: auto;
}
.plain-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}
.plain-table th,
.plain-table td {
  border-bottom: 1px solid var(--rule);
  padding: 10px 12px;
  text-align: left;
}
.plain-table th {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.plain-table td.mono {
  font-family: "JetBrains Mono", monospace;
  font-feature-settings: "tnum";
}
.plain-table td[data-tone="pos"] {
  color: var(--pos);
}
.plain-table td[data-tone="neg"] {
  color: var(--neg);
}

.cell-input {
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: 0;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
  padding: 6px 8px;
  width: 100%;
}
.cell-input:focus {
  border-color: var(--ink);
  outline: none;
}
.cell-input:disabled {
  background: var(--paper-2);
  color: var(--ink-3);
}
.cell-textarea {
  font-family: inherit;
  resize: vertical;
}

.eval-form {
  align-items: end;
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding-top: 14px;
}
@media (max-width: 720px) {
  .eval-form {
    grid-template-columns: 1fr 1fr;
  }
}
.eval-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.eval-field span {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.eval-field-wide {
  grid-column: 1 / -1;
}
.eval-form > .cta-solid {
  grid-column: 1 / -1;
  justify-self: end;
}
</style>
