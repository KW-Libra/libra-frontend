/**
 * src/mocks/scenarioFomc.ts
 *
 * §7.2 시나리오 — FOMC 깜짝 25bp 금리 인상.
 * 의사결정 화면 시안용 mock 데이터.
 *
 * v2: 헤더/스테퍼/컨텍스트/옵션 메트릭 등 메타데이터 확장.
 */

export type Direction = 'INCREASE' | 'DECREASE' | 'HOLD'
export type Committee = 'CORE' | 'DOMAIN'
export type AgentRole = 'opinion' | 'informational'
export type Severity = 'PASS' | 'WARNING' | 'BLOCKING'
export type Branch =
  | 'STRONG_REBALANCE'
  | 'WEAK_CONSERVATIVE'
  | 'STRONG_CONFLICT'
  | 'COMPLIANCE_VETO'
export type DeltaFromRound1 =
  | 'STRENGTHENED'
  | 'WEAKENED'
  | 'UNCHANGED'
  | null
export type RiskLabel = '낮음' | '중간' | '높음'

export interface AgentSpeech {
  agent: string
  committee: Committee
  role: AgentRole
  direction: Direction
  magnitude: number
  confidence: number
  summary: string
  reasoning: string
  deltaFromRound1: DeltaFromRound1
}

export interface ComplianceStatus {
  severity: Severity
  title: string
  detail: string
  ruleId?: string
}

export interface DecisionOption {
  id: string
  label: string
  description: string
  trades: string[]
  supportingAgents: string[]
  tone: 'danger' | 'neutral' | 'success'
  riskLabel: RiskLabel
  estimatedVolatility: number
}

export interface ConsensusScore {
  round1: number
  round2: number
  branch: Branch
  thresholds: { strong: number; weak: number }
}

export interface Stage {
  name: string
  label: string
  completed: boolean
  durationMs: number
}

export interface TriggerMeta {
  type: 'push' | 'scheduled' | 'manual'
  label: string
  description: string
}

export interface PortfolioContext {
  portfolioName: string
  affectedAssets: Array<{ ticker: string; name: string }>
  currentValueKrw: number
}

export interface FinalState {
  threadId: string
  trigger: string
  query: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  triggerMeta: TriggerMeta
  context: PortfolioContext
  stages: Stage[]
  compliance: ComplianceStatus
  speeches: AgentSpeech[]
  consensus: ConsensusScore
  options: DecisionOption[]
}

