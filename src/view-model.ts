import type { AgentResponse, JudgeDecision, JudgeRunResult, PortfolioSnapshot } from "./api";

export type AgentStatus = "called" | "skipped" | "judge";

export type AgentView = {
  id: string;
  glyph: string;
  name: string;
  role: string;
  status: AgentStatus;
  turn: string;
  signal: number;
  confidence: number;
  reason: string;
  color: string;
};

export type HoldingView = {
  ticker: string;
  name: string;
  weight: number;
  value: number | null;
  pnl: number | null;
};

export type TimelineStep = {
  turn: string;
  actor: string;
  title: string;
  body: string;
  state: "done" | "active" | "muted";
};

export type DecisionBadge = {
  label: string;
  status: string;
  nextAction: string;
  message: string;
};

const AGENT_ORDER = [
  "judge",
  "disclosure",
  "news",
  "report",
  "profit",
  "cost",
  "risk",
  "tax",
  "compliance",
  "macro",
  "sentiment",
  "execution",
  "esg",
] as const;

const AGENT_META: Record<string, Omit<AgentView, "status" | "turn" | "signal" | "confidence" | "reason">> = {
  judge: {
    id: "judge",
    glyph: "J",
    name: "Judge",
    role: "상황 판단, 호출 순서 선택",
    color: "var(--ink)",
  },
  disclosure: {
    id: "disclosure",
    glyph: "D",
    name: "Disclosure",
    role: "공시 사실 확인",
    color: "var(--pos)",
  },
  news: {
    id: "news",
    glyph: "N",
    name: "News",
    role: "시장 반응 확인",
    color: "var(--warn)",
  },
  report: {
    id: "report",
    glyph: "R",
    name: "Report",
    role: "리포트와 컨센서스 확인",
    color: "var(--accent)",
  },
  profit: {
    id: "profit",
    glyph: "P",
    name: "Profit",
    role: "수익률과 위험 검토",
    color: "var(--ink-3)",
  },
  cost: {
    id: "cost",
    glyph: "C",
    name: "Cost",
    role: "거래비용과 유동성 확인",
    color: "var(--ink-3)",
  },
  risk: {
    id: "risk",
    glyph: "V",
    name: "Risk",
    role: "집중도, 손실, 위험 한도 검토",
    color: "var(--neg)",
  },
  tax: {
    id: "tax",
    glyph: "T",
    name: "Tax",
    role: "세금 효과와 손실 수확 검토",
    color: "var(--brass)",
  },
  compliance: {
    id: "compliance",
    glyph: "K",
    name: "Compliance",
    role: "IPS와 사용자 제약 검증",
    color: "var(--neg)",
  },
  macro: {
    id: "macro",
    glyph: "M",
    name: "Macro",
    role: "거시 환경과 섹터 민감도 검토",
    color: "var(--seal)",
  },
  sentiment: {
    id: "sentiment",
    glyph: "S",
    name: "Sentiment",
    role: "뉴스 감성과 시장 심리 검토",
    color: "var(--warn)",
  },
  execution: {
    id: "execution",
    glyph: "X",
    name: "Execution",
    role: "체결 가능성과 시장 충격 검토",
    color: "var(--pos)",
  },
  esg: {
    id: "esg",
    glyph: "E",
    name: "ESG",
    role: "ESG 제외 룰과 지속가능성 검토",
    color: "var(--pos)",
  },
};

const DEMO_AGENTS: AgentView[] = [
  {
    ...AGENT_META.judge,
    status: "judge",
    turn: "T1",
    signal: 0,
    confidence: 0.72,
    reason: "사용자 위임 범위와 포트폴리오 상태를 먼저 해석",
  },
  {
    ...AGENT_META.disclosure,
    status: "called",
    turn: "T2",
    signal: -0.22,
    confidence: 0.8,
    reason: "삼성전자 실적 하회 신호가 있어 공시 확인 필요",
  },
  {
    ...AGENT_META.news,
    status: "called",
    turn: "T3",
    signal: 0.08,
    confidence: 0.62,
    reason: "공시 신호와 가격 반응이 일치하는지 확인",
  },
  {
    ...AGENT_META.report,
    status: "called",
    turn: "T4",
    signal: 0.04,
    confidence: 0.58,
    reason: "뉴스와 공시 신호가 충돌해 증권사 해석 확인",
  },
  {
    ...AGENT_META.profit,
    status: "skipped",
    turn: "skip",
    signal: 0,
    confidence: 0.34,
    reason: "리밸런싱 후보가 아직 만들어지지 않음",
  },
  {
    ...AGENT_META.cost,
    status: "skipped",
    turn: "skip",
    signal: 0,
    confidence: 0.28,
    reason: "실행 계획이 없어 비용 계산을 보류",
  },
];

