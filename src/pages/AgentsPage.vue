<script setup lang="ts">
type IntegrationStatus = "통합 완료" | "부분 통합" | "후속 과제";

type TeamIntegration = {
  repo: string;
  module: string;
  status: IntegrationStatus;
  source: string[];
  integrated: string[];
  liveFlow: string[];
  proof: string;
  meetingLine: string;
};

const integrations: TeamIntegration[] = [
  {
    repo: "KW-Libra/libra-direct",
    module: "Direct Indexing Core",
    status: "통합 완료",
    source: [
      "D:\\KW-Libra-team-repos\\libra-direct\\core\\drift.py",
      "D:\\KW-Libra-team-repos\\libra-direct\\core\\models.py",
      "D:\\KW-Libra-team-repos\\libra-direct\\docs\\interface_contract.md",
    ],
    integrated: [
      "D:\\Libra\\src\\libra_agent\\libra\\direct_indexing.py",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\portfolio\\PortfolioDefinitionService.java",
      "D:\\libra-backend\\src\\main\\resources\\db\\migration\\V6__portfolio_definitions.sql",
      "D:\\libra-frontend\\src\\pages\\OnboardingPage.vue",
    ],
    liveFlow: [
      "사용자가 목표 종목과 목표 비중을 저장합니다.",
      "KIS 잔고 동기화 결과와 목표 비중을 Judge 요청에 함께 보냅니다.",
      "Agent가 drift report와 후보 리밸런싱 weight delta를 계산합니다.",
    ],
    proof: "목표 비중 저장 후 Judge 실행 시 candidate_rebalance_plan이 target-current drift 기준으로 생성됩니다.",
    meetingLine:
      "직접 인덱싱 레포의 drift 계산 모델을 LIBRA 판단 엔진의 후보 리밸런싱 생성 단계로 흡수했습니다.",
  },
  {
    repo: "KW-Libra/JYlibra-sample_v1",
    module: "Onboarding & Recommendation",
    status: "부분 통합",
    source: [
      "D:\\KW-Libra-team-repos\\JYlibra-sample_v1\\docs\\PLAN_onboarding_index_recommendation.md",
      "D:\\KW-Libra-team-repos\\JYlibra-sample_v1\\libra-backend\\src\\main\\java\\com\\libra\\api\\user\\recommend\\IndexRecommenderService.java",
      "D:\\KW-Libra-team-repos\\JYlibra-sample_v1\\libra-front\\src\\components\\onboarding\\OnboardingPage.tsx",
    ],
    integrated: [
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\recommend\\IndexRecommenderService.java",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\recommend\\RecommendController.java",
      "D:\\libra-frontend\\src\\pages\\OnboardingPage.vue",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\integration\\kis\\KisStockMasterService.java",
    ],
    liveFlow: [
      "회원가입 후 초기 설정에서 투자 성향과 시장 선호를 받습니다.",
      "추천 모드는 지수 후보를 계산하고, 직접 구성 모드는 KIS 종목 마스터에서 종목을 검색합니다.",
      "선택한 종목과 비중은 목표 포트폴리오로 저장되어 Dashboard와 Judge로 이어집니다.",
    ],
    proof: "KIS 종목 검색에서 005930 삼성전자, 000660 SK하이닉스를 선택해 목표 비중 저장까지 완료됩니다.",
    meetingLine:
      "온보딩과 지수 추천 아이디어는 유지하되, 현재 서비스에서는 KIS 종목 마스터 기반 직접 선택 흐름까지 확장했습니다.",
  },
  {
    repo: "KW-Libra/HJ-agent",
    module: "Evaluation & Feedback Loop",
    status: "통합 완료",
    source: [
      "D:\\KW-Libra-team-repos\\HJ-agent\\scripts\\evaluation_agent.py",
      "D:\\KW-Libra-team-repos\\HJ-agent\\scripts\\orchestrator.py",
      "D:\\KW-Libra-team-repos\\HJ-agent\\scripts\\result_adapter.py",
    ],
    integrated: [
      "D:\\Libra\\src\\libra_agent\\libra_evaluation.py",
      "D:\\Libra\\src\\libra_agent\\libra_api.py",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\decision\\DecisionRunService.java",
      "D:\\libra-frontend\\src\\pages\\HistoryPage.vue",
    ],
    liveFlow: [
      "저장된 Judge run에 대해 수익률, 비용, 사용자 피드백을 입력합니다.",
      "Agent API의 /v1/evaluations가 방향 정확도와 비용 효율을 계산합니다.",
      "평가 결과는 다음 Judge 요청의 prior reflection 후보로 저장됩니다.",
    ],
    proof: "History 화면에서 판단 평가를 저장하면 backend가 agent evaluation 결과와 reflection을 함께 보관합니다.",
    meetingLine:
      "HJ-agent의 사후 평가 에이전트를 현재 결정 이력과 연결해 판단 개선 루프의 근거로 만들었습니다.",
  },
  {
    repo: "LIBRA KIS Runtime",
    module: "Brokerage Adapter",
    status: "부분 통합",
    source: [
      "KIS Open Trading API",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\integration\\kis",
    ],
    integrated: [
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\integration\\kis\\KisPortfolioSyncService.java",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\integration\\kis\\KisMarketPriceService.java",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\integration\\kis\\KisAccessTokenService.java",
      "D:\\libra-backend\\src\\main\\java\\com\\libra\\api\\decision\\DecisionExecutionProposalItem.java",
      "D:\\libra-frontend\\src\\pages\\HistoryPage.vue",
    ],
    liveFlow: [
      "Profile에서 KIS 인증 정보를 저장합니다.",
      "Dashboard에서 모의투자 잔고와 현재가를 동기화합니다.",
      "History에서 candidate weight delta를 KIS 현재가 기반 주문 수량으로 변환합니다.",
      "REBALANCE 판단에서 Profit/Cost 검토가 끝난 경우에만 모의투자 주문 게이트가 열립니다.",
    ],
    proof: "demo 계정 기준 잔고 동기화, 005930/000660 현재가 조회, 000660 1주/005930 11주 주문 제안까지 확인했습니다.",
    meetingLine:
      "자동매매 전체를 바로 여는 대신 KIS 현재가 기반 주문 제안과 안전 게이트가 있는 모의투자 실행 경로까지 연결했습니다.",
  },
];