export const scenarioFomc: FinalState = {
  threadId: 'run_fomc_2026_05_13_001',
  trigger: 'push_volatility_breach',
  query: 'FOMC 깜짝 25bp 인상, 일중 -2.4%, 변동성 한도 초과',

  startedAt: '2026-05-13T14:32:08+09:00',
  completedAt: '2026-05-13T14:32:22+09:00',
  durationSeconds: 14.2,

  triggerMeta: {
    type: 'push',
    label: '변동성 임계 돌파',
    description: '포트폴리오 변동성이 IPS 한도를 초과하여 자동 감지',
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
    { name: 'compliance_check', label: 'Compliance', completed: true, durationMs: 120 },
    { name: 'round1', label: 'Round 1', completed: true, durationMs: 4800 },
    { name: 'mediator', label: 'Mediator', completed: true, durationMs: 1300 },
    { name: 'round2', label: 'Round 2', completed: true, durationMs: 3600 },
    { name: 'final_judge', label: 'Final Judge', completed: true, durationMs: 4400 },
  ],

  compliance: {
    severity: 'WARNING',
    title: '변동성 한도 근접',
    detail: '현재 26%, IPS 한도 20% — 6%p 초과 (자동 거부 아님, 권고)',
    ruleId: 'IPS_VOLATILITY_LIMIT',
  },

  speeches: [
    {
      agent: 'Disclosure',
      committee: 'CORE',
      role: 'opinion',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0.5,
      summary: '관련 공시 없음',
      reasoning:
        '오늘 보유 종목 중 신규 공시는 없습니다. 시장 충격은 거시 이벤트(FOMC)에서 비롯되어 종목별 공시 영향은 확인되지 않습니다.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'News',
      committee: 'CORE',
      role: 'opinion',
      direction: 'DECREASE',
      magnitude: -2,
      confidence: 0.65,
      summary: 'FOMC 충격 헤드라인 다수',
      reasoning:
        '주요 매체에서 FOMC 깜짝 인상 관련 부정적 헤드라인이 다수 확인됩니다. 단기 sentiment 악화 가능성. 위험자산 비중 점진 축소를 권합니다.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Report',
      committee: 'CORE',
      role: 'opinion',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0.55,
      summary: '애널리스트 reaction 미반영',
      reasoning:
        '주요 IB의 reaction 리포트가 아직 갱신되지 않았습니다. 컨센서스 변화 확인 후 판단을 권합니다.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Profit',
      committee: 'CORE',
      role: 'opinion',
      direction: 'INCREASE',
      magnitude: 1,
      confidence: 0.6,
      summary: '역발상 매수 (R2 약화)',
      reasoning:
        'RSI 28(과매도), 일시적 패닉 매도 추정. 역사적으로 FOMC 깜짝 인상 후 단기 반등 사례 있음. Round 1에서 +3% 권고했으나, Risk와 Sentiment의 강한 반대를 본 후 +1%로 약화. 단기 반등 신념은 유지.',
      deltaFromRound1: 'WEAKENED',
    },
    {
      agent: 'Cost',
      committee: 'CORE',
      role: 'informational',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0,
      summary: '슬리피지 우려',
      reasoning:
        '현재 일중 거래량이 평소보다 +170%. 분할 매매 없이 즉시 체결 시 슬리피지 0.08% 예상. 거래 비용은 정상 범위지만 분할 매매 권고.',
      deltaFromRound1: null,
    },
    {
      agent: 'Risk',
      committee: 'DOMAIN',
      role: 'opinion',
      direction: 'DECREASE',
      magnitude: -5,
      confidence: 0.9,
      summary: '변동성 한도 초과',
      reasoning:
        '포트폴리오 변동성이 26%로 사용자 IPS 한도(20%)를 6%p 초과. 객관적 risk 지표 위반이며, 위험자산 비중을 즉시 축소해야 합니다. Round 2에서 다른 의견을 봤으나 confidence 상승.',
      deltaFromRound1: 'STRENGTHENED',
    },
    {
      agent: 'Tax',
      committee: 'DOMAIN',
      role: 'informational',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0,
      summary: '세영향 미미',
      reasoning:
        '069500을 5% 매도 시 양도세 약 30만원 발생 (장기 보유분 일부 비과세 적용). 거래 결정에 영향을 주지 않는 수준.',
      deltaFromRound1: null,
    },
    {
      agent: 'Macro',
      committee: 'DOMAIN',
      role: 'opinion',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0.75,
      summary: '펀더멘털 변화 없음',
      reasoning:
        '깜짝 25bp는 정책 surprise지만 경제 펀더멘털 자체 변화는 미미. 패닉 매도는 비추. 1~2주 추이 관찰 권고.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Sentiment',
      committee: 'DOMAIN',
      role: 'opinion',
      direction: 'DECREASE',
      magnitude: -3,
      confidence: 0.8,
      summary: 'VKOSPI 급등',
      reasoning:
        'VKOSPI(변동성지수) 일중 +42%. 시장 패닉 지표 상승, 추가 하락 가능. 위험자산 비중 축소를 권합니다.',
      deltaFromRound1: 'UNCHANGED',
    },
    {
      agent: 'Execution',
      committee: 'DOMAIN',
      role: 'informational',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0,
      summary: '분할 매매 권고',
      reasoning:
        '일중 거래량은 충분하나, 변동성이 높아 단일 체결은 비추. 5분 간격 3분할 매매 권고. VWAP 추적 가능.',
      deltaFromRound1: null,
    },
    {
      agent: 'ESG',
      committee: 'DOMAIN',
      role: 'opinion',
      direction: 'HOLD',
      magnitude: 0,
      confidence: 0.5,
      summary: '해당사항 없음',
      reasoning: '오늘 거래 후보 종목은 사용자 ESG 정책 위반 가능성 없음.',
      deltaFromRound1: 'UNCHANGED',
    },
  ],

  consensus: {
    round1: -0.13,
    round2: -0.21,
    branch: 'STRONG_CONFLICT',
    thresholds: { strong: 0.6, weak: 0.3 },
  },

  options: [
    {
      id: 'reduce_risk',
      label: '위험축소',
      description: '변동성 한도 초과 우려 즉시 해소',
      trades: ['069500 −5%', '단기채 +5%'],
      supportingAgents: ['Risk', 'Sentiment'],
      tone: 'danger',
      riskLabel: '낮음',
      estimatedVolatility: 21,
    },
    {
      id: 'hold_position',
      label: '현상유지',
      description: '펀더멘털 변화 없음, 패닉 매도 회피',
      trades: ['비중 변동 없음'],
      supportingAgents: ['Macro'],
      tone: 'neutral',
      riskLabel: '중간',
      estimatedVolatility: 26,
    },
    {
      id: 'contrarian_buy',
      label: '역발상 매수',
      description: '단기 패닉, 반등 가능성',
      trades: ['069500 +1%', '단기채 −1%'],
      supportingAgents: ['Profit'],
      tone: 'success',
      riskLabel: '높음',
      estimatedVolatility: 28,
    },
  ],
}