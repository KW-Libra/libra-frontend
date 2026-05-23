/**
 * src/types/ips.ts
 *
 * IPS (Investment Policy Statement) 도메인 타입.
 *
 * IPS는 Team Libra의 핵심 가치인 "철학 보존(philosophy preservation)"의
 * 구체적 표현이다. 사용자가 시스템에 위임하는 투자 철학의 정형화된 명세이며,
 * 한 번 확정된 IPS는 immutable(frozen)로 취급되어야 한다.
 *
 * - `IPSDraft`: 폼 작성 중 사용하는 가변(mutable) 타입.
 * - `IPS`: 확정 후 사용하는 readonly(immutable) 타입. 이 타입의 값은
 *   재할당 없이 새 객체 생성으로만 갱신한다. Object.freeze로 런타임 봉인 가능.
 *
 * libra-direct(Python)의 PortfolioDefinition과 매핑 관계가 있으며,
 * 파일 하단 가이드 참조.
 */

// ──────────── 1. 투자 목표 ────────────
export interface InvestmentGoal {
  targetReturnPct: number          // 목표 수익률 (%)
  investmentHorizonYears: number   // 투자 기간 (년)
}

// ──────────── 2. 위험 허용도 ────────────
export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'

export interface RiskTolerance {
  profile: RiskProfile
  maxDrawdownPct: number           // 최대 손실 허용 (MDD threshold, %)
}

// ──────────── 3. 자산 배분 ────────────
export interface AssetAllocation {
  equityPct: number                // 주식 비중 (%)
  bondPct: number                  // 채권 비중 (%)
  cashPct: number                  // 현금 비중 (%)
}

// ──────────── 4. 리밸런싱 정책 ────────────
export type RebalanceMode = 'NONE' | 'LIGHT' | 'FULL'

export interface RebalancePolicy {
  driftThresholdPct: number              // 드리프트 임계치(%) — Daryanani 2008 권장 25
  minIntervalDays: number                // 최소 리밸런싱 간격 (일)
  allowedModes: ReadonlyArray<RebalanceMode> // 허용 모드 — 다중 선택
}

// ──────────── 5. 비용 제약 ────────────
export interface CostConstraint {
  perTradeBpsLimit: number         // 회당 거래비용 한도 (bp)
  annualBpsLimit: number           // 연간 누적 한도 (bp)
}

// ──────────── 6. 제약 사항 ────────────
export interface PositionLimit {
  ticker: string
  minPct: number                   // 종목 비중 최소 (%)
  maxPct: number                   // 종목 비중 최대 (%) — minPct < maxPct
}

export interface Constraints {
  forbiddenTickers: ReadonlyArray<string>
  positionLimits: ReadonlyArray<PositionLimit>
}

// ──────────── IPS 루트 타입 ────────────

/**
 * 폼 작성 중 사용하는 mutable draft. 검증 통과 후 commit()으로 IPS로 봉인.
 */
export interface IPSDraft {
  goal: InvestmentGoal
  risk: RiskTolerance
  allocation: AssetAllocation
  rebalance: {
    driftThresholdPct: number
    minIntervalDays: number
    allowedModes: RebalanceMode[]  // mutable array
  }
  cost: CostConstraint
  constraints: {
    forbiddenTickers: string[]
    positionLimits: PositionLimit[]
  }
}

/**
 * 확정된 IPS — 모든 필드 readonly. 변경 시 새 객체 생성.
 * 런타임에 Object.freeze로 봉인되며, 직렬화 시 version + committedAt 메타가 부여된다.
 */
export interface IPS {
  readonly version: 'v1'
  readonly committedAt: string                    // ISO timestamp
  readonly goal: Readonly<InvestmentGoal>
  readonly risk: Readonly<RiskTolerance>
  readonly allocation: Readonly<AssetAllocation>
  readonly rebalance: Readonly<RebalancePolicy>
  readonly cost: Readonly<CostConstraint>
  readonly constraints: Readonly<Constraints>
}

// ──────────── 검증 ────────────

export interface IPSValidationError {
  field: string
  message: string
}

export interface IPSValidationResult {
  valid: boolean
  errors: IPSValidationError[]
}

// ──────────── 헬퍼 ────────────

export function emptyDraft(): IPSDraft {
  return {
    goal: { targetReturnPct: 7, investmentHorizonYears: 10 },
    risk: { profile: 'MODERATE', maxDrawdownPct: 20 },
    allocation: { equityPct: 60, bondPct: 30, cashPct: 10 },
    rebalance: {
      driftThresholdPct: 25,            // Daryanani 2008
      minIntervalDays: 30,
      allowedModes: ['LIGHT', 'FULL'],
    },
    cost: { perTradeBpsLimit: 50, annualBpsLimit: 200 },
    constraints: {
      forbiddenTickers: [],
      positionLimits: [],
    },
  }
}

