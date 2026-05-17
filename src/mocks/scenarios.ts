/**
 * src/mocks/scenarios.ts v3
 *
 * 4분기 모두 지원 + mediator/final judge reasoning 추가 (보고서 페이지용).
 */

import {
  scenarioFomc,
  type FinalState,
  type AgentSpeech,
  type Direction,
  type Committee,
  type AgentRole,
  type Severity,
  type Branch,
  type DeltaFromRound1,
  type RiskLabel,
  type ComplianceStatus,
  type DecisionOption,
  type ConsensusScore,
  type Stage,
  type TriggerMeta,
  type PortfolioContext,
} from './scenarioFomc'

export {
  scenarioFomc,
  type FinalState,
  type AgentSpeech,
  type Direction,
  type Committee,
  type AgentRole,
  type Severity,
  type Branch,
  type DeltaFromRound1,
  type RiskLabel,
  type ComplianceStatus,
  type DecisionOption,
  type ConsensusScore,
  type Stage,
  type TriggerMeta,
  type PortfolioContext,
}

export interface AutoRebalanceProposal {
  reasoning: string
  trades: Array<{ ticker: string; name: string; change: number }>
  estimatedVolatilityAfter: number
  estimatedCostKrw: number
}

export interface ConservativeProposal {
  reasoning: string
  originalTrades: Array<{ ticker: string; name: string; change: number }>
  conservativeTrades: Array<{ ticker: string; name: string; change: number }>
  reductionFactor: number
  estimatedVolatilityAfter: number
  estimatedCostKrw: number
}

export interface ComplianceVetoOption {
  id: string
  label: string
  description: string
  consequence: string
  tone: 'safe' | 'override' | 'alternative'
}

/**
 * Mediator 판정 — Round 1 후 충돌 식별 및 표적 재호출 결정.
 */
export interface MediatorJudgment {
  detectedConflicts: Array<{
    asset: string
    type: 'direction' | 'magnitude' | 'dimension'
    description: string
  }>
  retargetedAgents: string[]
  reasoning: string
}

/**
 * Final Judge 추론 — 모든 trace 통합 후 최종 분기 결정.
 */
export interface FinalJudgeReasoning {
  weightedScore: number
  branchDecision: string
  reasoning: string
  considerations: string[] // 고려한 주요 사항
}

export interface FinalStateExt extends FinalState {
  autoProposal?: AutoRebalanceProposal
  conservativeProposal?: ConservativeProposal
  vetoOptions?: ComplianceVetoOption[]
  mediatorJudgment?: MediatorJudgment
  finalJudgeReasoning?: FinalJudgeReasoning
}

// =============================================================================
// FOMC (STRONG_CONFLICT) - mediator + final judge 추가
// =============================================================================

const fomcMediator: MediatorJudgment = {
  detectedConflicts: [
    {
      asset: '069500',
      type: 'direction',
      description: 'Profit (INCREASE +3%) vs Risk (DECREASE -5%) — 방향 정반대',
    },
    {
      asset: '069500',
      type: 'dimension',
      description: 'Sentiment는 VKOSPI 급등 강조, Macro는 펀더멘털 변화 없음 강조 — 서로 다른 차원',
    },
  ],
  retargetedAgents: ['Profit', 'Risk', 'Sentiment'],
  reasoning:
    '1차 합의 점수 -0.13으로 임계값(±0.3) 안에 위치, CONFLICT 분기 가능성 큼. 가장 강하게 갈린 Profit과 Risk를 재호출하고, Sentiment는 차원 충돌 해소를 위해 추가 호출. Macro는 의견 강도 약해 재호출 생략.',
}

const fomcFinalJudge: FinalJudgeReasoning = {
  weightedScore: -0.21,
  branchDecision: 'STRONG_CONFLICT → USER_DECISION_REQUIRED',
  reasoning:
    'Round 2 후 합의 점수 -0.21. Profit이 +3 → +1로 약화됐으나 신념 유지, Risk는 confidence 강화. 위원회 의견이 여전히 갈리고 단일 방향 합의 미달. 임계값 |0.3| 이내라 STRONG_CONFLICT 분기. 시스템이 결정을 강요하지 않고 사용자에게 위임.',
  considerations: [
    'Profit의 역발상 매수 신념 (RSI 28 과매도) 유지',
    'Risk의 변동성 한도 초과 우려 강화 (R2)',
    'Macro의 펀더멘털 안정 vs Sentiment의 패닉 — 차원 충돌 미해소',
    'Compliance WARNING (자동 거부 아님) — Final 분기에 영향 없음',
  ],
}