const statusCounts = [
  { label: "통합 완료", value: integrations.filter((item) => item.status === "통합 완료").length },
  { label: "부분 통합", value: integrations.filter((item) => item.status === "부분 통합").length },
  { label: "후속 과제", value: integrations.filter((item) => item.status === "후속 과제").length },
];

const proofChecklist = [
  "회원가입 후 초기 설정에서 KIS 종목을 검색하고 목표 비중을 저장한다.",
  "Dashboard에서 KIS 모의투자 잔고와 현재가를 동기화한다.",
  "Judge 실행 결과에서 called agents, skipped agents, candidate plan을 확인한다.",
  "History에서 평가를 저장해 prior reflection 루프를 확인한다.",
];

const deferredItems = [
  "Kafka/WebSocket 실시간 스트리밍 전체 이식",
  "체결 조회, 정정, 취소까지 포함한 주문 라이프사이클",
  "FinBERT, FinGPT, Gemini-Claude 적대 검토 운영화",
  "KIS 구성종목 기반 실제 지수 샘플러",
];

function shortPath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 3) return normalized;
  return `…/${parts.slice(-3).join("/")}`;
}
</script>

<template>
  <article class="agents-page">
    <section class="agents-command">
      <div>
        <span class="eyebrow">Team Integration</span>
        <h1>팀원 레포가 실제 서비스 흐름에 들어간 위치</h1>
        <p>
          발표에서 말로만 설명하지 않도록 원본 레포, 통합된 파일, 실제 사용 흐름,
          검증 포인트를 한 화면에 묶었습니다.
        </p>
      </div>
      <div class="status-strip" aria-label="팀 모듈 통합 상태 요약">
        <div v-for="item in statusCounts" :key="item.label" class="status-tile">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </section>

    <section class="integration-grid" aria-label="팀 레포별 통합 현황">
      <article
        v-for="item in integrations"
        :key="item.repo"
        class="integration-card"
        :data-status="item.status"
      >
        <header>
          <div>
            <span class="repo-name">{{ item.repo }}</span>
            <h2>{{ item.module }}</h2>
          </div>
          <span class="status-pill">{{ item.status }}</span>
        </header>

        <div class="flow-block">
          <span class="block-label">실제 흐름</span>
          <ol>
            <li v-for="step in item.liveFlow" :key="step">{{ step }}</li>
          </ol>
        </div>

        <div class="path-columns">
          <div>
            <span class="block-label">원본</span>
            <ul>
              <li v-for="path in item.source" :key="path">
                <code :title="path">{{ shortPath(path) }}</code>
              </li>
            </ul>
          </div>
          <div>
            <span class="block-label">현재 LIBRA</span>
            <ul>
              <li v-for="path in item.integrated" :key="path">
                <code :title="path">{{ shortPath(path) }}</code>
              </li>
            </ul>
          </div>
        </div>

        <footer>
          <p>{{ item.proof }}</p>
          <strong>{{ item.meetingLine }}</strong>
        </footer>
      </article>
    </section>

    <section class="meeting-proof">
      <div class="proof-panel">
        <span class="eyebrow">Demo Checklist</span>
        <h2>내일 미팅에서 보여줄 순서</h2>
        <ol>
          <li v-for="item in proofChecklist" :key="item">{{ item }}</li>
        </ol>
      </div>

      <div class="proof-panel">
        <span class="eyebrow">Not Hidden</span>
        <h2>아직 남은 범위</h2>
        <ul>
          <li v-for="item in deferredItems" :key="item">{{ item }}</li>
        </ul>
      </div>
    </section>
  </article>
