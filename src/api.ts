import { authedFetch } from "./composables/useAuth";

export type PortfolioHolding = {
  ticker: string;
  company_name: string;
  weight: number;
  aliases?: string[];
  shares?: number | null;
  last_price?: number | null;
  average_price?: number | null;
  market_value_krw?: number | null;
  unrealized_pnl_krw?: number | null;
};

export type PortfolioSnapshot = {
  generated_at: string;
  holdings: PortfolioHolding[];
  total_value_krw?: number | null;
  cash_weight: number;
  user_preferences: string[];
};

export type TargetWeight = {
  ticker: string;
  company_name: string;
  weight: number;
  market?: string | null;
};

export type PortfolioDefinition = {
  name: string;
  description?: string | null;
  target_weights: TargetWeight[];
  risk_profile?: string | null;
  drift_threshold?: number | null;
  rebalancing_frequency?: string | null;
  threshold_overridden?: boolean | null;
  created_at?: string | null;
};

export type IndexRecommendationRequest = {
  universes: string[];
  risk: "conservative" | "balanced" | "aggressive";
  income_preference: number;
  esg_exclusions?: string[];
  sectors_exclude?: string[];
};

export type IndexRecommendation = {
  code: string;
  name: string;
  style: string;
  size: string;
  score: number;
  rationale: string;
  description: string;
  fallback_to_custom_tilt: boolean;
};

export type HoldingSample = {
  ticker: string;
  company_name: string;
  target_weight: number;
  note: string;
};

export type KisSyncResponse = {
  status: "SYNCED";
  source: "KIS_DOMESTIC_BALANCE";
  portfolio: PortfolioSnapshot;
};

export type KisCredentialStatus = {
  configured: boolean;
  environment: "real" | "demo" | null;
  app_key_masked: string | null;
  account_no_masked: string | null;
  product_code: string | null;
  updated_at: string | null;
};

export type KisCredentialPayload = {
  environment: "real" | "demo";
  app_key: string;
  app_secret: string;
  account_no: string;
  product_code: string;
  user_agent?: string | null;
};

export type MarketQuote = {
  ticker: string;
  company_name: string;
  price_krw: number;
  change_krw: number;
  change_rate_pct: number;
  volume: number;
  quoted_at: string;
  source: string;
};

export type KisStockListing = {
  ticker: string;
  company_name: string;
  market: "KOSPI" | "KOSDAQ" | string;
  standard_code: string;
  source: string;
  loaded_at: string;
};

export type ToolCall = {
  tool_name: string;
  purpose: string;
  summary: string;
};

export type AgentKind = "information" | "trade" | "evaluation" | "domain" | string;
export type DomainVote = "approve" | "reject" | "abstain" | string;
export type DomainSignal = Record<string, unknown>;

export type AgentResponse = {
  agent_id: string;
  agent_kind?: AgentKind | null;
  turn_number: number;
  query_understood: string;
  verdict: string;
  vote?: DomainVote | null;
  direction: number;
  strength: number;
  urgency: "immediate" | "scheduled" | "watch" | "defer";
  confidence: number;
  signal_score?: number;
  source_trust?: number;
  reasoning_for_judge_agent: string;
  domain_signals?: DomainSignal[] | null;
  domain_signals_json?: string | DomainSignal[] | null;
  llm_used?: string | null;
  model_used?: string | null;
  tools_called?: ToolCall[];
  focus_tickers: string[];
};

export type GovernanceVote = {
  subject: string;
  direction: "INCREASE" | "HOLD" | "DECREASE" | string;
  magnitude_pct: number;
  confidence: number;
  concerns: string[];
  informational: boolean;
};

export type GovernanceAgentOpinion = {
  agent: string;
  round: 1 | 2 | number;
  votes: GovernanceVote[];
  silence_reason?: string | null;
  reasoning: string;
  evidence_refs?: string[];
  metadata?: Record<string, unknown>;
  previous_round_summary?: string | null;
  exposed_signals?: string[];
  delta_from_round1?: "UNCHANGED" | "STRENGTHENED" | "WEAKENED" | "REVERSED" | string | null;
  delta_rationale?: string | null;
};

export type GovernanceConsensusScore = {
  subject: string;
  weighted_score: number;
  confidence_sum: number;
  vote_distribution: Record<string, number>;
  branch: string;
};

export type GovernanceViolation = {
  rule_id: string;
  severity: "WARNING" | "BLOCKING" | string;
  description: string;
  affected_subjects: string[];
};

export type GovernanceComplianceCheck = {
  can_proceed: boolean;
  violations: GovernanceViolation[];
  state: "BEFORE" | "AFTER" | string;
};

export type GovernanceMediatorDecision = {
  consensus_per_subject: Record<string, GovernanceConsensusScore>;
  targets_to_recall: string[];
  skip_round_2: boolean;
  rationale: string;
};