/**
 * 폼 검증 — 자산 배분 합 = 100, 모든 % 음수 불가, position min < max.
 */
export function validateDraft(d: IPSDraft): IPSValidationResult {
  const errors: IPSValidationError[] = []

  // 1. 투자 목표
  if (Number.isNaN(d.goal.targetReturnPct) || d.goal.targetReturnPct < 0) {
    errors.push({
      field: 'goal.targetReturnPct',
      message: '목표 수익률은 0% 이상의 숫자여야 합니다. 다시 입력해주세요.',
    })
  }
  if (Number.isNaN(d.goal.investmentHorizonYears) || d.goal.investmentHorizonYears <= 0) {
    errors.push({
      field: 'goal.investmentHorizonYears',
      message: '투자 기간은 1년 이상이어야 합니다. 다시 입력해주세요.',
    })
  }

  // 2. 위험 허용도
  if (
    Number.isNaN(d.risk.maxDrawdownPct) ||
    d.risk.maxDrawdownPct < 0 ||
    d.risk.maxDrawdownPct > 100
  ) {
    errors.push({
      field: 'risk.maxDrawdownPct',
      message: 'MDD 한도는 0~100% 사이로 입력해주세요.',
    })
  }

  // 3. 자산 배분
  const { equityPct, bondPct, cashPct } = d.allocation
  if (equityPct < 0 || bondPct < 0 || cashPct < 0) {
    errors.push({
      field: 'allocation',
      message: '자산 배분 비중은 음수일 수 없습니다. 다시 입력해주세요.',
    })
  }
  const sum = equityPct + bondPct + cashPct
  if (Math.abs(sum - 100) > 0.001) {
    errors.push({
      field: 'allocation.sum',
      message: `자산 배분 합이 100%여야 합니다. 현재 ${sum.toFixed(1)}% — 다시 분배해주세요.`,
    })
  }

  // 4. 리밸런싱 정책
  if (Number.isNaN(d.rebalance.driftThresholdPct) || d.rebalance.driftThresholdPct < 0) {
    errors.push({
      field: 'rebalance.driftThresholdPct',
      message: '드리프트 임계치는 0 이상의 숫자여야 합니다. 다시 입력해주세요.',
    })
  }
  if (Number.isNaN(d.rebalance.minIntervalDays) || d.rebalance.minIntervalDays < 0) {
    errors.push({
      field: 'rebalance.minIntervalDays',
      message: '최소 간격은 0일 이상이어야 합니다. 다시 입력해주세요.',
    })
  }
  if (d.rebalance.allowedModes.length === 0) {
    errors.push({
      field: 'rebalance.allowedModes',
      message: '허용 모드를 최소 1개 선택해주세요.',
    })
  }

  // 5. 비용 제약
  if (Number.isNaN(d.cost.perTradeBpsLimit) || d.cost.perTradeBpsLimit < 0) {
    errors.push({
      field: 'cost.perTradeBpsLimit',
      message: '회당 거래비용 한도는 0 이상의 숫자여야 합니다. 다시 입력해주세요.',
    })
  }
  if (Number.isNaN(d.cost.annualBpsLimit) || d.cost.annualBpsLimit < 0) {
    errors.push({
      field: 'cost.annualBpsLimit',
      message: '연간 누적 한도는 0 이상의 숫자여야 합니다. 다시 입력해주세요.',
    })
  }
  if (d.cost.perTradeBpsLimit > d.cost.annualBpsLimit) {
    errors.push({
      field: 'cost.annualBpsLimit',
      message: '연간 한도는 회당 한도보다 커야 합니다. 다시 입력해주세요.',
    })
  }

  // 6. 제약 사항
  d.constraints.positionLimits.forEach((p, i) => {
    if (!p.ticker.trim()) {
      errors.push({
        field: `constraints.positionLimits[${i}].ticker`,
        message: `${i + 1}번 종목 코드가 비어 있습니다. 코드를 입력해주세요.`,
      })
    }
    if (p.minPct < 0 || p.maxPct < 0) {
      errors.push({
        field: `constraints.positionLimits[${i}]`,
        message: `${p.ticker || `${i + 1}번 종목`}: 비중은 음수일 수 없습니다.`,
      })
    }
    if (p.minPct >= p.maxPct) {
      errors.push({
        field: `constraints.positionLimits[${i}].range`,
        message: `${p.ticker || `${i + 1}번 종목`}: min(${p.minPct}%) < max(${p.maxPct}%) 이어야 합니다.`,
      })
    }
  })

  return { valid: errors.length === 0, errors }
}