</template>

<style scoped>
.agents-page {
  display: grid;
  gap: 24px;
}

.agents-command {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  gap: 24px;
  align-items: end;
  padding: 28px;
  border: 1px solid var(--line);
  background: var(--paper-2);
}

.eyebrow,
.repo-name,
.block-label {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.agents-command h1,
.proof-panel h2,
.integration-card h2 {
  margin: 0;
  color: var(--ink);
  letter-spacing: 0;
}

.agents-command h1 {
  margin-top: 10px;
  font-size: clamp(28px, 4vw, 48px);
  line-height: 1.05;
}

.agents-command p {
  max-width: 760px;
  margin: 14px 0 0;
  color: var(--ink-2);
  font-size: 16px;
  line-height: 1.7;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.status-tile {
  min-height: 92px;
  padding: 16px;
  border: 1px solid var(--line);
  background: var(--paper-3);
}

.status-tile strong {
  display: block;
  color: var(--ink);
  font-size: 32px;
  line-height: 1;
}

.status-tile span {
  display: block;
  margin-top: 10px;
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 700;
}

.integration-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.integration-card {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--line);
  background: var(--paper-2);
}

.integration-card[data-status="통합 완료"] {
  border-top: 4px solid var(--pos);
}

.integration-card[data-status="부분 통합"] {
  border-top: 4px solid var(--warn);
}

.integration-card header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
}

.integration-card h2 {
  margin-top: 8px;
  font-size: 24px;
}

.status-pill {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid var(--line);
  background: var(--paper-3);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 800;
}

.flow-block,
.proof-panel {
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.flow-block ol,
.proof-panel ol,
.proof-panel ul {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--ink-2);
  line-height: 1.65;
}

.path-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.path-columns ul {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.path-columns code {
  display: block;
  overflow-wrap: anywhere;
  padding: 9px 10px;
  border: 1px solid var(--line);
  background: var(--paper-3);
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.45;
}

.integration-card footer {
  display: grid;
  gap: 10px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.integration-card footer p,
.integration-card footer strong {
  margin: 0;
  color: var(--ink-2);
  line-height: 1.6;
}

.integration-card footer strong {
  color: var(--ink);
}

.meeting-proof {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
}

.proof-panel {
  padding: 22px;
  border: 1px solid var(--line);
  background: var(--paper-2);
}

.proof-panel h2 {
  margin-top: 8px;
  font-size: 22px;
}

@media (max-width: 1120px) {
  .agents-command,
  .integration-grid,
  .meeting-proof {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .agents-command,
  .integration-card,
  .proof-panel {
    padding: 18px;
  }

  .status-strip,
  .path-columns {
    grid-template-columns: 1fr;
  }
}
</style>
