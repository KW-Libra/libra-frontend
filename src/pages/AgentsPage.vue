<script setup lang="ts">
type EngineStatus = "사용 가능" | "확인 필요" | "후속 작업";

type EngineCapability = {
  name: string;
  status: EngineStatus;
  summary: string;
  flow: string[];
  signals: string[];
  verification: string;
};

const capabilities: EngineCapability[] = [
  {
    name: "초기 포트폴리오 설정",
    status: "사용 가능",
    summary: "회원가입 후 투자 성향, 운용 금액, 목표 종목, 목표 비중을 먼저 확정합니다.",
    flow: [
      "사용자가 KIS 종목 검색으로 편입 후보를 찾습니다.",
      "선택한 종목과 목표 비중을 저장합니다.",
      "저장된 목표 비중이 Dashboard와 Judge 입력으로 이어집니다.",
    ],
    signals: ["투자 성향", "초기 운용 금액", "목표 종목", "목표 비중"],
    verification: "초기 설정에서 005930, 000660을 선택한 뒤 목표 비중 저장과 판단 실행까지 확인합니다.",
  },
  {
    name: "KIS 잔고·시세 동기화",
    status: "확인 필요",
    summary: "모의투자 계정의 잔고와 현재가를 받아 현재 포트폴리오 상태를 갱신합니다.",
    flow: [
      "Profile에서 KIS 모의투자 인증 정보를 저장합니다.",
      "Dashboard에서 잔고 동기화와 현재가 조회를 실행합니다.",
      "후보 리밸런싱 비중을 현재가 기준 주문 수량으로 변환합니다.",
    ],
    signals: ["보유 종목", "평가 금액", "현재가", "주문 가능 수량"],
    verification: "KIS 응답 실패 시 화면에 모의/실전 환경과 오류 원인이 분리되어 표시되어야 합니다.",
  },
  {
    name: "Judge 판단 흐름",
    status: "사용 가능",
    summary: "Judge가 필요한 관점을 순서대로 호출하고, 호출·건너뜀·최종 판단을 trace로 남깁니다.",
    flow: [
      "공시와 뉴스로 현재 사건 신호를 확인합니다.",
      "후보 리밸런싱이 있으면 수익성과 비용 검토를 붙입니다.",
      "필요 시 7개 판단 관점까지 확장해 최종 결론을 만듭니다.",
    ],
    signals: ["호출된 관점", "건너뛴 관점", "후보 조정안", "판단 기록"],
    verification: "판단 과정 화면에서 turn별 호출 순서와 근거 문장을 확인합니다.",
  },
  {
    name: "7개 판단 관점",
    status: "사용 가능",
    summary: "리스크, 세금, 규정, 매크로, 감성, 체결, ESG 관점이 같은 후보안을 별도로 검토합니다.",
    flow: [
      "각 관점이 approve, reject, abstain 중 하나의 의견을 냅니다.",
      "Compliance는 사용자 조건 위반 시 단독 차단권을 가집니다.",
      "합의 결과는 최종 판단의 보조 근거로 저장됩니다.",
    ],
    signals: ["Risk", "Tax", "Compliance", "Macro", "Sentiment", "Execution", "ESG"],
    verification: "에이전트 테스트에서 7개 관점이 모두 응답 목록과 decision trace에 포함되는지 검증합니다.",
  },
  {
    name: "사후 평가와 판단 기억",
    status: "후속 작업",
    summary: "실행 후 결과와 사용자 피드백을 저장해 다음 판단에서 참고할 수 있게 만듭니다.",
    flow: [
      "History에서 과거 판단과 후보 주문을 확인합니다.",
      "성과, 비용, 사용자 피드백을 판단 이력에 연결합니다.",
      "다음 Judge 실행 때 prior reflection 후보로 활용합니다.",
    ],
    signals: ["판단 결과", "사용자 피드백", "성과 평가", "reflection"],
    verification: "저장된 평가가 다음 판단 요청의 보조 맥락으로 들어가는지 통합 테스트가 필요합니다.",
  },
];

const statusCounts = [
  { label: "사용 가능", value: capabilities.filter((item) => item.status === "사용 가능").length },
  { label: "확인 필요", value: capabilities.filter((item) => item.status === "확인 필요").length },
  { label: "후속 작업", value: capabilities.filter((item) => item.status === "후속 작업").length },
];

