<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";

import AgentFlow from "../components/viz/AgentFlow.vue";
import PlanDelta from "../components/viz/PlanDelta.vue";
import PortfolioCells from "../components/viz/PortfolioCells.vue";
import { useAnimatedNumber } from "../composables/useAnimatedNumber";
import { formatKrw, useJudgeState } from "../composables/useJudgeState";
import { rebalancePlanToDeltas } from "../view-model";
import type { AgentResponse, DomainSignal } from "../api";

const {
  portfolio,
  portfolioState,
  portfolioDefinition,
  judgeState,
  quoteState,
  quotes,
  portfolioNotice,
  quoteNotice,
  holdings,
  totalValue,
  kisSyncEnvironment,
  kisSyncLabel,
  agents,
  calledCount,
  skippedCount,
  decisionBadge,
  confidence,
  consensusScore,
  latestRun,
  syncPortfolio,
  refreshKisQuotes,
  runJudge,
  ensureLoaded,
} = useJudgeState();

const portfolioBusy = computed(
  () => portfolioState.value === "loading" || portfolioState.value === "syncing",
);
const quoteBusy = computed(() => quoteState.value === "loading");
const judgeBusy = computed(() => judgeState.value === "running");

const decisionShort = computed(() => {
  const map: Record<string, string> = {
    HOLD: "HOLD",
    DEFER: "DEFER",
    REBALANCE: "REBALANCE",
    USER_DECISION_REQUIRED: "REVIEW",
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

const candidatePlan = computed(
  () => latestRun.value?.decision?.candidate_rebalance_plan ?? {},
);
const candidatePlanDelta = computed(() => rebalancePlanToDeltas(candidatePlan.value, holdings.value));
const planRowCount = computed(() => Object.keys(candidatePlanDelta.value).length);
const targetWeights = computed(() => portfolioDefinition.value?.target_weights ?? []);
type LooseTargetWeight = {
  ticker?: string | null;
  symbol?: string | null;
  company_name?: string | null;
  name?: string | null;
  weight?: number | null;
  target_weight?: number | null;
};
type TargetRow = {
  ticker: string;
  name: string;
  weight: number;
};
const targetRows = computed<TargetRow[]>(() =>
  targetWeights.value
    .map((target) => normalizeTargetRow(target as LooseTargetWeight))
    .filter((target): target is TargetRow => target !== null),
);
const quoteByTicker = computed(() => new Map(quotes.value.map((quote) => [quote.ticker, quote])));

const holdingNames = computed(() => {
  const map: Record<string, string> = {};
  holdings.value.forEach((h) => {
    map[h.ticker] = h.name;
  });
  return map;
});

const portfolioPnl = computed(() =>
  holdings.value.reduce((sum, h) => sum + (h.pnl ?? 0), 0),
);
const portfolioPnlPct = computed(() => {
  const total = totalValue.value ?? 0;
  if (!total) return 0;
  return (portfolioPnl.value / total) * 100;
});

const animatedTotal = useAnimatedNumber(() => totalValue.value ?? 0, 700);
const animatedPnlPct = useAnimatedNumber(() => portfolioPnlPct.value, 700);
const animatedConfidence = useAnimatedNumber(() => confidence.value, 900);
const animatedConsensus = useAnimatedNumber(() => consensusScore.value, 900);

const totalLabel = computed(() => formatKrw(animatedTotal.value));
const confidencePct = computed(() => Math.round(animatedConfidence.value * 100));
const consensusPct = computed(() => Math.round(animatedConsensus.value * 100));

const runKey = computed(() => latestRun.value?.runtime?.thread_id ?? null);

const quoteTimeLabel = computed(() => {
  const latest = quotes.value[0]?.quoted_at;
  if (!latest) return "미조회";
  const date = new Date(latest);
  if (Number.isNaN(date.getTime())) return "조회됨";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});

const liveTone = computed<"live" | "demo" | "running" | "error">(() => {
  if (judgeState.value === "running") return "running";
  if (portfolioState.value === "error" || judgeState.value === "error") return "error";
  if (portfolioState.value === "live") return "live";
  return "demo";
});
const liveLabel = computed(() => {
  if (liveTone.value === "running") return "JUDGE RUNNING";
  if (liveTone.value === "error") return "ERROR";
  if (liveTone.value === "live") return `KIS ${kisSyncEnvironment.value.toUpperCase()}`;
  return "SETUP";
});

const healthScore = computed(() => {
  let score = 48;
  if (portfolio.value) score += 12;
  if (targetWeights.value.length) score += 12;
  if (quotes.value.length) score += 8;
  if (latestRun.value) score += 10;
  score += Math.max(0, Math.round(consensusScore.value * 10));
  return Math.max(0, Math.min(100, score));
});

const domainAgentMeta = [
  { key: "risk", label: "Risk", codename: "Vora" },
  { key: "tax", label: "Tax", codename: "Reed" },
  { key: "compliance", label: "Compliance", codename: "Clarke" },
  { key: "macro", label: "Macro", codename: "Halden" },
  { key: "sentiment", label: "Sentiment", codename: "Imo" },
  { key: "execution", label: "Execution", codename: "Tien" },
  { key: "esg", label: "ESG", codename: "Esme" },
] as const;

const domainCards = computed(() => {
  const responses = latestRun.value?.agent_responses ?? [];
  return domainAgentMeta.map((meta) => {
    const response = responses.find((item) => isDomainAgentResponse(item, meta.key)) ?? null;
    return {
      ...meta,
      response,
      vote: normalizeVote(response),
      confidence: response?.confidence ?? null,
      rationale: response?.reasoning_for_judge_agent || response?.query_understood || "아직 응답 없음",
      signals: parseDomainSignals(response),
      model: response?.llm_used ?? response?.model_used ?? "",
    };
  });
});

const debateRows = computed(() => {
  const responses = latestRun.value?.agent_responses ?? [];
  if (!responses.length) {
    return agents.value
      .filter((agent) => agent.status !== "skipped")
      .slice(0, 6)
      .map((agent) => ({
        id: agent.name,
        meta: agent.turn,
        confidence: agent.confidence,
        body: agent.reason,
        tone: agent.signal > 0.05 ? "pos" : agent.signal < -0.05 ? "neg" : "neutral",
      }));
  }
  return responses
    .slice(-8)
    .reverse()
    .map((response) => ({
      id: response.agent_id,
      meta: `T${response.turn_number} · ${Math.round(response.confidence * 100)}%`,
      confidence: response.confidence,
      body: response.reasoning_for_judge_agent || response.query_understood,
      tone: response.direction > 0.05 ? "pos" : response.direction < -0.05 ? "neg" : "neutral",
    }));
});

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
    if (!text || (!text.startsWith("[") && !text.startsWith("{") && !text.startsWith("\""))) return [];
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

function normalizeTargetRow(target: LooseTargetWeight): TargetRow | null {
  const ticker = String(target.ticker ?? target.symbol ?? "").trim();
  if (!ticker) return null;
  const rawWeight = target.weight ?? target.target_weight ?? null;
  const weight = typeof rawWeight === "number" && Number.isFinite(rawWeight) ? rawWeight : 0;
  return {
    ticker,
    name: String(target.company_name ?? target.name ?? ticker),
    weight,
  };
}

function pnlTone(value: number | null | undefined) {
  if (!value) return "neutral";
  return value > 0 ? "pos" : "neg";
}

onMounted(ensureLoaded);
</script>

<template>
  <article class="console">
    <section class="console-hero">
      <div class="hero-figure">
        <span class="micro-label">Portfolio Command Center</span>
        <h1>
          <span class="figure-value">{{ totalLabel }}</span>
          <small>KRW</small>
        </h1>
        <div class="hero-deltas">
          <span class="delta-pill" :data-tone="pnlTone(portfolioPnl)">
            {{ animatedPnlPct >= 0 ? "+" : "" }}{{ animatedPnlPct.toFixed(2) }}%
            <em>미실현</em>
          </span>
          <span class="delta-pill" data-tone="neutral">{{ holdings.length }}종목 <em>보유</em></span>
          <span class="delta-meta">{{ liveLabel }} · 현재가 {{ quoteTimeLabel }}</span>
        </div>
      </div>

      <div class="hero-actions">
        <button class="cta cta-primary" type="button" :disabled="judgeBusy" @click="runJudge">
          {{ judgeBusy ? "Judge 실행 중" : "AI 판단 실행" }}
        </button>
        <button class="cta cta-secondary" type="button" :disabled="portfolioBusy" @click="syncPortfolio">
          {{ portfolioBusy ? "KIS 동기화 중" : kisSyncLabel }}
        </button>
        <button class="cta cta-secondary" type="button" :disabled="quoteBusy" @click="refreshKisQuotes">
          {{ quoteBusy ? "가격 조회 중" : "KIS 현재가" }}
        </button>
        <RouterLink class="cta cta-ghost" to="/onboarding">목표 비중 설정</RouterLink>
      </div>

      <div class="hero-spark" aria-hidden="true">
        <svg viewBox="0 0 900 90" preserveAspectRatio="none">
          <path
            d="M0 58 C80 38 122 58 186 42 C260 22 305 52 370 34 C458 10 504 42 570 28 C650 10 690 28 742 20 C808 12 852 22 900 12"
            fill="none"
            stroke="var(--seal)"
            stroke-width="2"
          />
          <path
            d="M0 90 L0 58 C80 38 122 58 186 42 C260 22 305 52 370 34 C458 10 504 42 570 28 C650 10 690 28 742 20 C808 12 852 22 900 12 L900 90 Z"
            fill="url(#sparkFill)"
            opacity="0.28"
          />
          <defs>
            <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--seal)" />
              <stop offset="100%" stop-color="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>

    <section class="console-kpis">
      <article :data-tone="decisionTone">
        <span class="micro-label">Decision</span>
        <strong>{{ decisionShort }}</strong>
        <em>{{ decisionBadge.nextAction }}</em>
      </article>
      <article data-tone="neutral">
        <span class="micro-label">Confidence</span>
        <strong>{{ confidencePct }}<small>%</small></strong>
        <em>최종 판단 신뢰도</em>
      </article>
      <article :data-tone="consensusPct >= 0 ? 'pos' : 'neg'">
        <span class="micro-label">Consensus</span>
        <strong>{{ consensusPct >= 0 ? "+" : "" }}{{ consensusPct }}</strong>
        <em>에이전트 합의 점수</em>
      </article>
      <article data-tone="warn">
        <span class="micro-label">Readiness</span>
        <strong>{{ healthScore }}<small>/100</small></strong>
        <em>목표·잔고·시세·판단 준비도</em>
      </article>
    </section>

    <section class="console-grid">
      <div class="console-main">
        <article class="verdict-card-v2" :data-tone="decisionTone">
          <header>
            <span class="micro-label">Current Verdict</span>
            <span class="verdict-stamp">{{ calledCount }} called · {{ skippedCount }} skipped</span>
          </header>
          <h2>{{ decisionShort }}</h2>
          <p>{{ decisionBadge.message }}</p>
          <footer>
            <RouterLink class="cta cta-primary" to="/decision">Trace 열기</RouterLink>
            <RouterLink class="cta cta-secondary" to="/history">이력 보기</RouterLink>
          </footer>
        </article>

        <article class="route-board">
          <header>
            <span class="micro-label">Judge Route</span>
            <span class="board-meta">LangGraph orchestration</span>
          </header>
          <AgentFlow
            compact
            :agents="agents"
            :decision-label="decisionShort"
            :decision-tone="decisionTone"
            :judge-state="judgeState"
            :run-key="runKey"
          />
        </article>

        <article class="debate-board">
          <header>
            <span class="micro-label">Agent Debate</span>
            <RouterLink class="board-link" to="/decision">full trace →</RouterLink>
          </header>
          <ol>
            <li v-for="row in debateRows" :key="`${row.id}-${row.meta}`" :data-tone="row.tone">
              <span class="debate-agent">{{ row.id }}</span>
              <div>
                <strong>{{ row.meta }}</strong>
                <p>{{ row.body }}</p>
              </div>
            </li>
          </ol>
        </article>

        <article class="domain-board">
          <header>
            <span class="micro-label">7 Domain Agents</span>
            <span class="board-meta">JYlibra_sample_v1 merged</span>
          </header>
          <div class="domain-mini-grid">
            <section v-for="card in domainCards" :key="card.key" :data-vote="card.vote">
              <header>
                <strong>{{ card.label }}</strong>
                <span>{{ card.codename }}</span>
              </header>
              <em>{{ card.vote }}</em>
              <p>{{ card.confidence == null ? "—" : `${Math.round(card.confidence * 100)}%` }}</p>
              <details>
                <summary>signals · {{ card.signals.length }}</summary>
                <span v-for="(signal, index) in card.signals.slice(0, 3)" :key="`${card.key}-${index}`">
                  {{ signalLabel(signal) }}
                </span>
              </details>
            </section>
          </div>
        </article>
      </div>

      <aside class="console-side">
        <article class="holdings-board">
          <header>
            <span class="micro-label">Holdings</span>
            <RouterLink class="board-link" to="/indexing">targets →</RouterLink>
          </header>
          <PortfolioCells :holdings="holdings" :total-value="totalValue" />
        </article>

        <article class="plan-board">
          <header>
            <span class="micro-label">Candidate Plan</span>
            <span class="board-meta">{{ planRowCount }} rows</span>
          </header>
          <PlanDelta :plan="candidatePlanDelta" :names="holdingNames" />
        </article>

        <article class="targets-board">
          <header>
            <span class="micro-label">Target Portfolio</span>
            <span class="board-meta">{{ targetRows.length }} names</span>
          </header>
          <ul v-if="targetRows.length">
            <li v-for="target in targetRows.slice(0, 8)" :key="target.ticker">
              <strong>{{ target.name }}</strong>
              <span>{{ target.ticker }}</span>
              <em>
                {{ (target.weight * 100).toFixed(1) }}%
                <template v-if="quoteByTicker.get(target.ticker)">
                  · {{ Math.round(quoteByTicker.get(target.ticker)!.price_krw).toLocaleString("ko-KR") }}원
                </template>
              </em>
            </li>
          </ul>
          <p v-else class="board-empty">온보딩에서 목표 포트폴리오를 저장해야 합니다.</p>
        </article>

        <article class="notice-board">
          <span class="micro-label">System Notice</span>
          <p>{{ portfolioNotice }}</p>
          <p v-if="quoteNotice">{{ quoteNotice }}</p>
        </article>
      </aside>
    </section>
  </article>
</template>

<style scoped>
.console-hero .hero-figure {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  font-size: 16px;
  font-weight: 400;
  gap: 10px;
  letter-spacing: 0;
  line-height: 1.2;
  min-width: 0;
}
.console-hero .hero-figure h1 {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  line-height: 0.92;
  margin: 0;
  min-width: 0;
}
.console-hero .figure-value {
  display: inline-block;
  white-space: nowrap;
}
.console-hero .hero-figure h1 small {
  line-height: 1;
  white-space: nowrap;
}
.console-hero .hero-deltas {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.debate-board ol,
.targets-board ul {
  display: grid;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}
.debate-board li {
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 12px;
  grid-template-columns: 112px 1fr;
  padding: 14px 0;
}
.debate-board li:first-child,
.targets-board li:first-child {
  border-top: 0;
  padding-top: 0;
}
.debate-board li[data-tone="pos"] .debate-agent { color: var(--pos); }
.debate-board li[data-tone="neg"] .debate-agent { color: var(--neg); }
.debate-agent {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.debate-board strong {
  color: var(--ink);
  font-family: var(--mono);
  font-size: 11px;
}
.debate-board p {
  color: var(--ink-2);
  display: -webkit-box;
  font-size: 13px;
  line-height: 1.55;
  margin: 5px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.domain-mini-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.domain-mini-grid section {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-top: 2px solid var(--ink-3);
  border-radius: var(--radius-button);
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 12px;
}
.domain-mini-grid section[data-vote="approve"] { border-top-color: var(--pos); }
.domain-mini-grid section[data-vote="reject"] { border-top-color: var(--neg); }
.domain-mini-grid section[data-vote="pending"] { opacity: 0.62; }
.domain-mini-grid header {
  display: grid;
  gap: 2px;
}
.domain-mini-grid strong {
  color: var(--ink);
  font-size: 12px;
}
.domain-mini-grid span,
.domain-mini-grid em,
.domain-mini-grid p,
.domain-mini-grid summary {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 10px;
  font-style: normal;
  margin: 0;
}
.domain-mini-grid em {
  color: var(--ink-2);
  text-transform: uppercase;
}
.domain-mini-grid details {
  margin-top: 4px;
}
.domain-mini-grid details span {
  display: block;
  line-height: 1.45;
  margin-top: 5px;
}
.targets-board li {
  border-top: 1px solid var(--rule);
  display: grid;
  gap: 3px;
  padding: 11px 0;
}
.targets-board strong {
  color: var(--ink);
  font-size: 13px;
}
.targets-board span,
.targets-board em {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 10px;
  font-style: normal;
}
.plan-board,
.targets-board {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 20px 22px;
}
.plan-board > header,
.targets-board > header {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}
@media (max-width: 1280px) {
  .domain-mini-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .debate-board li {
    grid-template-columns: 1fr;
  }
  .domain-mini-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
