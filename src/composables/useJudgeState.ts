import { computed, ref } from "vue";

import {
  getCurrentPortfolio,
  getDecisionRun,
  getDecisionRuns,
  getKisCredentialStatus,
  getKisQuotes,
  getPortfolioDefinition,
  runJudgeRun,
  syncPortfolioFromKis,
  type JudgeRunResult,
  type KisCredentialStatus,
  type MarketQuote,
  type PortfolioDefinition,
  type PortfolioSnapshot,
} from "../api";
import {
  buildAgents,
  buildDecisionBadge,
  buildTimeline,
  maxTurn,
  toHoldings,
  totalValue as resolveTotalValue,
} from "../view-model";

const portfolio = ref<PortfolioSnapshot | null>(null);
const portfolioDefinition = ref<PortfolioDefinition | null>(null);
const latestRun = ref<JudgeRunResult | null>(null);
const kisCredentialStatus = ref<KisCredentialStatus | null>(null);
const portfolioState = ref<"idle" | "loading" | "syncing" | "live" | "demo" | "error">("idle");
const kisCredentialState = ref<"idle" | "loading" | "ready" | "error">("idle");
const quoteState = ref<"idle" | "loading" | "ready" | "error">("idle");
const judgeState = ref<"ready" | "running" | "done" | "error">("ready");
const currentTurn = ref(1);
const fallbackJudgeMessage = ref("Judge가 현재 포트폴리오와 시장 상황을 보고 필요한 확인 순서를 먼저 선택합니다.");
const portfolioNotice = ref("저장된 포트폴리오를 먼저 읽고, 필요하면 KIS에서 새로 동기화합니다.");
const quoteNotice = ref("");
const quotes = ref<MarketQuote[]>([]);
let initialLoadStarted = false;
let latestRunLoadStarted = false;
let kisCredentialLoadPromise: Promise<KisCredentialStatus | null> | null = null;

export function formatKrw(value: number | null | undefined) {
  if (value == null) return "-";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}

async function loadPortfolio() {
  portfolioState.value = "loading";
  try {
    portfolio.value = await getCurrentPortfolio();
    portfolioState.value = "live";
    portfolioNotice.value = "backend에 저장된 최신 포트폴리오 스냅샷입니다.";
  } catch (error) {
    portfolio.value = null;
    portfolioState.value = "demo";
    portfolioNotice.value =
      error instanceof Error
        ? `목표 포트폴리오는 저장할 수 있지만, 아직 KIS 잔고 스냅샷이 없습니다. Profile에서 KIS credential을 저장한 뒤 KIS sync를 실행하세요. ${error.message}`
        : "목표 포트폴리오는 저장할 수 있지만, 아직 KIS 잔고 스냅샷이 없습니다. Profile에서 KIS credential을 저장한 뒤 KIS sync를 실행하세요.";
  }
}

async function loadPortfolioDefinition() {
  try {
    portfolioDefinition.value = await getPortfolioDefinition();
  } catch {
    portfolioDefinition.value = null;
  }
}

async function loadKisCredentialStatus() {
  if (kisCredentialLoadPromise) return kisCredentialLoadPromise;

  kisCredentialState.value = "loading";
  kisCredentialLoadPromise = getKisCredentialStatus()
    .then((status) => {
      kisCredentialStatus.value = status;
      kisCredentialState.value = "ready";
      return status;
    })
    .catch(() => {
      kisCredentialStatus.value = null;
      kisCredentialState.value = "error";
      return null;
    })
    .finally(() => {
      kisCredentialLoadPromise = null;
    });

  return kisCredentialLoadPromise;
}

function environmentLabel(environment: "real" | "demo") {
  return environment === "demo" ? "모의투자" : "실전투자";
}