export type GovernanceFinalDecision = {
  decision: "HOLD" | "DEFER" | "USER_DECISION_REQUIRED" | "REBALANCE" | string;
  branch: string;
  trades: Array<{ subject: string; delta_pct: number; rationale: string }>;
  compliance_check: GovernanceComplianceCheck;
  reasoning: string;
  user_question?: string | null;
  user_options?: Array<{ label: string; supporting_agents: string[]; expected_effect: string }> | null;
};

export type GovernanceV1 = {
  round1_opinions: GovernanceAgentOpinion[];
  round2_opinions: GovernanceAgentOpinion[];
  consensus_per_subject: Record<string, GovernanceConsensusScore>;
  targets_to_recall: string[];
  mediator_decision?: GovernanceMediatorDecision;
  compliance_before: GovernanceComplianceCheck;
  compliance_after: GovernanceComplianceCheck;
  tentative_trades?: Array<{ subject: string; delta_pct: number; rationale: string }>;
  final_decision: GovernanceFinalDecision;
};

export type DecisionTraceNode = {
  turn_number: number;
  phase:
    | "information_gathering"
    | "deliberation"
    | "domain_consensus"
    | "compliance_check"
    | "consensus"
    | "decision";
  actor: string;
  query: string;
  summary: string;
  context?: string | null;
  note?: string | null;
  tools_called?: ToolCall[];
};

export type JudgeDecision = {
  decision: "HOLD" | "DEFER" | "USER_DECISION_REQUIRED" | "REBALANCE";
  summary: string;
  confidence: number;
  urgency: "immediate" | "scheduled" | "watch" | "defer";
  called_agents?: string[];
  skipped_agents?: string[];
  skip_rationale?: Record<string, string>;
  decision_trace: DecisionTraceNode[];
  reasoning?: string;
  follow_up_at?: string | null;
  consensus_score?: number;
  divergence_score?: number;
  needs_trade_evaluation?: boolean;
  candidate_rebalance_plan?: Record<string, number>;
  auto_safeguards?: Record<string, unknown>;
  elapsed_seconds?: number | null;
};

export type JudgeRunResult = {
  model: string;
  query: string;
  portfolio: PortfolioSnapshot;
  agent_responses: AgentResponse[];
  decision: JudgeDecision;
  knowledge_sources: Record<string, string>;
  governance_v1?: GovernanceV1;
  runtime: {
    engine: string;
    thread_id?: string | null;
    checkpoint_path?: string | null;
    interrupted: boolean;
    resume_required: boolean;
    round1_agent_count?: number;
    round2_agent_count?: number;
  };
};

export type DecisionRunSummary = {
  id: string;
  thread_id: string;
  query: string;
  model: string;
  trigger_type: string;
  decision: JudgeDecision["decision"];
  urgency: JudgeDecision["urgency"];
  confidence: number;
  consensus_score: number;
  divergence_score: number;
  needs_trade_evaluation: boolean;
  follow_up_at: string | null;
  feedback_checkpoint_at: string | null;
  created_at: string;
};

export type DecisionRunDetail = {
  summary: DecisionRunSummary;
  called_agents: string[];
  candidate_rebalance_plan: Record<string, number>;
  executions: DecisionExecutionResult[];
  result: JudgeRunResult;
};

export type DecisionEvaluationResult = {
  id: number;
  decision_run_id: string;
  horizon: string;
  evaluated_at: string;
  direction_accuracy: boolean | null;
  timing_accuracy: number | null;
  magnitude_error: number | null;
  cost_efficiency: number | null;
  fast_track_accuracy: boolean | null;
  verdict: string;
  notes: string | null;
  metrics: Record<string, unknown>;
  created_at: string;
};

export type DecisionExecutionResult = {
  id: number | null;
  decision_run_id: string;
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  price_krw: number;
  amount_krw: number;
  executed_at: string | null;
  status: "DRY_RUN" | "ACCEPTED" | "REJECTED" | string;
  message: string | null;
  order_no: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
};

export type DecisionExecutionOrderItem = {
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  price_krw?: number;
  order_type?: "00" | "01";
};

export type DecisionExecutionProposalItem = {
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  price_krw: number;
  amount_krw: number;
  order_type: "00" | "01";
  weight_delta: number;
  reason: string;
};

export type DecisionExecutionPayload = {
  orders: DecisionExecutionOrderItem[];
  dry_run?: boolean;
};

export type DecisionEvaluationPayload = {
  horizon?: string;
  realized_return_pct: number;
  cost_pct?: number;
  user_feedback?: string | null;
};

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { timeoutMs = 30000, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await authedFetch(path, { ...requestInit, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(buildApiErrorMessage(response, body, path));
  }

  return response.json() as Promise<T>;
}

function extractErrorMessage(body: string) {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? body;
  } catch {
    return body;
  }
}

function buildApiErrorMessage(response: Response, body: string, path: string) {
  const detail = body ? extractErrorMessage(body) : "";
  if (response.status === 401 || response.status === 403) {
    return "로그인 세션 또는 API 권한을 확인해야 합니다. 다시 로그인하거나 backend 인증 설정을 확인하세요.";
  }
  if (response.status === 502) {
    return "backend 또는 외부 연동 응답이 불안정합니다. Docker 서비스와 KIS/Gemini 연결 상태를 확인하세요.";
  }
  if (response.status >= 500) {
    return detail || "backend 처리 중 오류가 발생했습니다. 서버 로그를 확인하세요.";
  }
  return detail || `${response.status} ${response.statusText}: ${path}`;
}