export const demoHoldings: HoldingView[] = [
  { ticker: "005930", name: "삼성전자", weight: 0.4, value: 6500000, pnl: 500000 },
  { ticker: "000660", name: "SK하이닉스", weight: 0.25, value: 7500000, pnl: 500000 },
  { ticker: "005380", name: "현대차", weight: 0.2, value: 3600000, pnl: -120000 },
  { ticker: "105560", name: "KB금융", weight: 0.15, value: 2800000, pnl: 90000 },
];

export function toHoldings(snapshot: PortfolioSnapshot | null): HoldingView[] {
  if (!snapshot) return [];
  return snapshot.holdings.map((holding) => ({
    ticker: holding.ticker,
    name: holding.company_name,
    weight: holding.weight,
    value: holding.market_value_krw ?? null,
    pnl: holding.unrealized_pnl_krw ?? null,
  }));
}

export function totalValue(snapshot: PortfolioSnapshot | null) {
  if (snapshot?.total_value_krw != null) return snapshot.total_value_krw;
  return 0;
}

export function rebalancePlanToDeltas(
  plan: Record<string, number> | null | undefined,
  holdings: HoldingView[],
): Record<string, number> {
  const entries = Object.entries(plan ?? {})
    .map(([ticker, value]) => [ticker, Number(value)] as const)
    .filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return {};

  const sum = entries.reduce((acc, [, value]) => acc + value, 0);
  const allNonNegative = entries.every(([, value]) => value >= 0);
  const looksLikeTargetWeights = allNonNegative && sum >= 0.85 && sum <= 1.15;

  if (!looksLikeTargetWeights) {
    return Object.fromEntries(entries);
  }

  const currentWeight = new Map(holdings.map((holding) => [holding.ticker, holding.weight]));
  return Object.fromEntries(
    entries
      .map(([ticker, targetWeight]) => [ticker, targetWeight - (currentWeight.get(ticker) ?? 0)] as const)
      .filter(([, delta]) => Math.abs(delta) >= 0.0005),
  );
}

export function buildAgents(run: JudgeRunResult | null): AgentView[] {
  if (!run) return DEMO_AGENTS;

  const responses = new Map<string, AgentResponse>(
    run.agent_responses.map((response) => [normalizeAgentId(response.agent_id), response]),
  );
  const called = new Set((run.decision.called_agents ?? run.agent_responses.map((response) => response.agent_id)).map(normalizeAgentId));
  const skipped = new Set((run.decision.skipped_agents ?? []).map(normalizeAgentId));

  const knownRows = AGENT_ORDER.map((id) => AGENT_META[id]).map((meta) => {
    if (meta.id === "judge") {
      return {
        ...meta,
        status: "judge",
        turn: "T1",
        signal: run.decision.consensus_score ?? 0,
        confidence: run.decision.confidence,
        reason: run.decision.reasoning || run.decision.summary,
      };
    }

    const response = responses.get(meta.id);
    const isCalled = called.has(meta.id) || Boolean(response);
    const isSkipped = skipped.has(meta.id) || !isCalled;

    return {
      ...meta,
      status: isSkipped ? "skipped" : "called",
      turn: response ? `T${response.turn_number}` : "skip",
      signal: response?.signal_score ?? response?.direction ?? 0,
      confidence: response?.confidence ?? 0.25,
      reason:
        response?.reasoning_for_judge_agent ??
        skipReason(run.decision, meta.id) ??
        "이번 판단에서는 호출 조건이 충족되지 않았습니다.",
    };
  });

  const unknownRows = [...responses.entries()]
    .filter(([id]) => !AGENT_META[id])
    .map(([id, response]) => ({
      id,
      glyph: id.slice(0, 1).toUpperCase(),
      name: response.agent_id,
      role: response.agent_kind ?? "외부 에이전트",
      color: "var(--ink-3)",
      status: "called" as const,
      turn: `T${response.turn_number}`,
      signal: response.signal_score ?? response.direction ?? 0,
      confidence: response.confidence,
      reason: response.reasoning_for_judge_agent || response.query_understood,
    }));

  return [...knownRows, ...unknownRows];
}