async function syncPortfolio() {
  portfolioState.value = "syncing";
  portfolioNotice.value = "저장된 KIS credential 환경을 확인하는 중입니다.";
  try {
    const status = await loadKisCredentialStatus();
    if (!status?.configured || !status.environment) {
      portfolioState.value = "error";
      portfolioNotice.value =
        "Profile에서 KIS 모의투자 credential을 먼저 저장하세요. 저장 전에는 실전투자로 잘못 호출하지 않도록 동기화를 막았습니다.";
      return;
    }

    const environment = status.environment;
    portfolioNotice.value = `KIS ${environmentLabel(environment)} 국내주식 잔고 API에서 보유 종목을 동기화하는 중입니다.`;
    const response = await syncPortfolioFromKis(environment);
    portfolio.value = response.portfolio;
    latestRun.value = null;
    portfolioState.value = "live";
    portfolioNotice.value = `KIS ${environmentLabel(environment)}에서 새로 받은 보유 종목을 backend에 저장하고 화면에 반영했습니다.`;
  } catch (error) {
    portfolioState.value = "error";
    portfolioNotice.value =
      error instanceof Error
        ? `KIS 동기화에 실패했습니다. 프로필의 KIS credential 또는 backend KIS 환경변수 설정을 확인해야 합니다. ${error.message}`
        : "KIS 동기화에 실패했습니다. 프로필의 KIS credential 또는 backend KIS 환경변수 설정을 확인해야 합니다.";
  }
}

async function refreshKisQuotes() {
  const currentPortfolio = portfolio.value ?? latestRun.value?.portfolio ?? null;
  const holdingTickers = (currentPortfolio?.holdings ?? []).map((holding) => holding.ticker).filter(Boolean);
  const targetTickers = (portfolioDefinition.value?.target_weights ?? []).map((target) => target.ticker).filter(Boolean);
  const tickers = Array.from(new Set(holdingTickers.length ? holdingTickers : targetTickers));
  if (!tickers.length) {
    quoteState.value = "error";
    quoteNotice.value = "현재가를 조회할 보유 종목이나 목표 종목이 없습니다. 온보딩에서 목표 포트폴리오를 먼저 저장하세요.";
    return;
  }

  quoteState.value = "loading";
  quoteNotice.value = "KIS 국내주식 현재가 API에서 종목 가격을 조회하는 중입니다.";
  try {
    const status = await loadKisCredentialStatus();
    const environment = status?.environment ?? "demo";
    const receivedQuotes = await getKisQuotes(tickers, environment);
    quotes.value = receivedQuotes;
    quoteState.value = "ready";
    quoteNotice.value = `KIS ${environmentLabel(environment)} 현재가 ${receivedQuotes.length}종목을 반영했습니다.`;
    mergeQuotesIntoPortfolio(receivedQuotes);
  } catch (error) {
    quoteState.value = "error";
    quoteNotice.value =
      error instanceof Error
        ? `KIS 현재가 조회에 실패했습니다. ${error.message}`
        : "KIS 현재가 조회에 실패했습니다.";
  }
}

function mergeQuotesIntoPortfolio(receivedQuotes: MarketQuote[]) {
  if (!portfolio.value || !receivedQuotes.length) return;
  const byTicker = new Map(receivedQuotes.map((quote) => [quote.ticker, quote]));
  const updatedHoldings = portfolio.value.holdings.map((holding) => {
    const quote = byTicker.get(holding.ticker);
    if (!quote) return holding;
    const shares = holding.shares ?? null;
    const marketValue = shares == null ? holding.market_value_krw ?? null : shares * quote.price_krw;
    return {
      ...holding,
      company_name: holding.company_name || quote.company_name,
      last_price: quote.price_krw,
      market_value_krw: marketValue,
      weight: holding.weight,
    };
  });
  const holdingsValue = updatedHoldings.reduce((sum, holding) => sum + (holding.market_value_krw ?? 0), 0);
  const cashWeight = portfolio.value.cash_weight ?? 0;
  const totalValue = holdingsValue > 0 && cashWeight < 1 ? holdingsValue / Math.max(0.0001, 1 - cashWeight) : portfolio.value.total_value_krw;
  portfolio.value = {
    ...portfolio.value,
    generated_at: new Date().toISOString(),
    holdings: updatedHoldings,
    total_value_krw: totalValue,
  };
}