// =============================================================================
// §7.1 KOSPI — STRONG_REBALANCE
// =============================================================================

export const scenarioKospi: FinalStateExt = {
  threadId: 'run_kospi_2026_05_15_001',
  trigger: 'scheduled_monthly_check',
  query: 'KODEX 200 비중 32% — IPS 단일종목 한도(25%) 위반 자동 감지',
  startedAt: '2026-05-15T09:00:08+09:00',
  completedAt: '2026-05-15T09:00:18+09:00',
  durationSeconds: 10.5,
  triggerMeta: {
    type: 'scheduled',
    label: '월간 정기 점검',
    description: '월 1회 IPS 준수 자동 검사',
  },
  context: {
    portfolioName: '내 IPS 포트폴리오',
    affectedAssets: [
      { ticker: '069500', name: 'KODEX 200' },
      { ticker: '153130', name: '단기채권' },
    ],
    currentValueKrw: 47_280_000,
  },
  stages: [
    { name: 'compliance_check', label: 'Compliance', completed: true, durationMs: 110 },
    { name: 'round1', label: 'Round 1', completed: true, durationMs: 3800 },
    { name: 'mediator', label: 'Mediator', completed: true, durationMs: 900 },
    { name: 'round2', label: 'Round 2', completed: true, durationMs: 2800 },
    { name: 'final_judge', label: 'Final Judge', completed: true, durationMs: 2900 },
  ],
  compliance: {
    severity: 'WARNING',
    title: '단일종목 한도 초과',
    detail: '069500 현재 32%, IPS 단일종목 한도 25% — 7%p 초과 (자동 거부 아님, 즉시 해소 권고)',
    ruleId: 'IPS_SINGLE_TICKER_LIMIT',
  },
  speeches: [
    { agent: 'Disclosure', committee: 'CORE', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.5, summary: '관련 공시 없음', reasoning: '오늘 보유 종목 중 신규 공시는 없습니다.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'News', committee: 'CORE', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.55, summary: '특이 헤드라인 없음', reasoning: 'KOSPI 시장 전반 안정적, 거시 이벤트 없음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Report', committee: 'CORE', role: 'opinion', direction: 'DECREASE', magnitude: -3, confidence: 0.7, summary: '단기 +3% 전망 (R2에서 HOLD로 변경)', reasoning: 'Round 1에서 INCREASE(+3%) 권고했으나, Compliance 한도 위반 정보를 본 후 HOLD로 갱신. 한도 위반은 절대선.', deltaFromRound1: 'WEAKENED' },
    { agent: 'Profit', committee: 'CORE', role: 'opinion', direction: 'DECREASE', magnitude: -7, confidence: 0.75, summary: '069500 비중 과다', reasoning: '69500 비중 32%는 분산 효과를 깎습니다. 단기채로 7%p 이동 권고.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Cost', committee: 'CORE', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '거래비용 정상', reasoning: '거래 규모 약 330만원, 수수료·세금 합산 약 1만 5천원 예상. 정상 범위.', deltaFromRound1: null },
    { agent: 'Risk', committee: 'DOMAIN', role: 'opinion', direction: 'DECREASE', magnitude: -7, confidence: 0.85, summary: '단일종목 한도 위반', reasoning: '069500 비중 32%는 IPS 한도(25%)를 7%p 초과. 즉시 축소해야 합니다.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Tax', committee: 'DOMAIN', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '양도세 약 12만원', reasoning: '069500을 7%p 매도 시 양도세 약 12만원 발생. 거래 결정에 영향 미미.', deltaFromRound1: null },
    { agent: 'Macro', committee: 'DOMAIN', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.6, summary: '거시 환경 안정', reasoning: '한국 거시 지표 안정적. 매크로 측면에서 매도 사유 없음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Sentiment', committee: 'DOMAIN', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.55, summary: '시장 sentiment 중립', reasoning: 'VKOSPI 정상 범위.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Execution', committee: 'DOMAIN', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '단일 체결 가능', reasoning: '일중 거래량 충분, 단일 체결 가능. 슬리피지 미미.', deltaFromRound1: null },
    { agent: 'ESG', committee: 'DOMAIN', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.5, summary: '해당 사항 없음', reasoning: '관련 종목 모두 ESG 정책 부합.', deltaFromRound1: 'UNCHANGED' },
  ],
  consensus: { round1: -0.42, round2: -0.74, branch: 'STRONG_REBALANCE', thresholds: { strong: 0.6, weak: 0.3 } },
  options: [],
  autoProposal: {
    reasoning: '위원회 합의 점수 -0.74 (STRONG_CONSENSUS · DECREASE). Risk·Profit이 강하게 일치, Report는 Round 2에서 한도 위반을 인지하고 합의에 합류. 시스템이 단일종목 한도 위반을 자동 해소합니다.',
    trades: [
      { ticker: '069500', name: 'KODEX 200', change: -7 },
      { ticker: '153130', name: '단기채권', change: +7 },
    ],
    estimatedVolatilityAfter: 18,
    estimatedCostKrw: 27_000,
  },
  mediatorJudgment: {
    detectedConflicts: [
      {
        asset: '069500',
        type: 'direction',
        description: 'Report (INCREASE +3%) vs Risk/Profit (DECREASE) — 방향 정반대',
      },
    ],
    retargetedAgents: ['Report'],
    reasoning:
      '1차 합의 점수 -0.42, WEAK_CONSENSUS 측 (DECREASE). Report만 INCREASE로 다른 의견. Risk·Profit이 강한 합의이므로 Report에게 한도 위반 정보를 다시 노출하여 의견 갱신 기회 제공.',
  },
  finalJudgeReasoning: {
    weightedScore: -0.74,
    branchDecision: 'STRONG_REBALANCE → 자동 처리',
    reasoning:
      'Round 2 후 합의 점수 -0.74. Report가 한도 위반 인지 후 HOLD로 갱신 (WEAKENED), 다른 의견자들과 정렬. 임계값 |0.6| 초과로 STRONG_CONSENSUS. Compliance WARNING도 같은 방향(축소) 지지. 시스템이 자동으로 trade를 산정해 권고.',
    considerations: [
      'Risk·Profit의 DECREASE -7% 강한 일치',
      'Report의 R2 의견 갱신 (한도 위반 인지)',
      'Compliance WARNING 방향과 일치',
      '거래 비용 ₩27,000 — 정상 범위',
    ],
  },
}

// =============================================================================
// §7.3 방산 ETF — COMPLIANCE_VETO
// =============================================================================

export const scenarioEsg: FinalStateExt = {
  threadId: 'run_esg_2026_05_15_002',
  trigger: 'user_request',
  query: '사용자 요청 — "방산 ETF(449450) 추가 검토"',
  startedAt: '2026-05-15T11:42:08+09:00',
  completedAt: '2026-05-15T11:42:20+09:00',
  durationSeconds: 12.0,
  triggerMeta: {
    type: 'manual',
    label: '사용자 요청 검토',
    description: '사용자가 직접 요청한 종목 추가 검토',
  },
  context: {
    portfolioName: '내 IPS 포트폴리오',
    affectedAssets: [{ ticker: '449450', name: '방산 ETF (KODEX 방위)' }],
    currentValueKrw: 47_280_000,
  },
  stages: [
    { name: 'compliance_check', label: 'Compliance', completed: true, durationMs: 140 },
    { name: 'round1', label: 'Round 1', completed: true, durationMs: 4200 },
    { name: 'mediator', label: 'Mediator', completed: true, durationMs: 1000 },
    { name: 'round2', label: 'Round 2', completed: true, durationMs: 3200 },
    { name: 'final_judge', label: 'Final Judge', completed: true, durationMs: 3460 },
  ],
  compliance: {
    severity: 'BLOCKING',
    title: 'ESG 정책 위반 — 자동 거래 차단',
    detail: '사용자가 명시 제외한 WEAPONS 섹터 (449450 방산 ETF) 매수 시도. Hard rule violation.',
    ruleId: 'ESG_USER_EXCLUSION',
  },
  speeches: [
    { agent: 'Disclosure', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 4, confidence: 0.7, summary: '실적 호조 공시', reasoning: '449450 구성 기업들의 최근 실적이 컨센서스를 상회.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'News', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 5, confidence: 0.8, summary: '방산 강세 헤드라인', reasoning: '글로벌 방위비 증액 흐름, 한국 방산 수출 호조. 449450 매수 권고.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Report', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 4, confidence: 0.7, summary: '컨센서스 STRONG_BUY', reasoning: '주요 IB의 449450 컨센서스가 STRONG_BUY. 12개월 목표가 +18%.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Profit', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 5, confidence: 0.8, summary: '기대수익 + 분산효과', reasoning: '예상 수익률 높고, 기존 포트폴리오와 상관계수 낮아 분산효과 ↑.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Cost', committee: 'CORE', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '거래비용 정상', reasoning: '거래 비용 약 5천원, 정상 범위.', deltaFromRound1: null },
    { agent: 'Risk', committee: 'DOMAIN', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.6, summary: '위험 적정', reasoning: '추가 시 변동성 +1.5%p, IPS 한도 내. 단독 risk 측면 문제 없음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Tax', committee: 'DOMAIN', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '세영향 미미', reasoning: '신규 매수, 양도세 미발생.', deltaFromRound1: null },
    { agent: 'Macro', committee: 'DOMAIN', role: 'opinion', direction: 'INCREASE', magnitude: 2, confidence: 0.6, summary: '거시 흐름 우호적', reasoning: '글로벌 안보 환경 변화로 방산 섹터 거시 측면 우호.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Sentiment', committee: 'DOMAIN', role: 'opinion', direction: 'INCREASE', magnitude: 3, confidence: 0.7, summary: '시장 sentiment 강세', reasoning: '방산 sentiment 지수 상위 5% 진입.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Execution', committee: 'DOMAIN', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '유동성 양호', reasoning: '일중 거래량 충분.', deltaFromRound1: null },
    { agent: 'ESG', committee: 'DOMAIN', role: 'opinion', direction: 'DECREASE', magnitude: -5, confidence: 0.95, summary: 'WEAPONS 섹터 — 사용자 제외', reasoning: '사용자가 IPS에서 WEAPONS 섹터를 명시 제외함. 449450은 그 섹터에 해당. 매수 비추.', deltaFromRound1: 'STRENGTHENED' },
  ],
  consensus: { round1: 0.52, round2: 0.57, branch: 'COMPLIANCE_VETO', thresholds: { strong: 0.6, weak: 0.3 } },
  options: [],
  vetoOptions: [
    { id: 'cancel', label: '거래 취소', description: '시스템 추천 default. ESG 정책 유지.', consequence: '아무 변동 없음. 포트폴리오 그대로 유지.', tone: 'safe' },
    { id: 'override', label: 'ESG 정책 일시 완화', description: '이번 거래에 한해 WEAPONS 섹터 허용 명시 동의.', consequence: '449450 +5% 매수. ESG 정책은 다음 거래부터 다시 적용. 명시 동의 기록 저장.', tone: 'override' },
    { id: 'alternative', label: '대체 자산으로 검토', description: 'ESG 정책 위반하지 않는 유사 종목 탐색.', consequence: 'Profit·Risk가 KODEX 200(069500) +3% 대체안 제시. 방산 노출은 간접적으로.', tone: 'alternative' },
  ],
  mediatorJudgment: {
    detectedConflicts: [
      {
        asset: '449450',
        type: 'direction',
        description: 'ESG (DECREASE -5%) vs Core 전체 (INCREASE) — 방향 정반대',
      },
      {
        asset: '449450',
        type: 'dimension',
        description: 'Profit/News는 시장 기회 강조, ESG는 사용자 정책 강조 — 서로 다른 차원',
      },
    ],
    retargetedAgents: ['ESG', 'Profit', 'News'],
    reasoning:
      '1차 합의 점수 +0.52, WEAK INCREASE 측. 그러나 ESG가 강한 반대(-5%, confidence 0.95). 차원 충돌이 핵심 — ESG를 재호출해 *사용자 정책의 강제성* 을 다시 확인, Profit/News에는 ESG 우려를 노출.',
  },
  finalJudgeReasoning: {
    weightedScore: 0.57,
    branchDecision: 'COMPLIANCE_VETO → 자동 거래 차단',
    reasoning:
      'Round 2 후 합의 점수 +0.57. 위원회 다수(5/6 Core + 일부 Domain)가 INCREASE 지지. 그러나 Compliance Rule Engine이 BLOCKING 판정 — 사용자가 명시 동의한 ESG 정책(WEAPONS 섹터 제외) 위반. Final Judge의 합의 분기 결정과 무관하게 *Compliance veto가 다른 모든 분기를 무시* 함. 사용자에게 3개 후속 옵션 제시.',
    considerations: [
      '위원회 합의는 INCREASE 방향 (+0.57, WEAK_CONSENSUS)',
      'ESG의 강한 반대 (DECREASE -5%, confidence 0.95)',
      'Compliance Rule Engine BLOCKING (ESG_USER_EXCLUSION)',
      'Hard rule이 LLM 추론을 우회 — 자동 trade 실행 차단',
      '사용자 명시 동의 없이 정책 우회 불가',
    ],
  },
}

// =============================================================================
// WEAK_CONSERVATIVE - 단기채 조정
// =============================================================================

export const scenarioWeak: FinalStateExt = {
  threadId: 'run_weak_2026_05_15_003',
  trigger: 'scheduled_weekly_check',
  query: '단기채(153130) 비중 조정 — 약한 합의 도출',
  startedAt: '2026-05-15T15:20:08+09:00',
  completedAt: '2026-05-15T15:20:19+09:00',
  durationSeconds: 11.4,
  triggerMeta: {
    type: 'scheduled',
    label: '주간 정기 점검',
    description: '주 1회 포트폴리오 균형 자동 검토',
  },
  context: {
    portfolioName: '내 IPS 포트폴리오',
    affectedAssets: [
      { ticker: '153130', name: '단기채권' },
      { ticker: '069500', name: 'KODEX 200' },
    ],
    currentValueKrw: 47_280_000,
  },
  stages: [
    { name: 'compliance_check', label: 'Compliance', completed: true, durationMs: 100 },
    { name: 'round1', label: 'Round 1', completed: true, durationMs: 4100 },
    { name: 'mediator', label: 'Mediator', completed: true, durationMs: 1100 },
    { name: 'round2', label: 'Round 2', completed: true, durationMs: 3200 },
    { name: 'final_judge', label: 'Final Judge', completed: true, durationMs: 2900 },
  ],
  compliance: {
    severity: 'PASS',
    title: '제약 조건 모두 충족',
    detail: '단일종목 한도 / 변동성 / ESG 정책 모두 통과',
    ruleId: 'IPS_ALL_RULES',
  },
  speeches: [
    { agent: 'Disclosure', committee: 'CORE', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.5, summary: '관련 공시 없음', reasoning: '단기채권 구성 종목 중 신규 공시 없음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'News', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 2, confidence: 0.55, summary: '금리 동결 전망', reasoning: '주요 매체에서 다음 금리 결정 동결 전망. 단기채에 우호적이나 강한 시그널 아님.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Report', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 3, confidence: 0.6, summary: '안정자산 비중 확대 추천', reasoning: 'IB 컨센서스에서 단기 변동성 확대 가능성, 안정자산 비중 소폭 확대 권고.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Profit', committee: 'CORE', role: 'opinion', direction: 'INCREASE', magnitude: 4, confidence: 0.55, summary: '리스크 대비 수익 비율 양호', reasoning: '단기채 수익률 안정적, 변동성 대비 수익 비율 양호. +4%p 권고하나 확신도 낮음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Cost', committee: 'CORE', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '거래비용 미미', reasoning: '단기채 거래 비용 약 5천원. 영향 무시 가능.', deltaFromRound1: null },
    { agent: 'Risk', committee: 'DOMAIN', role: 'opinion', direction: 'INCREASE', magnitude: 3, confidence: 0.6, summary: '변동성 관점에서 우호', reasoning: '단기채 비중 확대는 포트폴리오 변동성 감소에 기여. 그러나 한도 미달이라 시급성 낮음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Tax', committee: 'DOMAIN', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '세영향 미미', reasoning: '단기채 매매 양도세 영향 거의 없음.', deltaFromRound1: null },
    { agent: 'Macro', committee: 'DOMAIN', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.5, summary: '거시 환경 중립', reasoning: '경제 펀더멘털 안정. 매크로 측면에서 비중 조정 사유 강하지 않음.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Sentiment', committee: 'DOMAIN', role: 'opinion', direction: 'INCREASE', magnitude: 2, confidence: 0.5, summary: '안정자산 선호 약간 ↑', reasoning: '시장 sentiment 지표상 안정자산 선호도 약간 상승. 강한 시그널 아님.', deltaFromRound1: 'UNCHANGED' },
    { agent: 'Execution', committee: 'DOMAIN', role: 'informational', direction: 'HOLD', magnitude: 0, confidence: 0, summary: '체결 양호', reasoning: '단일 체결 가능, 슬리피지 없음.', deltaFromRound1: null },
    { agent: 'ESG', committee: 'DOMAIN', role: 'opinion', direction: 'HOLD', magnitude: 0, confidence: 0.5, summary: '해당 사항 없음', reasoning: '단기채는 ESG 정책 적용 대상 아님.', deltaFromRound1: 'UNCHANGED' },
  ],
  consensus: { round1: 0.38, round2: 0.42, branch: 'WEAK_CONSERVATIVE', thresholds: { strong: 0.6, weak: 0.3 } },
  options: [],
  conservativeProposal: {
    reasoning: '위원회 합의 점수 +0.42 (WEAK_CONSENSUS · INCREASE). 한 방향 합의는 있으나 강도가 약하고 confidence도 전반적으로 낮음 (평균 0.55). 시스템이 권고 강도를 절반으로 줄여 보수적으로 처리합니다.',
    originalTrades: [
      { ticker: '153130', name: '단기채권', change: +4 },
      { ticker: '069500', name: 'KODEX 200', change: -4 },
    ],
    conservativeTrades: [
      { ticker: '153130', name: '단기채권', change: +2 },
      { ticker: '069500', name: 'KODEX 200', change: -2 },
    ],
    reductionFactor: 0.5,
    estimatedVolatilityAfter: 22,
    estimatedCostKrw: 8_500,
  },
  mediatorJudgment: {
    detectedConflicts: [
      {
        asset: '153130',
        type: 'magnitude',
        description: 'Profit (+4%) vs Sentiment (+2%) — 같은 방향이지만 강도 차이',
      },
    ],
    retargetedAgents: [],
    reasoning:
      '1차 합의 점수 +0.38, WEAK INCREASE 측. 방향 충돌 없음, 강도 차이만 존재 — confidence 평균 0.55로 전반적으로 약함. 표적 재호출 생략, Round 2는 형식적 검토로 진행. 결과적으로 의견 거의 동일 유지.',
  },
  finalJudgeReasoning: {
    weightedScore: 0.42,
    branchDecision: 'WEAK_CONSERVATIVE → 권고 강도 50% 반영',
    reasoning:
      'Round 2 후 합의 점수 +0.42. 임계값 |0.3| 초과로 한 방향 합의는 있으나, |0.6| 미만이라 강한 합의는 아님. 위원회 평균 confidence 0.55로 전반적으로 낮음. 시스템이 원안(Profit +4%)을 절반(+2%)으로 축소 적용 — *약한 합의에는 보수적 대응* 사상.',
    considerations: [
      'Profit·Report·Risk가 같은 방향 (INCREASE) 지지',
      '평균 confidence 0.55 (낮음)',
      'Macro·ESG는 HOLD — 강한 반대 없음',
      'Compliance PASS — 제약 위반 없음',
      '권고 강도 ×0.5 (사용자 IPS 정책)',
    ],
  },
}

// =============================================================================
// 시나리오 매핑
// =============================================================================

// FOMC mock에 mediator + final judge 주입
const scenarioFomcExt: FinalStateExt = {
  ...(scenarioFomc as FinalStateExt),
  mediatorJudgment: fomcMediator,
  finalJudgeReasoning: fomcFinalJudge,
}

export function resolveScenario(threadId: string): FinalStateExt {
  if (threadId.startsWith('run_kospi')) return scenarioKospi
  if (threadId.startsWith('run_esg')) return scenarioEsg
  if (threadId.startsWith('run_weak')) return scenarioWeak
  return scenarioFomcExt
}

export const scenarioCatalog = [
  { id: 'fomc', label: 'FOMC 깜짝 인상 (충돌 → 위임)', description: '위원회 의견이 갈리고 시스템이 사용자에게 위임', branch: 'STRONG_CONFLICT' as const, threadIdPrefix: 'run_fomc' },
  { id: 'kospi', label: '한도 위반 자동 해소 (강한 합의)', description: '위원회가 일치하여 시스템이 자동 처리', branch: 'STRONG_REBALANCE' as const, threadIdPrefix: 'run_kospi' },
  { id: 'weak', label: '단기채 조정 (약한 합의 → 보수적)', description: '한 방향 합의지만 강도 약함, 권고 강도 50% 반영', branch: 'WEAK_CONSERVATIVE' as const, threadIdPrefix: 'run_weak' },
  { id: 'esg', label: '방산 ETF (정책 거부)', description: '위원회 다수 찬성이지만 ESG 정책으로 차단', branch: 'COMPLIANCE_VETO' as const, threadIdPrefix: 'run_esg' },
]