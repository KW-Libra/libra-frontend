<script setup lang="ts">
/**
 * src/components/ConsensusMatrix.vue
 *
 * 4-Agent Consensus Matrix — Signal / Profit / Cost (sub-agents) → Master (final).
 * Direct Indexing 자동 리밸런싱 시스템의 합의 매트릭스 표시 컴포넌트.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Mock AgentJudgment 4개 (테스트용)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * const mockSignal: AgentJudgment = {
 *   agent: 'Signal',
 *   mode: 'FULL',
 *   confidence: 0.82,
 *   rationale: '섹터 모멘텀이 임계치를 돌파했고, 변동성 레짐이 전환되었습니다. 전면 리밸런싱이 필요합니다.',
 *   metrics: { momentum_z: 2.31, vol_regime: 'shift', signal_score: 0.78 },
 * }
 *
 * const mockProfit: AgentJudgment = {
 *   agent: 'Profit',
 *   mode: 'LIGHT',
 *   confidence: 0.61,
 *   rationale: '기대수익 개선 폭은 있으나 단기 충격 가능성을 감안해 부분 조정이 합리적입니다.',
 *   metrics: { expected_alpha_bps: 42, drawdown_risk: '중간' },
 * }
 *
 * const mockCost: AgentJudgment = {
 *   agent: 'Cost',
 *   mode: 'NONE',
 *   confidence: 0.74,
 *   rationale: '거래비용과 세금 영향이 기대 알파를 초과합니다. 현 상태 유지를 권고합니다.',
 *   metrics: { tax_drag_bps: 18, tc_bps: 27 },
 * }
 *
 * const mockMaster: AgentJudgment = {
 *   agent: 'Master',
 *   mode: 'LIGHT',
 *   confidence: 0.69,
 *   rationale:
 *     'Signal의 강한 전환 신호와 Cost의 보수적 입장을 절충하여, Profit의 부분 리밸런싱 안을 채택합니다. ' +
 *     '거래비용 한도 내에서 우선순위가 높은 종목만 단계적으로 조정합니다.',
 *   metrics: { target_turnover_pct: 12, expected_net_alpha_bps: 24 },
 * }
 */

type RebalanceMode = 'NONE' | 'LIGHT' | 'FULL'

interface AgentJudgment {
  agent: string
  mode: RebalanceMode
  confidence: number
  rationale: string
  metrics?: Record<string, string | number>
}

const props = defineProps<{
  signal: AgentJudgment
  profit: AgentJudgment
  cost: AgentJudgment
  master: AgentJudgment
}>()

const subAgents = [
  { key: 'signal', label: 'Signal', desc: '시장/신호' },
  { key: 'profit', label: 'Profit', desc: '기대수익' },
  { key: 'cost', label: 'Cost', desc: '거래비용/세금' },
] as const

const subJudgments = () => [
  { ...subAgents[0], judgment: props.signal },
  { ...subAgents[1], judgment: props.profit },
  { ...subAgents[2], judgment: props.cost },
]

const modeLabel: Record<RebalanceMode, string> = {
  NONE: '유지',
  LIGHT: '부분 조정',
  FULL: '전면 조정',
}

function pct(c: number): string {
  const v = Math.max(0, Math.min(1, c))
  return `${Math.round(v * 100)}%`
}

function metricsEntries(m?: Record<string, string | number>) {
  return m ? Object.entries(m) : []
}
</script>

<template>
  <section class="consensus-matrix" aria-label="4-Agent Consensus Matrix">
    <header class="cm-header">
      <h2 class="cm-title">4-Agent Consensus Matrix</h2>
      <p class="cm-subtitle">각 에이전트의 독립 판단과 Master의 최종 합의</p>
    </header>

    <div class="cm-table-wrap">
      <div class="cm-table" role="table" aria-label="Sub-agent 판단 매트릭스">
        <div class="cm-row cm-row-head" role="row">
          <div class="cm-cell cm-col-agent" role="columnheader">Agent</div>
          <div class="cm-cell cm-col-mode" role="columnheader">Mode</div>
          <div class="cm-cell cm-col-conf" role="columnheader">Confidence</div>
          <div class="cm-cell cm-col-rationale" role="columnheader">Rationale</div>
        </div>

        <div
          v-for="item in subJudgments()"
          :key="item.key"
          class="cm-row"
          role="row"
        >
          <div class="cm-cell cm-col-agent" role="cell">
            <div class="agent-name">{{ item.label }}</div>
            <div class="agent-desc">{{ item.desc }}</div>
          </div>
          <div class="cm-cell cm-col-mode" role="cell">
            <span class="mode-badge" :class="`mode-${item.judgment.mode.toLowerCase()}`">
              {{ modeLabel[item.judgment.mode] }}
              <small>{{ item.judgment.mode }}</small>
            </span>
          </div>
          <div class="cm-cell cm-col-conf" role="cell">
            <div class="conf-wrap">
              <div class="conf-bar" :aria-label="`confidence ${pct(item.judgment.confidence)}`">
                <div
                  class="conf-fill"
                  :class="`mode-fill-${item.judgment.mode.toLowerCase()}`"
                  :style="{ width: pct(item.judgment.confidence) }"
                />
              </div>
              <div class="conf-pct">{{ pct(item.judgment.confidence) }}</div>
            </div>
          </div>
          <div class="cm-cell cm-col-rationale" role="cell">
            {{ item.judgment.rationale }}
          </div>
        </div>
      </div>
    </div>

    <div class="cm-flow" aria-hidden="true">
      <svg
        class="cm-flow-svg"
        viewBox="0 0 600 60"
        preserveAspectRatio="none"
      >
        <line x1="100" y1="0" x2="300" y2="55" class="flow-line" />
        <line x1="300" y1="0" x2="300" y2="55" class="flow-line" />
        <line x1="500" y1="0" x2="300" y2="55" class="flow-line" />
      </svg>
      <div class="cm-flow-label">consensus</div>
    </div>

    <div class="cm-master" :class="`master-${props.master.mode.toLowerCase()}`">
      <div class="cm-master-label">FINAL DECISION · Master</div>
      <div class="cm-master-head">
        <span class="mode-badge mode-badge-lg" :class="`mode-${props.master.mode.toLowerCase()}`">
          {{ modeLabel[props.master.mode] }}
          <small>{{ props.master.mode }}</small>
        </span>
        <div class="cm-master-conf">
          <div class="conf-bar conf-bar-lg">
            <div
              class="conf-fill"
              :class="`mode-fill-${props.master.mode.toLowerCase()}`"
              :style="{ width: pct(props.master.confidence) }"
            />
          </div>
          <div class="conf-pct conf-pct-lg">신뢰도 {{ pct(props.master.confidence) }}</div>
        </div>
      </div>

      <p class="cm-master-rationale">{{ props.master.rationale }}</p>

      <dl
        v-if="metricsEntries(props.master.metrics).length"
        class="cm-master-metrics"
      >
        <template v-for="[k, v] in metricsEntries(props.master.metrics)" :key="k">
          <dt>{{ k }}</dt>
          <dd>{{ v }}</dd>
        </template>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.consensus-matrix {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: inherit;
  color: #0f172a;
}