export function getCurrentPortfolio(): Promise<PortfolioSnapshot> {
  return request<PortfolioSnapshot>("/api/v1/portfolios/current");
}

export function getPortfolioDefinition(): Promise<PortfolioDefinition> {
  return request<PortfolioDefinition>("/api/v1/portfolios/definition");
}

export function savePortfolioDefinition(payload: PortfolioDefinition): Promise<PortfolioDefinition> {
  return request<PortfolioDefinition>("/api/v1/portfolios/definition", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function recommendIndexes(payload: IndexRecommendationRequest): Promise<IndexRecommendation[]> {
  return request<IndexRecommendation[]>("/api/v1/recommend/index", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRecommendedHoldings(indexCode: string, capitalKrw: number): Promise<HoldingSample[]> {
  const params = new URLSearchParams({
    indexCode,
    capitalKrw: String(capitalKrw),
  });
  return request<HoldingSample[]>(`/api/v1/recommend/holdings?${params.toString()}`);
}

export function syncPortfolioFromKis(environment: "real" | "demo" = "demo"): Promise<KisSyncResponse> {
  return request<KisSyncResponse>("/api/v1/portfolios/current/sync/kis", {
    method: "POST",
    timeoutMs: 60000,
    body: JSON.stringify({
      environment,
    }),
  });
}

export function getKisCredentialStatus(): Promise<KisCredentialStatus> {
  return request<KisCredentialStatus>("/api/v1/kis/credential");
}

export function saveKisCredential(payload: KisCredentialPayload): Promise<KisCredentialStatus> {
  return request<KisCredentialStatus>("/api/v1/kis/credential", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteKisCredential(): Promise<{ status: "DELETED" }> {
  return request<{ status: "DELETED" }>("/api/v1/kis/credential", {
    method: "DELETE",
  });
}

export function getKisQuotes(
  tickers: string[],
  environment: "real" | "demo" = "demo",
): Promise<MarketQuote[]> {
  const params = new URLSearchParams({
    environment,
    tickers: tickers.join(","),
  });
  return request<MarketQuote[]>(`/api/v1/market/kis/quotes?${params.toString()}`, {
    timeoutMs: 60000,
  });
}

export function searchKisStocks(
  query: string,
  markets: string[] = ["KOSPI", "KOSDAQ"],
  limit = 30,
): Promise<KisStockListing[]> {
  const params = new URLSearchParams({
    query,
    markets: markets.join(","),
    limit: String(limit),
  });
  return request<KisStockListing[]>(`/api/v1/market/kis/stocks?${params.toString()}`, {
    timeoutMs: 60000,
  });
}

export function runJudgeRun(): Promise<JudgeRunResult> {
  return request<JudgeRunResult>("/api/v1/judge-runs", {
    method: "POST",
    timeoutMs: 180000,
    body: JSON.stringify({
      query: "현재 보유 포트폴리오를 점검하고 필요한 하위 에이전트를 동적으로 호출해 주세요.",
      depth: "medium",
      trigger: "pull",
      governance_v1: { execution_mode: "primary" },
    }),
  });
}

export function getDecisionRuns(): Promise<DecisionRunSummary[]> {
  return request<DecisionRunSummary[]>("/api/v1/decision-runs");
}

export function getDecisionRun(id: string): Promise<DecisionRunDetail> {
  return request<DecisionRunDetail>(`/api/v1/decision-runs/${encodeURIComponent(id)}`);
}

export function getDecisionEvaluations(id: string): Promise<DecisionEvaluationResult[]> {
  return request<DecisionEvaluationResult[]>(`/api/v1/decision-runs/${encodeURIComponent(id)}/evaluations`);
}

export function executeKisDemoOrders(
  id: string,
  payload: DecisionExecutionPayload,
): Promise<DecisionExecutionResult[]> {
  return request<DecisionExecutionResult[]>(`/api/v1/decision-runs/${encodeURIComponent(id)}/executions/kis-demo`, {
    method: "POST",
    timeoutMs: 60000,
    body: JSON.stringify(payload),
  });
}

export function getKisDemoOrderProposal(id: string): Promise<DecisionExecutionProposalItem[]> {
  return request<DecisionExecutionProposalItem[]>(
    `/api/v1/decision-runs/${encodeURIComponent(id)}/executions/kis-demo/proposal`,
    {
      timeoutMs: 60000,
    },
  );
}

export function createDecisionEvaluation(
  id: string,
  payload: DecisionEvaluationPayload,
): Promise<DecisionEvaluationResult> {
  return request<DecisionEvaluationResult>(`/api/v1/decision-runs/${encodeURIComponent(id)}/evaluations`, {
    method: "POST",
    timeoutMs: 60000,
    body: JSON.stringify(payload),
  });
}
