/**
 * src/mocks/scenarios.ts
 *
 * 세 시나리오 통합 + 분기별 추가 타입.
 *
 * - FOMC (§7.2) → STRONG_CONFLICT (USER_DECISION_REQUIRED)
 * - KOSPI 한도 위반 (§7.1) → STRONG_REBALANCE
 * - 방산 ETF ESG (§7.3) → COMPLIANCE_VETO
 *
 * 기존 scenarioFomc.ts의 타입을 재export하고 두 시나리오 추가.
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

// 재export
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

// =============================================================================
// 분기별 결정 영역 추가 데이터
// =============================================================================

/**
 * STRONG_REBALANCE 분기 — 자동 리밸런싱 권고.
 * 위원회가 일치 → 시스템이 자동 결정 trade를 산정.
 */
export interface AutoRebalanceProposal {
  reasoning: string
  trades: Array<{
    ticker: string
    name: string
    change: number // 비중 변화 % (음수=매도, 양수=매수)
  }>
  estimatedVolatilityAfter: number
  estimatedCostKrw: number
}

/**
 * COMPLIANCE_VETO 분기 — 위원회 합의가 있어도 hard rule이 막음.
 * 사용자에게 3개의 후속 옵션 제시.
 */
export interface ComplianceVetoOption {
  id: string
  label: string
  description: string
  consequence: string
  tone: 'safe' | 'override' | 'alternative'
}

// =============================================================================
// §7.1 KOSPI 한도 위반 — STRONG_REBALANCE
// =============================================================================

