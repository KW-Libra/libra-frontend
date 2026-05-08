<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";

import AgentFlow from "../components/viz/AgentFlow.vue";
import ConfidenceGauge from "../components/viz/ConfidenceGauge.vue";
import PlanDelta from "../components/viz/PlanDelta.vue";
import { useAnimatedNumber } from "../composables/useAnimatedNumber";
import { formatKrw, useJudgeState } from "../composables/useJudgeState";
import { rebalancePlanToDeltas } from "../view-model";
import type { AgentResponse, DomainSignal } from "../api";

const {
  portfolioState,
  judgeState,
  currentTurn,
  portfolioNotice,
  holdings,
  totalValue,
  agents,
  calledCount,
  skippedCount,
  timeline,
  decisionBadge,
  confidence,
  consensusScore,
  urgency,
  latestRun,
  syncPortfolio,
  runJudge,
  setCurrentTurn,
  ensureLoaded,
} = useJudgeState();

const portfolioBusy = computed(
  () => portfolioState.value === "loading" || portfolioState.value === "syncing",
);
const judgeBusy = computed(() => judgeState.value === "running");

const decisionShort = computed(() => {
  const map: Record<string, string> = {
    HOLD: "Hold",
    DEFER: "Defer",
    REBALANCE: "Rebalance",
    USER_DECISION_REQUIRED: "확인 필요",
  };
  return map[decisionBadge.value.status] ?? decisionBadge.value.status;
});

const decisionTone = computed<"pos" | "neg" | "warn" | "neutral">(() => {
  const status = decisionBadge.value.status;
  if (status === "REBALANCE") return "pos";
  if (status === "USER_DECISION_REQUIRED") return "neg";
  if (status === "DEFER") return "warn";
  return "neutral";
});

const urgencyHint = computed(() => {
  if (urgency.value === "immediate") return "즉시";
  if (urgency.value === "scheduled") return "예약";
  if (urgency.value === "defer") return "다음";
  return "관망";
});

const allTurns = computed(() => {
  const turns = new Set<number>();
  timeline.value.forEach((step) => {
    const num = Number(step.turn.replace(/^T/, ""));
    if (Number.isFinite(num)) turns.add(num);
  });
  const trace = latestRun.value?.decision?.decision_trace ?? [];
  trace.forEach((entry) => turns.add(entry.turn_number));
  if (turns.size === 0) turns.add(1);
  return [...turns].sort((a, b) => a - b);
});
const lastTurnNumber = computed(() => allTurns.value.at(-1) ?? 1);

const selectedTrace = computed(() => {
  const trace = latestRun.value?.decision?.decision_trace ?? [];
  return trace.filter((entry) => entry.turn_number === currentTurn.value);
});

const candidatePlan = computed(
  () => latestRun.value?.decision?.candidate_rebalance_plan ?? {},
);
const candidatePlanDelta = computed(() => rebalancePlanToDeltas(candidatePlan.value, holdings.value));

type DomainAgentCard = {
  key: string;
  label: string;
  codename: string;
  response: AgentResponse | null;
  vote: string;
  confidence: number | null;
  rationale: string;
  signals: DomainSignal[];
  llmUsed: string;
  adversarialReview: boolean;
};

const domainAgentMeta = [
  { key: "risk", label: "Risk", codename: "Vora" },
  { key: "tax", label: "Tax", codename: "Reed" },
  { key: "compliance", label: "Compliance", codename: "Clarke" },
  { key: "macro", label: "Macro", codename: "Halden" },
  { key: "sentiment", label: "Sentiment", codename: "Imo" },
  { key: "execution", label: "Execution", codename: "Tien" },
  { key: "esg", label: "ESG", codename: "Esme" },
] as const;

const domainAgentCards = computed<DomainAgentCard[]>(() => {
  const responses = latestRun.value?.agent_responses ?? [];
  return domainAgentMeta.map((meta) => {
    const response = responses.find((item) => isDomainAgentResponse(item, meta.key)) ?? null;
    const llmUsed = String(response?.llm_used ?? response?.model_used ?? "");
    const vote = normalizeVote(response);
    return {
      ...meta,
      response,
      vote,
      confidence: response?.confidence ?? null,
      rationale: response?.reasoning_for_judge_agent ?? "아직 도메인 에이전트 응답이 없습니다.",
      signals: parseDomainSignals(response),
      llmUsed,
      adversarialReview: hasAdversarialReview(llmUsed),
    };
  });
});