const demoChecklist = [
  "초기 설정에서 KIS 종목을 검색하고 목표 비중을 저장한다.",
  "Dashboard에서 KIS 모의투자 잔고와 현재가를 동기화한다.",
  "Judge 실행 후 판단 과정에서 호출·건너뜀·후보 조정안을 확인한다.",
  "7개 판단 관점 카드가 응답 상태와 근거를 표시하는지 확인한다.",
  "History에서 판단 결과와 평가 저장 흐름을 확인한다.",
];

const remainingItems = [
  "브라우저에서 회원가입부터 판단 저장까지 관통하는 자동 E2E",
  "KIS 주문 체결 조회, 정정, 취소까지 포함한 주문 라이프사이클",
  "뉴스·리포트 수집 데이터의 운영 품질 모니터링",
  "사후 평가 결과를 다음 Judge 판단에 넣는 폐루프 검증",
];
</script>

<template>
  <article class="agents-page">
    <section class="agents-command">
      <div>
        <span class="eyebrow">Agent Health</span>
        <h1>LIBRA 판단 엔진이 지금 무엇을 검토하는지 보여줍니다.</h1>
        <p>
          이 화면은 내부 구현 출처가 아니라 실제 서비스 흐름 기준으로
          초기 설정, KIS 동기화, Judge 판단, 7개 관점 합의, 사후 평가 상태를 정리합니다.
        </p>
      </div>
      <div class="status-strip" aria-label="판단 엔진 상태 요약">
        <div v-for="item in statusCounts" :key="item.label" class="status-tile">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </section>

    <section class="integration-grid" aria-label="판단 엔진 기능 상태">
      <article
        v-for="item in capabilities"
        :key="item.name"
        class="integration-card"
        :data-status="item.status"
      >
        <header>
          <div>
            <span class="capability-name">{{ item.status }}</span>
            <h2>{{ item.name }}</h2>
          </div>
          <span class="status-pill">{{ item.status }}</span>
        </header>

        <p class="capability-summary">{{ item.summary }}</p>

        <div class="flow-block">
          <span class="block-label">실제 흐름</span>
          <ol>
            <li v-for="step in item.flow" :key="step">{{ step }}</li>
          </ol>
        </div>

        <div class="signal-list">
          <span class="block-label">판단 입력</span>
          <ul>
            <li v-for="signal in item.signals" :key="signal">{{ signal }}</li>
          </ul>
        </div>

        <footer>
          <span class="block-label">검증 포인트</span>
          <p>{{ item.verification }}</p>
        </footer>
      </article>
    </section>

    <section class="meeting-proof">
      <div class="proof-panel">
        <span class="eyebrow">Demo Checklist</span>
        <h2>시연 순서</h2>
        <ol>
          <li v-for="item in demoChecklist" :key="item">{{ item }}</li>
        </ol>
      </div>

      <div class="proof-panel">
        <span class="eyebrow">Open Work</span>
        <h2>남은 검증 범위</h2>
        <ul>
          <li v-for="item in remainingItems" :key="item">{{ item }}</li>
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
.capability-name,
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
  max-width: 920px;
  font-size: clamp(28px, 4vw, 48px);
  line-height: 1.08;
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
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--line);
  background: var(--paper-2);
}

.integration-card[data-status="사용 가능"] {
  border-top: 4px solid var(--pos);
}

.integration-card[data-status="확인 필요"] {
  border-top: 4px solid var(--warn);
}

.integration-card[data-status="후속 작업"] {
  border-top: 4px solid var(--ink-3);
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

.capability-summary {
  margin: 0;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.65;
}

.flow-block,
.proof-panel,
.signal-list,
.integration-card footer {
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

.signal-list ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.signal-list li {
  padding: 8px 10px;
  border: 1px solid var(--line);
  background: var(--paper-3);
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 700;
}

.integration-card footer {
  display: grid;
  gap: 10px;
}

.integration-card footer p {
  margin: 0;
  color: var(--ink-2);
  line-height: 1.6;
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

  .status-strip {
    grid-template-columns: 1fr;
  }
}
</style>