async function runJudge() {
  judgeState.value = "running";
  fallbackJudgeMessage.value = "Backend에 저장된 현재 포트폴리오 기준으로 Judge run을 요청했습니다.";
  try {
    latestRun.value = await runJudgeRun();
    judgeState.value = "done";
    currentTurn.value = maxTurn(buildTimeline(latestRun.value, 999));
    if (latestRun.value.portfolio) {
      portfolio.value = latestRun.value.portfolio;
      portfolioState.value = "live";
    }
  } catch (error) {
    judgeState.value = "error";
    fallbackJudgeMessage.value = error instanceof Error ? error.message : String(error);
  }
}

async function loadLatestRun() {
  if (latestRun.value || latestRunLoadStarted) return;
  latestRunLoadStarted = true;
  try {
    const runs = await getDecisionRuns();
    const latest = runs[0];
    if (!latest?.id) return;
    const detail = await getDecisionRun(latest.id);
    latestRun.value = detail.result;
    currentTurn.value = maxTurn(buildTimeline(detail.result, 999));
    if (detail.result.portfolio && !portfolio.value) {
      portfolio.value = detail.result.portfolio;
      portfolioState.value = "live";
    }
  } catch {
    // Dashboard and trace pages must still render before the first persisted run exists.
  }
}

function nextTurn(timelineLength: number) {
  currentTurn.value = currentTurn.value >= timelineLength ? 1 : currentTurn.value + 1;
}

function setCurrentTurn(turn: number) {
  currentTurn.value = turn;
}

function ensureLoaded() {
  void loadKisCredentialStatus();
  void loadPortfolioDefinition();
  void loadLatestRun();
  if (!initialLoadStarted) {
    initialLoadStarted = true;
    void loadPortfolio();
  }
}

export function useJudgeState() {
  const holdings = computed(() => toHoldings(portfolio.value ?? latestRun.value?.portfolio ?? null));
  const totalValue = computed(() => resolveTotalValue(portfolio.value ?? latestRun.value?.portfolio ?? null));
  const totalValueLabel = computed(() => formatKrw(totalValue.value));
  const kisSyncEnvironment = computed(() => kisCredentialStatus.value?.environment ?? "demo");
  const kisSyncLabel = computed(() => {
    if (kisCredentialState.value === "loading") return "KIS sync · checking";
    if (kisCredentialStatus.value?.configured && kisCredentialStatus.value.environment) {
      return `KIS sync · ${kisCredentialStatus.value.environment.toUpperCase()}`;
    }
    return "KIS sync · SETUP";
  });
  const agents = computed(() => buildAgents(latestRun.value));
  const signalAgents = computed(() => agents.value.filter((agent) => agent.status !== "skipped"));
  const calledCount = computed(() => agents.value.filter((agent) => agent.status === "called").length);
  const skippedCount = computed(() => agents.value.filter((agent) => agent.status === "skipped").length);
  const timeline = computed(() => buildTimeline(latestRun.value, currentTurn.value));
  const decisionBadge = computed(() =>
    buildDecisionBadge(latestRun.value?.decision ?? null, fallbackJudgeMessage.value),
  );
  const confidence = computed(() => latestRun.value?.decision?.confidence ?? 0.72);
  const urgency = computed(() => latestRun.value?.decision?.urgency ?? "watch");
  const consensusScore = computed(() => latestRun.value?.decision?.consensus_score ?? 0);

  return {
    portfolio,
    portfolioDefinition,
    latestRun,
    portfolioState,
    kisCredentialStatus,
    kisCredentialState,
    quoteState,
    quotes,
    judgeState,
    currentTurn,
    fallbackJudgeMessage,
    portfolioNotice,
    quoteNotice,
    holdings,
    totalValue,
    totalValueLabel,
    kisSyncEnvironment,
    kisSyncLabel,
    agents,
    signalAgents,
    calledCount,
    skippedCount,
    timeline,
    decisionBadge,
    confidence,
    urgency,
    consensusScore,
    loadPortfolio,
    loadPortfolioDefinition,
    loadKisCredentialStatus,
    loadLatestRun,
    syncPortfolio,
    refreshKisQuotes,
    runJudge,
    nextTurn,
    setCurrentTurn,
    ensureLoaded,
  };
}