const hasDomainResponses = computed(() =>
  domainAgentCards.value.some((card) => card.response),
);

const complianceReject = computed(() => {
  const compliance = domainAgentCards.value.find((card) => card.key === "compliance");
  return compliance?.vote === "reject";
});

const holdingNames = computed(() => {
  const map: Record<string, string> = {};
  holdings.value.forEach((h) => {
    map[h.ticker] = h.name;
  });
  return map;
});

const animatedTurn = useAnimatedNumber(() => currentTurn.value, 400);
const runKey = computed(() => latestRun.value?.runtime?.thread_id ?? null);
const liveTone = computed<"live" | "demo" | "running" | "error">(() => {
  if (judgeState.value === "running") return "running";
  if (portfolioState.value === "error" || judgeState.value === "error") return "error";
  if (portfolioState.value === "live") return "live";
  return "demo";
});
const liveLabel = computed(() => {
  if (liveTone.value === "running") return "JUDGE RUNNING";
  if (liveTone.value === "error") return "ERROR";
  if (liveTone.value === "live") return "LIVE";
  return "DEMO";
});

const phaseLabel = (phase: string) => {
  const map: Record<string, string> = {
    information_gathering: "정보 확인",
    deliberation: "검토",
    domain_consensus: "도메인 합의",
    compliance_check: "컴플라이언스",
    consensus: "신호 종합",
    decision: "최종 판단",
  };
  return map[phase] ?? phase;
};

function isDomainAgentResponse(response: AgentResponse, key: string) {
  const id = response.agent_id.toLowerCase().replace(/[\s_-]/g, "");
  const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, "");
  return id === normalizedKey || id.startsWith(normalizedKey) || id.includes(`${normalizedKey}agent`);
}

function normalizeVote(response: AgentResponse | null) {
  const vote = response?.vote?.toLowerCase();
  if (vote === "approve" || vote === "reject" || vote === "abstain") return vote;
  if (!response) return "pending";
  if (response.direction > 0.05) return "approve";
  if (response.direction < -0.05) return "reject";
  return "abstain";
}

function parseDomainSignals(response: AgentResponse | null): DomainSignal[] {
  if (!response) return [];
  const direct = coerceDomainSignals(response.domain_signals);
  if (direct.length) return direct;
  return coerceDomainSignals(response.domain_signals_json);
}