.cm-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cm-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}
.cm-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

/* Table */
.cm-table-wrap {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}
.cm-table {
  display: table;
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}
.cm-row {
  display: table-row;
}
.cm-cell {
  display: table-cell;
  padding: 14px 16px;
  vertical-align: top;
  border-top: 1px solid #f1f5f9;
  font-size: 14px;
  line-height: 1.5;
}
.cm-row-head .cm-cell {
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-top: none;
}
.cm-col-agent { width: 140px; }
.cm-col-mode { width: 140px; }
.cm-col-conf { width: 200px; }
.cm-col-rationale { width: auto; }

.agent-name {
  font-weight: 600;
  font-size: 15px;
}
.agent-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

/* Mode badges */
.mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
  line-height: 1.2;
}
.mode-badge small {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.7;
  letter-spacing: 0.04em;
}
.mode-none {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}
.mode-light {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}
.mode-full {
  background: #fee2e2;
  color: #991b1b;
  border-color: #ef4444;
}
.mode-badge-lg {
  padding: 8px 14px;
  font-size: 15px;
}
.mode-badge-lg small {
  font-size: 11px;
}

/* Confidence bar */
.conf-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.conf-bar {
  width: 100%;
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.conf-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 200ms ease;
}
.mode-fill-none { background: #94a3b8; }
.mode-fill-light { background: #f59e0b; }
.mode-fill-full { background: #ef4444; }
.conf-pct {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  font-variant-numeric: tabular-nums;
}
.conf-bar-lg { height: 12px; }
.conf-pct-lg { font-size: 13px; }

/* Flow */
.cm-flow {
  position: relative;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cm-flow-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.flow-line {
  stroke: #cbd5e1;
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  fill: none;
}
.cm-flow-label {
  position: relative;
  background: #ffffff;
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Master card */
.cm-master {
  border: 2px solid #0f172a;
  border-radius: 16px;
  padding: 20px 22px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 4px 20px -8px rgba(15, 23, 42, 0.18);
}
.master-none { border-color: #94a3b8; }
.master-light { border-color: #f59e0b; }
.master-full { border-color: #ef4444; }

.cm-master-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #64748b;
}
.cm-master-head {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.cm-master-conf {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cm-master-rationale {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #0f172a;
}
.cm-master-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px 16px;
  margin: 0;
  padding: 14px 16px;
  background: #f8fafc;
  border-radius: 10px;
}
.cm-master-metrics dt {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cm-master-metrics dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .cm-title { font-size: 18px; }
  .cm-master { padding: 16px; }
  .cm-master-rationale { font-size: 14px; }
}
</style>

<!--
  ────────────────────────────────────────────────────────────────────────
  사용 예시 (RunResultPage.vue 내부)
  ────────────────────────────────────────────────────────────────────────

  <script setup lang="ts">
  import ConsensusMatrix from '@/components/ConsensusMatrix.vue'

  const signal = {
    agent: 'Signal',
    mode: 'FULL' as const,
    confidence: 0.82,
    rationale: '섹터 모멘텀이 임계치를 돌파했고, 변동성 레짐이 전환되었습니다.',
    metrics: { momentum_z: 2.31 },
  }
  const profit = {
    agent: 'Profit',
    mode: 'LIGHT' as const,
    confidence: 0.61,
    rationale: '기대수익 개선 폭은 있으나 단기 충격을 감안해 부분 조정이 합리적입니다.',
  }
  const cost = {
    agent: 'Cost',
    mode: 'NONE' as const,
    confidence: 0.74,
    rationale: '거래비용과 세금 영향이 기대 알파를 초과합니다.',
  }
  const master = {
    agent: 'Master',
    mode: 'LIGHT' as const,
    confidence: 0.69,
    rationale: 'Signal의 강한 신호와 Cost의 보수적 입장을 절충, Profit의 부분 리밸런싱 안을 채택합니다.',
    metrics: { target_turnover_pct: 12, expected_net_alpha_bps: 24 },
  }
  </script>

  <template>
    <ConsensusMatrix :signal="signal" :profit="profit" :cost="cost" :master="master" />
  </template>
-->