/**
 * Draft → IPS 봉인. 검증 통과 후에만 호출.
 * 모든 중첩 객체를 Object.freeze로 봉인하여 런타임 immutable 보장.
 */
export function commitDraft(d: IPSDraft): IPS {
  const ips: IPS = {
    version: 'v1',
    committedAt: new Date().toISOString(),
    goal: Object.freeze({ ...d.goal }),
    risk: Object.freeze({ ...d.risk }),
    allocation: Object.freeze({ ...d.allocation }),
    rebalance: Object.freeze({
      driftThresholdPct: d.rebalance.driftThresholdPct,
      minIntervalDays: d.rebalance.minIntervalDays,
      allowedModes: Object.freeze([...d.rebalance.allowedModes]) as ReadonlyArray<RebalanceMode>,
    }),
    cost: Object.freeze({ ...d.cost }),
    constraints: Object.freeze({
      forbiddenTickers: Object.freeze([...d.constraints.forbiddenTickers]) as ReadonlyArray<string>,
      positionLimits: Object.freeze(
        d.constraints.positionLimits.map((p) => Object.freeze({ ...p })),
      ) as ReadonlyArray<PositionLimit>,
    }),
  }
  return Object.freeze(ips)
}

/**
 * 작성 완료된 섹션 개수 (1~6) — 진행도 표시용.
 * "완료"의 정의: 해당 섹션이 검증을 통과하고 의미 있는 값이 들어 있음.
 */
export function countCompletedSections(d: IPSDraft): number {
  let n = 0
  if (d.goal.targetReturnPct >= 0 && d.goal.investmentHorizonYears > 0) n++
  if (d.risk.profile && d.risk.maxDrawdownPct >= 0 && d.risk.maxDrawdownPct <= 100) n++
  const sum = d.allocation.equityPct + d.allocation.bondPct + d.allocation.cashPct
  if (Math.abs(sum - 100) <= 0.001 && d.allocation.equityPct >= 0 && d.allocation.bondPct >= 0 && d.allocation.cashPct >= 0) n++
  if (d.rebalance.driftThresholdPct >= 0 && d.rebalance.minIntervalDays >= 0 && d.rebalance.allowedModes.length > 0) n++
  if (d.cost.perTradeBpsLimit >= 0 && d.cost.annualBpsLimit >= d.cost.perTradeBpsLimit) n++
  // 제약 사항은 비어있어도 유효 — 작성 의지가 있는지로 판단
  const limitsValid = d.constraints.positionLimits.every((p) => p.ticker.trim() && p.minPct < p.maxPct && p.minPct >= 0)
  if (limitsValid) n++
  return n
}

// ──────────── PortfolioDefinition (libra-direct) 매핑 가이드 ────────────
/**
 * libra-direct의 Python `PortfolioDefinition` 데이터클래스와의 매핑:
 *
 *   IPS (frontend)                    PortfolioDefinition (libra-direct)
 *   ─────────────────────────────     ──────────────────────────────────────
 *   goal.targetReturnPct        →     target_return_pct: float
 *   goal.investmentHorizonYears →     horizon_years: int
 *   risk.profile                →     risk_profile: Literal[...]
 *   risk.maxDrawdownPct         →     mdd_threshold_pct: float
 *   allocation.equityPct        →     allocation.equity_pct: float
 *   allocation.bondPct          →     allocation.bond_pct: float
 *   allocation.cashPct          →     allocation.cash_pct: float
 *   rebalance.driftThresholdPct →     rebalance.drift_threshold_pct: float
 *   rebalance.minIntervalDays   →     rebalance.min_interval_days: int
 *   rebalance.allowedModes      →     rebalance.allowed_modes: frozenset[Mode]
 *   cost.perTradeBpsLimit       →     cost.per_trade_bps_limit: int
 *   cost.annualBpsLimit         →     cost.annual_bps_limit: int
 *   constraints.forbiddenTickers→     constraints.forbidden_tickers: frozenset[str]
 *   constraints.positionLimits  →     constraints.position_limits: tuple[PositionLimit, ...]
 *   version / committedAt        →     metadata.version / metadata.committed_at
 *
 * Notes:
 * - Python 측에서는 `@dataclass(frozen=True, slots=True)` 또는 Pydantic v2
 *   `model_config = ConfigDict(frozen=True)` 로 immutability 강제.
 * - 컬렉션은 `frozenset` / `tuple`로 변환하여 hash 가능하게 유지.
 * - JSON 직렬화 시 camelCase ↔ snake_case 변환 레이어 필요 (e.g. pydantic alias).
 * - `version` 필드는 마이그레이션 시 사용. v2 도입 시 백엔드가 v1 → v2 변환 책임.
 */