export function buildTimeline(run: JudgeRunResult | null, currentTurn: number): TimelineStep[] {
  if (!run) {
    return [
      {
        turn: "T1",
        actor: "Judge",
        title: "초기 판단",
        body: "포트폴리오와 사용자 설정을 먼저 읽고, 전 종목 일괄 수집이 아니라 필요한 확인 항목을 선택합니다.",
        state: currentTurn === 1 ? "active" : "done",
      },
      {
        turn: "T2",
        actor: "Disclosure",
        title: "공시 확인",
        body: "실적 하회 가능성이 있어 공시 원문과 핵심 수치를 확인합니다.",
        state: currentTurn === 2 ? "active" : currentTurn > 2 ? "done" : "muted",
      },
      {
        turn: "T3",
        actor: "News",
        title: "시장 반응 확인",
        body: "공시 신호가 가격과 섹터 뉴스에 어떻게 반영되는지 확인합니다.",
        state: currentTurn === 3 ? "active" : currentTurn > 3 ? "done" : "muted",
      },
      {
        turn: "T4",
        actor: "Report",
        title: "해석 보강",
        body: "신호가 갈려 증권사 리포트와 컨센서스 변화를 확인합니다.",
        state: currentTurn === 4 ? "active" : currentTurn > 4 ? "done" : "muted",
      },
      {
        turn: "T5",
        actor: "Judge",
        title: "최종 판단",
        body: "즉시 매매가 아니라 리포트 발간 후 재판단을 예약합니다.",
        state: currentTurn === 5 ? "active" : currentTurn > 5 ? "done" : "muted",
      },
    ];
  }

  return run.decision.decision_trace.map((node, index) => {
    const turnNumber = node.turn_number || index + 1;
    return {
      turn: `T${turnNumber}`,
      actor: displayAgentName(node.actor),
      title: phaseTitle(node.phase),
      body: node.summary || node.query,
      state: currentTurn === turnNumber ? "active" : currentTurn > turnNumber ? "done" : "muted",
    };
  });
}

export function buildDecisionBadge(decision: JudgeDecision | null, fallbackMessage: string): DecisionBadge {
  if (!decision) {
    return {
      label: "Current Decision",
      status: "DEFER",
      nextAction: "09:55 리포트 확인 후 재판단",
      message: fallbackMessage,
    };
  }

  return {
    label: "Current Decision",
    status: decision.decision,
    nextAction: decision.follow_up_at ? `${formatDateTime(decision.follow_up_at)} 재판단` : decision.urgency,
    message: decision.summary || fallbackMessage,
  };
}

export function maxTurn(timeline: TimelineStep[]) {
  return Math.max(1, ...timeline.map((step) => Number(step.turn.slice(1))).filter(Number.isFinite));
}

function normalizeAgentId(agentId: string) {
  const lowered = agentId.toLowerCase().replace(/[\s_-]/g, "");
  if (lowered.startsWith("judge")) return "judge";
  if (lowered.startsWith("disclosure") || lowered === "dart") return "disclosure";
  if (lowered.startsWith("news")) return "news";
  if (lowered.startsWith("report")) return "report";
  if (lowered.startsWith("profit") || lowered.startsWith("return")) return "profit";
  if (lowered.startsWith("cost")) return "cost";
  if (lowered.startsWith("risk") || lowered.includes("vora")) return "risk";
  if (lowered.startsWith("tax") || lowered.includes("reed")) return "tax";
  if (lowered.startsWith("compliance") || lowered.includes("clarke")) return "compliance";
  if (lowered.startsWith("macro") || lowered.includes("halden")) return "macro";
  if (lowered.startsWith("sentiment") || lowered.includes("imo")) return "sentiment";
  if (lowered.startsWith("execution") || lowered.includes("tien")) return "execution";
  if (lowered.startsWith("esg") || lowered.includes("esme")) return "esg";
  return lowered || agentId;
}

function displayAgentName(actor: string) {
  const id = normalizeAgentId(actor);
  return AGENT_META[id]?.name ?? actor;
}

function phaseTitle(phase: string) {
  if (phase === "information_gathering") return "정보 확인";
  if (phase === "deliberation") return "검토";
  if (phase === "domain_consensus") return "관점 합의";
  if (phase === "compliance_check") return "제약 검증";
  if (phase === "consensus") return "신호 종합";
  if (phase === "decision") return "최종 판단";
  return phase;
}

function skipReason(decision: JudgeDecision, agentId: string) {
  const rationale = decision.skip_rationale ?? {};
  const candidates = [
    agentId,
    AGENT_META[agentId]?.name,
    AGENT_META[agentId]?.name.toLowerCase(),
    normalizeAgentId(agentId),
  ].filter(Boolean) as string[];
  for (const key of candidates) {
    const direct = rationale[key];
    if (direct) return direct;
  }
  const found = Object.entries(rationale).find(([key]) => normalizeAgentId(key) === agentId);
  return found?.[1];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