function coerceDomainSignals(value: unknown): DomainSignal[] {
  let parsed = value;
  for (let i = 0; i < 3; i += 1) {
    if (Array.isArray(parsed)) return parsed.filter(isDomainSignal);
    if (typeof parsed !== "string") return [];
    const text = parsed.trim();
    if (!text) return [];
    if (!text.startsWith("[") && !text.startsWith("{") && !text.startsWith("\"")) return [];
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed.filter(isDomainSignal) : [];
}

function isDomainSignal(value: unknown): value is DomainSignal {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function signalLabel(signal: DomainSignal) {
  const label = signal.label ?? signal.name ?? signal.key ?? "signal";
  const value = signal.value ?? signal.score ?? signal.result ?? "";
  return value === "" ? String(label) : `${String(label)}: ${String(value)}`;
}

function hasAdversarialReview(model: string) {
  const normalized = model.toLowerCase();
  return normalized.includes("+claude") || (normalized.includes("gemini") && normalized.includes("claude"));
}

onMounted(ensureLoaded);
</script>

<template>
  <article class="board">
    <section v-if="complianceReject" class="compliance-banner">
      <strong>Compliance 거부 → 사용자 결정 필요</strong>
      <span>Clarke가 사용자 IPS 또는 제외 룰 위반 가능성을 감지했습니다.</span>
    </section>

    <!-- ── HERO ─────────────────────────────────────────────── -->
    <section class="board-hero hero-3col">
      <div class="hero-figure-block">
        <span class="hero-eyebrow">
          Decision Trace · {{ decisionShort }}
          <span class="live-pill" :data-tone="liveTone">
            <span class="live-dot" aria-hidden="true"></span>
            {{ liveLabel }}
          </span>
        </span>
        <h2 class="hero-figure">
          <span>turn {{ Math.round(animatedTurn) }}</span>
          <small> / {{ lastTurnNumber }}</small>
        </h2>
        <div class="hero-delta">
          <span class="delta-meta">{{ urgencyHint }} · {{ calledCount }} consulted</span>
          <span class="delta-meta">{{ skippedCount }} skipped</span>
          <span class="delta-meta">{{ holdings.length }} holdings · {{ formatKrw(totalValue) }}원</span>
        </div>
      </div>

      <ConfidenceGauge
        class="hero-gauge"
        :confidence="confidence"
        :consensus="consensusScore"
        :tone="decisionTone"
        :label="decisionShort"
      />

      <div class="hero-actions hero-actions-stack">
        <button
          class="cta-solid"
          type="button"
          :disabled="judgeBusy"
          @click="runJudge"
        >
          {{ judgeBusy ? "Judge 실행 중" : "다시 Judge" }}
        </button>
        <button
          class="cta-line"
          type="button"
          :disabled="portfolioBusy"
          @click="syncPortfolio"
        >
          {{ portfolioBusy ? "Sync 중" : "KIS 재동기화" }}
        </button>
        <RouterLink class="hero-link" to="/dashboard">Dashboard로 →</RouterLink>
      </div>
    </section>

    <!-- ── ORCHESTRATION (turn-aware) ───────────────────────── -->
    <AgentFlow
      :agents="agents"
      :decision-label="decisionShort"
      :decision-tone="decisionTone"
      :active-turn="currentTurn"
      :judge-state="judgeState"
      :run-key="runKey"
    />

    <!-- ── DOMAIN AGENTS ────────────────────────────────────── -->
    <section class="domain-agents">
      <header>
        <span class="block-eyebrow">도메인 에이전트 합의 (7)</span>
        <span class="block-meta">{{ hasDomainResponses ? "Phase 7 trace" : "waiting for backend signals" }}</span>
      </header>
      <div class="domain-grid">
        <article
          v-for="card in domainAgentCards"
          :key="card.key"
          class="domain-card"
          :data-vote="card.vote"
          :data-empty="!card.response"
        >
          <header>
            <div>
              <strong>{{ card.label }}</strong>
              <span>{{ card.codename }}</span>
            </div>
            <span class="vote-pill" :data-vote="card.vote">{{ card.vote }}</span>
          </header>
          <p class="domain-confidence">
            confidence
            <strong>{{ card.confidence == null ? "—" : `${Math.round(card.confidence * 100)}%` }}</strong>
          </p>
          <p class="domain-rationale" :title="card.rationale">{{ card.rationale }}</p>
          <span v-if="card.adversarialReview" class="review-badge">Gemini × Claude 적대 검토</span>
          <details class="signal-details">
            <summary>signals · {{ card.signals.length }}</summary>
            <ul v-if="card.signals.length">
              <li v-for="(signal, index) in card.signals" :key="`${card.key}-${index}`">
                {{ signalLabel(signal) }}
              </li>
            </ul>
            <p v-else>기록된 domain signal이 없습니다.</p>
          </details>
        </article>
      </div>
    </section>

    <!-- ── TURN STRIP ────────────────────────────────────────── -->
    <section v-if="allTurns.length > 1" class="trace-turns">
      <span class="block-eyebrow">Turn 선택</span>
      <div class="turn-row">
        <button
          v-for="turn in allTurns"
          :key="turn"
          type="button"
          class="turn-pill"
          :data-active="turn === currentTurn"
          @click="setCurrentTurn(turn)"
        >
          {{ String(turn).padStart(2, "0") }}
        </button>
      </div>
    </section>

    <!-- ── SELECTED TURN: TRACE ENTRIES + PLAN ──────────────── -->
    <section class="board-pair viz-pair">
      <article class="trace-detail">
        <header>
          <span class="block-eyebrow">Turn {{ currentTurn }} · trace</span>
          <span class="block-meta">{{ selectedTrace.length }} entries</span>
        </header>
        <ol v-if="selectedTrace.length" class="trace-entries">
          <li
            v-for="(entry, idx) in selectedTrace"
            :key="`${entry.turn_number}-${idx}-${entry.actor}`"
            :data-phase="entry.phase"
          >
            <span class="trace-seq">{{ String(idx + 1).padStart(2, "0") }}</span>
            <div class="trace-body">
              <header>
                <strong>{{ entry.actor }}</strong>
                <span class="trace-phase">{{ phaseLabel(entry.phase) }}</span>
              </header>
              <p class="trace-summary">
                {{ entry.summary || entry.note || entry.query || "—" }}
              </p>
              <p v-if="entry.context" class="trace-context">{{ entry.context }}</p>
            </div>
          </li>
        </ol>
        <p v-else class="trace-empty">
          선택된 turn에 trace 항목이 없습니다.
        </p>
      </article>

      <PlanDelta :plan="candidatePlanDelta" :names="holdingNames" />
    </section>

    <!-- ── TIMELINE ──────────────────────────────────────────── -->
    <section class="board-timeline">
      <header>
        <span class="block-eyebrow">전체 trace</span>
        <RouterLink class="block-link" to="/history">history →</RouterLink>
      </header>
      <ol>
        <li
          v-for="step in timeline"
          :key="`${step.turn}-${step.actor}-${step.title}`"
          :data-state="step.state"
        >
          <span class="t-turn">{{ step.turn }}</span>
          <div class="t-body">
            <strong>{{ step.actor }} · {{ step.title }}</strong>
            <p>{{ step.body }}</p>
          </div>
        </li>
      </ol>
    </section>

    <p class="board-notice">{{ portfolioNotice }}</p>
  </article>
</template>

<style scoped>
.hero-3col {
  align-items: center;
  display: grid;
  gap: 36px;
  grid-template-columns: minmax(0, 1fr) auto auto;
}
@media (max-width: 1080px) {
  .hero-3col {
    gap: 24px;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .hero-actions-stack {
    grid-column: 1 / -1;
    flex-direction: row;
  }
}
@media (max-width: 720px) {
  .hero-3col {
    grid-template-columns: 1fr;
  }
}
.hero-3col .hero-figure-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.compliance-banner {
  align-items: center;
  border: 1px solid var(--neg);
  border-left-width: 4px;
  color: var(--neg);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px 16px;
}
.compliance-banner strong {
  font-size: 14px;
}
.compliance-banner span {
  color: var(--ink-2);
  font-size: 12px;
}
@media (max-width: 720px) {
  .compliance-banner {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}

.hero-actions-stack {
  align-items: stretch;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 168px;
}
.hero-link {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  margin-top: 4px;
  text-align: right;
  text-decoration: none;
}
.hero-link:hover {
  color: var(--ink);
}

.live-pill {
  align-items: center;
  border: 1px solid var(--rule-strong);
  color: var(--ink-2);
  display: inline-flex;
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 600;
  gap: 5px;
  letter-spacing: 0.14em;
  margin-left: 8px;
  padding: 2px 8px;
  text-transform: uppercase;
  vertical-align: middle;
}
.live-pill[data-tone="live"] { border-color: var(--pos); color: var(--pos); }
.live-pill[data-tone="running"] { border-color: var(--seal); color: var(--seal); }
.live-pill[data-tone="error"] { border-color: var(--neg); color: var(--neg); }
.live-dot {
  background: currentColor;
  border-radius: 50%;
  display: inline-block;
  height: 5px;
  width: 5px;
  animation: live-dot-pulse 1.8s ease-in-out infinite;
}
.live-pill[data-tone="running"] .live-dot {
  animation-duration: 0.7s;
}
.live-pill[data-tone="error"] .live-dot { animation: none; }
@keyframes live-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.6); }
}

.hero-figure span {
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

.turn-pill {
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.turn-pill:hover {
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .live-dot { animation: none; }
  .turn-pill:hover { transform: none; }
}

.trace-turns {
  align-items: center;
  display: flex;
  gap: 14px;
  padding: 10px 0;
}
.turn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.turn-pill {
  background: transparent;
  border: 1px solid var(--rule-strong);
  color: var(--ink-2);
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  padding: 6px 12px;
}
.turn-pill:hover {
  border-color: var(--ink-2);
  color: var(--ink);
}
.turn-pill[data-active="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--paper);
}

.domain-agents {
  border-top: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 18px;
}
.domain-agents > header {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.domain-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
@media (max-width: 1280px) {
  .domain-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 860px) {
  .domain-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .domain-grid {
    grid-template-columns: 1fr;
  }
}
.domain-card {
  border: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 188px;
  padding: 14px;
}
.domain-card[data-empty="true"] {
  opacity: 0.62;
}
.domain-card[data-vote="approve"] {
  border-top-color: var(--pos);
}
.domain-card[data-vote="reject"] {
  border-top-color: var(--neg);
}
.domain-card[data-vote="abstain"] {
  border-top-color: var(--ink-3);
}
.domain-card > header {
  align-items: flex-start;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}
.domain-card strong {
  color: var(--ink);
  display: block;
  font-size: 13px;
  font-weight: 700;
}
.domain-card header span:not(.vote-pill) {
  color: var(--ink-3);
  display: block;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  margin-top: 2px;
}
.vote-pill {
  border: 1px solid var(--rule-strong);
  color: var(--ink-3);
  flex: 0 0 auto;
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 6px;
  text-transform: uppercase;
}
.vote-pill[data-vote="approve"] {
  border-color: var(--pos);
  color: var(--pos);
}
.vote-pill[data-vote="reject"] {
  border-color: var(--neg);
  color: var(--neg);
}
.vote-pill[data-vote="abstain"] {
  border-color: var(--ink-3);
  color: var(--ink-3);
}
.domain-confidence {
  align-items: baseline;
  color: var(--ink-3);
  display: flex;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  gap: 6px;
  letter-spacing: 0.06em;
  margin: 0;
  text-transform: uppercase;
}
.domain-confidence strong {
  color: var(--ink-2);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
}
.domain-rationale {
  color: var(--ink-2);
  display: -webkit-box;
  font-size: 12px;
  line-height: 1.45;
  margin: 0;
  min-height: 34px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.review-badge {
  align-self: flex-start;
  border: 1px solid var(--seal);
  color: var(--seal);
  font-size: 10px;
  font-weight: 700;
  padding: 3px 6px;
}
.signal-details {
  margin-top: auto;
}
.signal-details summary {
  color: var(--ink-3);
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
}
.signal-details ul {
  color: var(--ink-2);
  display: flex;
  flex-direction: column;
  font-size: 11px;
  gap: 4px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.signal-details p {
  color: var(--ink-3);
  font-size: 11px;
  margin: 8px 0 0;
}

.viz-pair {
  align-items: stretch;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
}
@media (max-width: 1080px) {
  .viz-pair {
    grid-template-columns: 1fr;
  }
}

.trace-detail {
  border: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 24px;
}
.trace-detail > header {
  align-items: baseline;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.trace-empty {
  color: var(--ink-3);
  font-size: 13px;
  margin: 0;
  padding: 14px 0;
}
.trace-entries {
  display: flex;
  flex-direction: column;
  gap: 14px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.trace-entries > li {
  border-left: 2px solid var(--rule-strong);
  display: grid;
  gap: 14px;
  grid-template-columns: 30px 1fr;
  padding: 4px 0 4px 16px;
}
.trace-entries > li[data-phase="information_gathering"] {
  border-left-color: var(--ink-2);
}
.trace-entries > li[data-phase="deliberation"] {
  border-left-color: var(--warn);
}
.trace-entries > li[data-phase="consensus"] {
  border-left-color: var(--brass);
}
.trace-entries > li[data-phase="decision"] {
  border-left-color: var(--seal);
}
.trace-seq {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
}
.trace-body header {
  align-items: baseline;
  display: flex;
  gap: 12px;
}
.trace-body strong {
  color: var(--ink);
  font-family: "Pretendard", sans-serif;
  font-size: 13px;
  font-weight: 600;
  text-transform: capitalize;
}
.trace-phase {
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.trace-summary {
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.55;
  margin: 4px 0 0;
}
.trace-context {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.55;
  margin: 6px 0 0;
}
</style>