export interface FinalStateExt extends FinalState {
  autoProposal?: AutoRebalanceProposal
  vetoOptions?: ComplianceVetoOption[]
}

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
    {
      agent: 'Disclosure', committee: 'CORE', role: 'opinion',
      direction: 'HOLD', magnitude: 0, confidence: 0.5,
      summary: '관련 공시 없음',
      reasoning: '오늘 보유 종목 중 신규 공시는 없습니다.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'News', committee: 'CORE', role: 'opinion',
      direction: 'HOLD', magnitude: 0, confidence: 0.55,
      summary: '특이 헤드라인 없음',
      reasoning: 'KOSPI 시장 전반 안정적, 거시 이벤트 없음.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Report', committee: 'CORE', role: 'opinion',
      direction: 'DECREASE', magnitude: -3, confidence: 0.7,
      summary: '단기 +3% 전망 (R2에서 HOLD로 변경)',
      reasoning: 'Round 1에서 INCREASE(+3%) 권고했으나, Compliance 한도 위반 정보를 본 후 HOLD로 갱신. 한도 위반은 절대선.',
      deltaFromRound1: 'WEAKENED',
    },
    {
      agent: 'Profit', committee: 'CORE', role: 'opinion',
      direction: 'DECREASE', magnitude: -7, confidence: 0.75,
      summary: '069500 비중 과다',
      reasoning: '69500 비중 32%는 분산 효과를 깎습니다. 단기채로 7%p 이동 권고.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Cost', committee: 'CORE', role: 'informational',
      direction: 'HOLD', magnitude: 0, confidence: 0,
      summary: '거래비용 정상',
      reasoning: '거래 규모 약 330만원, 수수료·세금 합산 약 1만 5천원 예상. 정상 범위.',
      deltaFromRound1: null,
    },
    {
      agent: 'Risk', committee: 'DOMAIN', role: 'opinion',
      direction: 'DECREASE', magnitude: -7, confidence: 0.85,
      summary: '단일종목 한도 위반',
      reasoning: '069500 비중 32%는 IPS 한도(25%)를 7%p 초과. 즉시 축소해야 합니다.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Tax', committee: 'DOMAIN', role: 'informational',
      direction: 'HOLD', magnitude: 0, confidence: 0,
      summary: '양도세 약 12만원',
      reasoning: '069500을 7%p 매도 시 양도세 약 12만원 발생. 거래 결정에 영향 미미.',
      deltaFromRound1: null,
    },
    {
      agent: 'Macro', committee: 'DOMAIN', role: 'opinion',
      direction: 'HOLD', magnitude: 0, confidence: 0.6,
      summary: '거시 환경 안정',
      reasoning: '한국 거시 지표 안정적. 매크로 측면에서 매도 사유 없음.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Sentiment', committee: 'DOMAIN', role: 'opinion',
      direction: 'HOLD', magnitude: 0, confidence: 0.55,
      summary: '시장 sentiment 중립',
      reasoning: 'VKOSPI 정상 범위.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Execution', committee: 'DOMAIN', role: 'informational',
      direction: 'HOLD', magnitude: 0, confidence: 0,
      summary: '단일 체결 가능',
      reasoning: '일중 거래량 충분, 단일 체결 가능. 슬리피지 미미.',
      deltaFromRound1: null,
    },
    {
      agent: 'ESG', committee: 'DOMAIN', role: 'opinion',
      direction: 'HOLD', magnitude: 0, confidence: 0.5,
      summary: '해당 사항 없음',
      reasoning: '관련 종목 모두 ESG 정책 부합.',
      deltaFromRound1: 'UNCHANGED',
    },
  ],

  consensus: {
    round1: -0.42,
    round2: -0.74,
    branch: 'STRONG_REBALANCE',
    thresholds: { strong: 0.6, weak: 0.3 },
  },

  options: [], // STRONG_REBALANCE는 옵션 없음, autoProposal 사용

  autoProposal: {
    reasoning:
      '위원회 합의 점수 -0.74 (STRONG_CONSENSUS · DECREASE). Risk·Profit이 강하게 일치, Report는 Round 2에서 한도 위반을 인지하고 합의에 합류. 시스템이 단일종목 한도 위반을 자동 해소합니다.',
    trades: [
      { ticker: '069500', name: 'KODEX 200', change: -7 },
      { ticker: '153130', name: '단기채권', change: +7 },
    ],
    estimatedVolatilityAfter: 18,
    estimatedCostKrw: 27_000,
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
    {
      agent: 'Disclosure', committee: 'CORE', role: 'opinion',
      direction: 'INCREASE', magnitude: 4, confidence: 0.7,
      summary: '실적 호조 공시',
      reasoning: '449450 구성 기업들의 최근 실적이 컨센서스를 상회.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'News', committee: 'CORE', role: 'opinion',
      direction: 'INCREASE', magnitude: 5, confidence: 0.8,
      summary: '방산 강세 헤드라인',
      reasoning: '글로벌 방위비 증액 흐름, 한국 방산 수출 호조. 449450 매수 권고.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Report', committee: 'CORE', role: 'opinion',
      direction: 'INCREASE', magnitude: 4, confidence: 0.7,
      summary: '컨센서스 STRONG_BUY',
      reasoning: '주요 IB의 449450 컨센서스가 STRONG_BUY. 12개월 목표가 +18%.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Profit', committee: 'CORE', role: 'opinion',
      direction: 'INCREASE', magnitude: 5, confidence: 0.8,
      summary: '기대수익 + 분산효과',
      reasoning: '예상 수익률 높고, 기존 포트폴리오와 상관계수 낮아 분산효과 ↑.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Cost', committee: 'CORE', role: 'informational',
      direction: 'HOLD', magnitude: 0, confidence: 0,
      summary: '거래비용 정상',
      reasoning: '거래 비용 약 5천원, 정상 범위.',
      deltaFromRound1: null,
    },
    {
      agent: 'Risk', committee: 'DOMAIN', role: 'opinion',
      direction: 'HOLD', magnitude: 0, confidence: 0.6,
      summary: '위험 적정',
      reasoning: '추가 시 변동성 +1.5%p, IPS 한도 내. 단독 risk 측면 문제 없음.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Tax', committee: 'DOMAIN', role: 'informational',
      direction: 'HOLD', magnitude: 0, confidence: 0,
      summary: '세영향 미미',
      reasoning: '신규 매수, 양도세 미발생.',
      deltaFromRound1: null,
    },
    {
      agent: 'Macro', committee: 'DOMAIN', role: 'opinion',
      direction: 'INCREASE', magnitude: 2, confidence: 0.6,
      summary: '거시 흐름 우호적',
      reasoning: '글로벌 안보 환경 변화로 방산 섹터 거시 측면 우호.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Sentiment', committee: 'DOMAIN', role: 'opinion',
      direction: 'INCREASE', magnitude: 3, confidence: 0.7,
      summary: '시장 sentiment 강세',
      reasoning: '방산 sentiment 지수 상위 5% 진입.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Execution', committee: 'DOMAIN', role: 'informational',
      direction: 'HOLD', magnitude: 0, confidence: 0,
      summary: '유동성 양호',
      reasoning: '일중 거래량 충분.',
      deltaFromRound1: null,
    },
    {
      agent: 'ESG', committee: 'DOMAIN', role: 'opinion',
      direction: 'DECREASE', magnitude: -5, confidence: 0.95,
      summary: 'WEAPONS 섹터 — 사용자 제외',
      reasoning:
        '사용자가 IPS에서 WEAPONS 섹터를 명시 제외함. 449450은 그 섹터에 해당. 매수 비추.',
      deltaFromRound1: 'STRENGTHENED',
    },
  ],

  consensus: {
    round1: 0.52,
    round2: 0.57,
    branch: 'COMPLIANCE_VETO',
    thresholds: { strong: 0.6, weak: 0.3 },
  },

  options: [], // COMPLIANCE_VETO는 다른 옵션 사용, vetoOptions 참조

  vetoOptions: [
    {
      id: 'cancel',
      label: '거래 취소',
      description: '시스템 추천 default. ESG 정책 유지.',
      consequence: '아무 변동 없음. 포트폴리오 그대로 유지.',
      tone: 'safe',
    },
    {
      id: 'override',
      label: 'ESG 정책 일시 완화',
      description: '이번 거래에 한해 WEAPONS 섹터 허용 명시 동의.',
      consequence: '449450 +5% 매수. ESG 정책은 다음 거래부터 다시 적용. 명시 동의 기록 저장.',
      tone: 'override',
    },
    {
      id: 'alternative',
      label: '대체 자산으로 검토',
      description: 'ESG 정책 위반하지 않는 유사 종목 탐색.',
      consequence: 'Profit·Risk가 KODEX 200(069500) +3% 대체안 제시. 방산 노출은 간접적으로.',
      tone: 'alternative',
    },
  ],
}

// =============================================================================
// 시나리오 매핑 — threadId prefix로 결정
// =============================================================================

export function resolveScenario(threadId: string): FinalStateExt {
  if (threadId.startsWith('run_kospi')) return scenarioKospi
  if (threadId.startsWith('run_esg')) return scenarioEsg
  // default — FOMC (기존 USER_DECISION)
  return scenarioFomc as FinalStateExt
}

export const scenarioCatalog = [
  {
    id: 'fomc',
    label: 'FOMC 깜짝 인상 (충돌 → 위임)',
    description: '위원회 의견이 갈리고 시스템이 사용자에게 위임',
    branch: 'STRONG_CONFLICT' as const,
    threadIdPrefix: 'run_fomc',
  },
  {
    id: 'kospi',
    label: '한도 위반 자동 해소 (강한 합의)',
    description: '위원회가 일치하여 시스템이 자동 처리',
    branch: 'STRONG_REBALANCE' as const,
    threadIdPrefix: 'run_kospi',
  },
  {
    id: 'esg',
    label: '방산 ETF (정책 거부)',
    description: '위원회 다수 찬성이지만 ESG 정책으로 차단',
    branch: 'COMPLIANCE_VETO' as const,
    threadIdPrefix: 'run_esg',
  },
]
