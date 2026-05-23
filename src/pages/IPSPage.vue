<script setup lang="ts">
/**
 * src/pages/IPSPage.vue
 *
 * IPS (Investment Policy Statement) 설정 페이지.
 *
 * - 좌측: 섹션별 PolicyCard 6개로 구성된 폼
 * - 우측: 실시간 요약 카드 (sticky)
 * - 상단: 진행도 (n/6)
 * - 하단: 임시 저장 / 확정 버튼
 *
 * 디자인 톤: DashboardPage 기준 (gray-50 배경, 흰 카드, gray-200 보더).
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useIPSStore } from '@/stores/ipsStore'
import PolicyCard from '@/components/PolicyCard.vue'
import { emptyDraft, type RebalanceMode, type RiskProfile } from '@/types/ips'

// 기본값과 비교해 "사용자가 수정했는지" 판정. 미수정 섹션은 idle("—")로 표시.
const DEFAULT_DRAFT = emptyDraft()

const router = useRouter()
const ipsStore = useIPSStore()

const flashSaved = ref(false)
const flashCommitted = ref(false)
const lastCommitError = ref<string | null>(null)

// "—" 클릭으로 기본값을 명시 승인한 섹션 집합. ✓로 표시되며 진행도에 카운트.
type SectionKey = 'goal' | 'risk' | 'allocation' | 'rebalance' | 'cost' | 'constraints'
const acknowledged = ref<Set<SectionKey>>(new Set())
function isAck(key: SectionKey): boolean {
  return acknowledged.value.has(key)
}
function toggleAck(key: SectionKey) {
  const next = new Set(acknowledged.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  acknowledged.value = next
}
/** 토글 아님 — 항상 추가(idempotent). 칩 클릭처럼 명시적 선택 행위에 사용. */
function markAck(key: SectionKey) {
  if (acknowledged.value.has(key)) return
  const next = new Set(acknowledged.value)
  next.add(key)
  acknowledged.value = next
}

function selectRiskProfile(p: RiskProfile) {
  ipsStore.draft.risk.profile = p
  markAck('risk')
}

onMounted(() => {
  ipsStore.hydrate()
})

// ──────────── 진행도 ────────────
// "수정된 + 검증 통과" 섹션 수. 기본값 그대로인 섹션은 카운트 X.
const totalSections = 6
const modifiedAndValid = computed(() => {
  const rows: { key: SectionKey; mod: boolean; done: boolean }[] = [
    { key: 'goal', mod: goalModified.value, done: goalDone.value },
    { key: 'risk', mod: riskModified.value, done: riskDone.value },
    { key: 'allocation', mod: allocationModified.value, done: allocationDone.value },
    { key: 'rebalance', mod: rebalanceModified.value, done: rebalanceDone.value },
    { key: 'cost', mod: costModified.value, done: costDone.value },
    { key: 'constraints', mod: constraintsModified.value, done: constraintsDone.value },
  ]
  let n = 0
  for (const r of rows) {
    if (err(r.key)) continue
    // ack 했거나, 수정 후 유효한 경우 카운트
    if (isAck(r.key) || (r.mod && r.done)) n++
  }
  return n
})
const progressPct = computed(() => (modifiedAndValid.value / totalSections) * 100)

// ──────────── 섹션별 에러 ────────────
function err(prefix: string): string | undefined {
  for (const [field, msg] of Object.entries(ipsStore.errorMap)) {
    if (field.startsWith(prefix)) return msg
  }
  return undefined
}
function sectionStatus(
  prefix: SectionKey,
  completed: boolean,
  modified: boolean,
): 'done' | 'error' | 'idle' {
  // 우선순위: 검증 에러 > 수정/확인 완료 > 기본값
  if (err(prefix)) return 'error'
  if (isAck(prefix)) return 'done'             // 사용자가 — 클릭으로 명시 확인 (기본값이라도 ✓)
  if (modified && completed) return 'done'     // 값을 수정했고 유효 → ✓
  return 'idle'
}

const goalDone = computed(() =>
  ipsStore.draft.goal.targetReturnPct >= 0 && ipsStore.draft.goal.investmentHorizonYears > 0,
)
const goalModified = computed(
  () =>
    ipsStore.draft.goal.targetReturnPct !== DEFAULT_DRAFT.goal.targetReturnPct ||
    ipsStore.draft.goal.investmentHorizonYears !== DEFAULT_DRAFT.goal.investmentHorizonYears,
)

const riskDone = computed(() =>
  ipsStore.draft.risk.maxDrawdownPct >= 0 && ipsStore.draft.risk.maxDrawdownPct <= 100,
)
const riskModified = computed(
  () =>
    ipsStore.draft.risk.profile !== DEFAULT_DRAFT.risk.profile ||
    ipsStore.draft.risk.maxDrawdownPct !== DEFAULT_DRAFT.risk.maxDrawdownPct,
)

const allocationSum = computed(
  () =>
    ipsStore.draft.allocation.equityPct +
    ipsStore.draft.allocation.bondPct +
    ipsStore.draft.allocation.cashPct,
)
const allocationDone = computed(() => Math.abs(allocationSum.value - 100) < 0.001)
const allocationModified = computed(
  () =>
    ipsStore.draft.allocation.equityPct !== DEFAULT_DRAFT.allocation.equityPct ||
    ipsStore.draft.allocation.bondPct !== DEFAULT_DRAFT.allocation.bondPct ||
    ipsStore.draft.allocation.cashPct !== DEFAULT_DRAFT.allocation.cashPct,
)

const rebalanceDone = computed(() => ipsStore.draft.rebalance.allowedModes.length > 0)
const rebalanceModified = computed(() => {
  const d = ipsStore.draft.rebalance
  const def = DEFAULT_DRAFT.rebalance
  if (d.driftThresholdPct !== def.driftThresholdPct) return true
  if (d.minIntervalDays !== def.minIntervalDays) return true
  if (d.allowedModes.length !== def.allowedModes.length) return true
  return d.allowedModes.some((m, i) => m !== def.allowedModes[i])
})

const costDone = computed(
  () =>
    ipsStore.draft.cost.perTradeBpsLimit >= 0 &&
    ipsStore.draft.cost.annualBpsLimit >= ipsStore.draft.cost.perTradeBpsLimit,
)
const costModified = computed(
  () =>
    ipsStore.draft.cost.perTradeBpsLimit !== DEFAULT_DRAFT.cost.perTradeBpsLimit ||
    ipsStore.draft.cost.annualBpsLimit !== DEFAULT_DRAFT.cost.annualBpsLimit,
)

const constraintsDone = computed(() =>
  ipsStore.draft.constraints.positionLimits.every(
    (p) => p.ticker.trim() && p.minPct < p.maxPct && p.minPct >= 0,
  ),
)
const constraintsModified = computed(
  () =>
    ipsStore.draft.constraints.forbiddenTickers.length > 0 ||
    ipsStore.draft.constraints.positionLimits.length > 0,
)

// ──────────── 폼 핸들러 ────────────
const riskProfiles: { value: RiskProfile; label: string; desc: string }[] = [
  { value: 'CONSERVATIVE', label: '보수적', desc: '자본 보존 우선 · 낮은 변동성' },
  { value: 'MODERATE', label: '중립', desc: '수익과 위험의 균형' },
  { value: 'AGGRESSIVE', label: '공격적', desc: '성장 우선 · 높은 변동성 감내' },
]
const rebalanceModeOptions: { value: RebalanceMode; label: string; desc: string }[] = [
  { value: 'NONE', label: 'NONE', desc: '유지' },
  { value: 'LIGHT', label: 'LIGHT', desc: '부분 조정' },
  { value: 'FULL', label: 'FULL', desc: '전면 조정' },
]

function toggleMode(mode: RebalanceMode) {
  const cur = ipsStore.draft.rebalance.allowedModes
  ipsStore.draft.rebalance.allowedModes = cur.includes(mode)
    ? cur.filter((m) => m !== mode)
    : [...cur, mode]
  markAck('rebalance')   // 칩 클릭 자체가 명시적 선택 → ack
}

function addForbiddenTicker(ticker: string) {
  const t = ticker.trim().toUpperCase()
  if (!t) return
  const cur = ipsStore.draft.constraints.forbiddenTickers
  if (cur.includes(t)) return
  ipsStore.draft.constraints.forbiddenTickers = [...cur, t]
}
const forbiddenInput = ref('')
function onForbiddenSubmit() {
  if (!forbiddenInput.value.trim()) return
  addForbiddenTicker(forbiddenInput.value)
  forbiddenInput.value = ''
}
function removeForbidden(i: number) {
  const cur = ipsStore.draft.constraints.forbiddenTickers
  ipsStore.draft.constraints.forbiddenTickers = cur.filter((_, idx) => idx !== i)
}

function addPositionLimit() {
  ipsStore.draft.constraints.positionLimits = [
    ...ipsStore.draft.constraints.positionLimits,
    { ticker: '', minPct: 0, maxPct: 20 },
  ]
}
function removePositionLimit(i: number) {
  const cur = ipsStore.draft.constraints.positionLimits
  ipsStore.draft.constraints.positionLimits = cur.filter((_, idx) => idx !== i)
}

// ──────────── 액션 ────────────
function onSaveDraft() {
  ipsStore.saveDraft()
  flashSaved.value = true
  // 짧게 토스트 노출 후 대시보드로 이동
  setTimeout(() => {
    flashSaved.value = false
    router.push('/dashboard')
  }, 700)
}

function onCommit() {
  lastCommitError.value = null
  const result = ipsStore.commit()
  if (result.ok) {
    flashCommitted.value = true
    setTimeout(() => {
      flashCommitted.value = false
      router.push('/dashboard')
    }, 900)
  } else {
    lastCommitError.value = result.errors[0] ?? '검증 실패'
  }
}

function onReset() {
  if (confirm('IPS 작성 내용을 모두 지우시겠습니까?')) {
    ipsStore.reset()
  }
}

function goDashboard() {
  router.push('/dashboard')
}

// ──────────── 표시용 헬퍼 ────────────
function fmtPct(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`
}
function fmtModes(modes: ReadonlyArray<RebalanceMode>): string {
  return modes.length ? modes.join(' · ') : '—'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- 헤더 -->
    <header class="border-b border-gray-200 bg-white">
      <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded bg-gray-900 text-white flex items-center justify-center text-sm font-bold">L</div>
          <span class="text-lg font-semibold tracking-tight">Libra</span>
        </div>
        <button
          @click="goDashboard"
          class="text-xs text-gray-600 hover:text-gray-900 transition"
        >대시보드</button>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-8 py-10">
      <!-- 타이틀 + 진행도 -->
      <div class="mb-8">
        <div class="flex items-end justify-between flex-wrap gap-4 mb-3">
          <div>
            <h1 class="text-2xl font-medium tracking-tight mb-1">IPS · 투자정책서</h1>
            <p class="text-sm text-gray-600 leading-relaxed">
              위임할 투자 철학을 정형화합니다. 한 번 확정된 IPS는 시스템이 모든 의사결정의 기준선으로 사용합니다.
            </p>
          </div>
          <div class="text-right">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-1">작성 진행도</div>
            <div class="text-xl font-semibold font-mono text-gray-900">
              {{ modifiedAndValid }}<span class="text-base text-gray-400">/{{ totalSections }}</span>
            </div>
          </div>
        </div>
        <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-gray-900 transition-all"
            :style="{ width: `${progressPct}%` }"
          ></div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-6">
        <!-- 좌측: 폼 -->
        <div class="col-span-2 space-y-4">
          <!-- 1. 투자 목표 -->
          <PolicyCard
            :index="1"
            title="투자 목표"
            subtitle="목표 수익률과 투자 기간을 설정합니다"
            :status="sectionStatus('goal', goalDone, goalModified)"
            :error-message="err('goal')"
            @toggle="toggleAck('goal')"
          >
            <div class="grid grid-cols-2 gap-4">
              <label class="field">
                <span class="field-label">목표 수익률 (%)</span>
                <input
                  v-model.number="ipsStore.draft.goal.targetReturnPct"
                  type="number"
                  step="0.1"
                  min="0"
                  class="field-input"
                  :class="{ 'field-input-error': err('goal.targetReturnPct') }"
                />
              </label>
              <label class="field">
                <span class="field-label">투자 기간 (년)</span>
                <input
                  v-model.number="ipsStore.draft.goal.investmentHorizonYears"
                  type="number"
                  step="1"
                  min="1"
                  class="field-input"
                  :class="{ 'field-input-error': err('goal.investmentHorizonYears') }"
                />
              </label>
            </div>
          </PolicyCard>

          <!-- 2. 위험 허용도 -->
          <PolicyCard
            :index="2"
            title="위험 허용도"
            subtitle="프로파일과 최대 손실 허용도를 정합니다"
            :status="sectionStatus('risk', riskDone, riskModified)"
            :error-message="err('risk')"
            @toggle="toggleAck('risk')"
          >
            <div>
              <div class="field-label mb-2">프로파일</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="p in riskProfiles"
                  :key="p.value"
                  type="button"
                  @click="selectRiskProfile(p.value)"
                  class="profile-chip"
                  :class="{ 'profile-chip-active': ipsStore.draft.risk.profile === p.value }"
                >
                  <div class="profile-chip-label">{{ p.label }}</div>
                  <div class="profile-chip-desc">{{ p.desc }}</div>
                </button>
              </div>
            </div>
            <label class="field">
              <span class="field-label">최대 손실 허용 — MDD (%)</span>
              <input
                v-model.number="ipsStore.draft.risk.maxDrawdownPct"
                type="number"
                step="1"
                min="0"
                max="100"
                class="field-input"
                :class="{ 'field-input-error': err('risk.maxDrawdownPct') }"
              />
            </label>
          </PolicyCard>

          <!-- 3. 자산 배분 -->
          <PolicyCard
            :index="3"
            title="자산 배분"
            subtitle="주식 / 채권 / 현금 비중 (합 100%)"
            :status="sectionStatus('allocation', allocationDone, allocationModified)"
            :error-message="err('allocation')"
            @toggle="toggleAck('allocation')"
          >
            <div class="grid grid-cols-3 gap-3">
              <label class="field">
                <span class="field-label">주식 (%)</span>
                <input
                  v-model.number="ipsStore.draft.allocation.equityPct"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  class="field-input"
                  :class="{ 'field-input-error': !allocationDone }"
                />
              </label>
              <label class="field">
                <span class="field-label">채권 (%)</span>
                <input
                  v-model.number="ipsStore.draft.allocation.bondPct"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  class="field-input"
                  :class="{ 'field-input-error': !allocationDone }"
                />
              </label>
              <label class="field">
                <span class="field-label">현금 (%)</span>
                <input
                  v-model.number="ipsStore.draft.allocation.cashPct"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  class="field-input"
                  :class="{ 'field-input-error': !allocationDone }"
                />
              </label>
            </div>
            <div class="alloc-bar">
              <div class="alloc-bar-seg alloc-equity" :style="{ width: `${ipsStore.draft.allocation.equityPct}%` }"></div>
              <div class="alloc-bar-seg alloc-bond" :style="{ width: `${ipsStore.draft.allocation.bondPct}%` }"></div>
              <div class="alloc-bar-seg alloc-cash" :style="{ width: `${ipsStore.draft.allocation.cashPct}%` }"></div>
            </div>
            <div class="text-xs text-gray-500">
              합계 <span class="font-mono font-medium" :class="allocationDone ? 'text-gray-900' : 'text-red-600'">{{ allocationSum.toFixed(1) }}%</span>
            </div>
          </PolicyCard>

          <!-- 4. 리밸런싱 정책 -->
          <PolicyCard
            :index="4"
            title="리밸런싱 정책"
            subtitle="드리프트 임계치 · 최소 간격 · 허용 모드"
            :status="sectionStatus('rebalance', rebalanceDone, rebalanceModified)"
            :error-message="err('rebalance')"
            @toggle="toggleAck('rebalance')"
          >
            <div class="grid grid-cols-2 gap-4">
              <label class="field">
                <span class="field-label">드리프트 임계치 (%)</span>
                <input
                  v-model.number="ipsStore.draft.rebalance.driftThresholdPct"
                  type="number"
                  step="1"
                  min="0"
                  class="field-input"
                  :class="{ 'field-input-error': err('rebalance.driftThresholdPct') }"
                />
                <span class="field-hint">기본 25% (Daryanani 2008)</span>
              </label>
              <label class="field">
                <span class="field-label">최소 간격 (일)</span>
                <input
                  v-model.number="ipsStore.draft.rebalance.minIntervalDays"
                  type="number"
                  step="1"
                  min="0"
                  class="field-input"
                  :class="{ 'field-input-error': err('rebalance.minIntervalDays') }"
                />
              </label>
            </div>
            <div>
              <div class="field-label mb-2">허용 모드 (다중 선택)</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="m in rebalanceModeOptions"
                  :key="m.value"
                  type="button"
                  @click="toggleMode(m.value)"
                  class="profile-chip"
                  :class="{ 'profile-chip-active': ipsStore.draft.rebalance.allowedModes.includes(m.value) }"
                >
                  <div class="profile-chip-label">{{ m.label }}</div>
                  <div class="profile-chip-desc">{{ m.desc }}</div>
                </button>
              </div>
            </div>
          </PolicyCard>

          <!-- 5. 비용 제약 -->
          <PolicyCard
            :index="5"
            title="비용 제약"
            subtitle="거래비용 한도 (bp = 0.01%)"
            :status="sectionStatus('cost', costDone, costModified)"
            :error-message="err('cost')"
            @toggle="toggleAck('cost')"
          >
            <div class="grid grid-cols-2 gap-4">
              <label class="field">
                <span class="field-label">회당 한도 (bp)</span>
                <input
                  v-model.number="ipsStore.draft.cost.perTradeBpsLimit"
                  type="number"
                  step="1"
                  min="0"
                  class="field-input"
                  :class="{ 'field-input-error': err('cost.perTradeBpsLimit') }"
                />
              </label>
              <label class="field">
                <span class="field-label">연간 누적 한도 (bp)</span>
                <input
                  v-model.number="ipsStore.draft.cost.annualBpsLimit"
                  type="number"
                  step="10"
                  min="0"
                  class="field-input"
                  :class="{ 'field-input-error': err('cost.annualBpsLimit') }"
                />
              </label>
            </div>
          </PolicyCard>

          <!-- 6. 제약 사항 -->
          <PolicyCard
            :index="6"
            title="제약 사항"
            subtitle="보유 금지 종목 · 종목별 비중 한도"
            :status="sectionStatus('constraints', constraintsDone, constraintsModified)"
            :error-message="err('constraints')"
            @toggle="toggleAck('constraints')"
          >
            <div>
              <div class="field-label mb-2">보유 금지 종목</div>
              <form class="flex gap-2 mb-2" @submit.prevent="onForbiddenSubmit">
                <input
                  v-model="forbiddenInput"
                  type="text"
                  placeholder="종목 코드 입력 후 Enter (예: 064350)"
                  class="field-input flex-1"
                />
                <button
                  type="submit"
                  class="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:border-gray-900 transition"
                >추가</button>
              </form>
              <div v-if="ipsStore.draft.constraints.forbiddenTickers.length === 0" class="text-xs text-gray-400">
                등록된 금지 종목이 없습니다
              </div>
              <div v-else class="flex flex-wrap gap-1.5">
                <span
                  v-for="(t, i) in ipsStore.draft.constraints.forbiddenTickers"
                  :key="t"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-red-50 text-red-700 rounded-md"
                >
                  {{ t }}
                  <button type="button" @click="removeForbidden(i)" class="text-red-400 hover:text-red-700">×</button>
                </span>
              </div>
            </div>

            <div class="mt-3 pt-3 border-t border-gray-100">
              <div class="flex items-center justify-between mb-2">
                <div class="field-label">종목별 비중 한도</div>
                <button
                  type="button"
                  @click="addPositionLimit"
                  class="text-xs font-medium text-gray-700 hover:text-gray-900"
                >+ 추가</button>
              </div>
              <div v-if="ipsStore.draft.constraints.positionLimits.length === 0" class="text-xs text-gray-400">
                등록된 비중 한도가 없습니다
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(p, i) in ipsStore.draft.constraints.positionLimits"
                  :key="i"
                  class="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center"
                >
                  <input
                    v-model="p.ticker"
                    type="text"
                    placeholder="종목 코드"
                    class="field-input"
                    :class="{ 'field-input-error': !p.ticker.trim() }"
                  />
                  <input
                    v-model.number="p.minPct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="field-input w-20"
                    :class="{ 'field-input-error': p.minPct >= p.maxPct }"
                    title="min %"
                  />
                  <input
                    v-model.number="p.maxPct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    class="field-input w-20"
                    :class="{ 'field-input-error': p.minPct >= p.maxPct }"
                    title="max %"
                  />
                  <button type="button" @click="removePositionLimit(i)" class="text-gray-400 hover:text-red-600 px-2">×</button>
                </div>
                <div class="text-[11px] text-gray-400">컬럼: 종목 · min% · max%</div>
              </div>
            </div>
          </PolicyCard>
        </div>

        <!-- 우측: 실시간 요약 -->
        <aside class="col-span-1">
          <div class="bg-white border border-gray-200 rounded-lg p-5 sticky top-6">
            <div class="text-xs font-medium tracking-wider text-gray-500 mb-3">실시간 요약</div>

            <dl class="space-y-3 text-sm">
              <div>
                <dt class="summary-dt">투자 목표</dt>
                <dd class="summary-dd">
                  <span class="font-mono">{{ fmtPct(ipsStore.draft.goal.targetReturnPct) }}</span>
                  <span class="text-gray-400 mx-1">·</span>
                  <span>{{ ipsStore.draft.goal.investmentHorizonYears }}년</span>
                </dd>
              </div>
              <div>
                <dt class="summary-dt">위험 허용도</dt>
                <dd class="summary-dd">
                  <span>{{ riskProfiles.find((p) => p.value === ipsStore.draft.risk.profile)?.label }}</span>
                  <span class="text-gray-400 mx-1">·</span>
                  <span class="font-mono">MDD {{ fmtPct(ipsStore.draft.risk.maxDrawdownPct) }}</span>
                </dd>
              </div>
              <div>
                <dt class="summary-dt">자산 배분</dt>
                <dd class="summary-dd">
                  <span class="font-mono">
                    주 {{ ipsStore.draft.allocation.equityPct }}% ·
                    채 {{ ipsStore.draft.allocation.bondPct }}% ·
                    현 {{ ipsStore.draft.allocation.cashPct }}%
                  </span>
                </dd>
              </div>
              <div>
                <dt class="summary-dt">리밸런싱</dt>
                <dd class="summary-dd">
                  <span class="font-mono">±{{ ipsStore.draft.rebalance.driftThresholdPct }}%</span>
                  <span class="text-gray-400 mx-1">·</span>
                  <span class="font-mono">{{ ipsStore.draft.rebalance.minIntervalDays }}일</span>
                  <div class="mt-1 text-xs text-gray-500 font-mono">{{ fmtModes(ipsStore.draft.rebalance.allowedModes) }}</div>
                </dd>
              </div>
              <div>
                <dt class="summary-dt">비용 한도</dt>
                <dd class="summary-dd font-mono">
                  회 {{ ipsStore.draft.cost.perTradeBpsLimit }}bp · 연 {{ ipsStore.draft.cost.annualBpsLimit }}bp
                </dd>
              </div>
              <div>
                <dt class="summary-dt">제약</dt>
                <dd class="summary-dd">
                  금지 <span class="font-mono">{{ ipsStore.draft.constraints.forbiddenTickers.length }}</span>건
                  <span class="text-gray-400 mx-1">·</span>
                  비중 <span class="font-mono">{{ ipsStore.draft.constraints.positionLimits.length }}</span>건
                </dd>
              </div>
            </dl>

            <div class="mt-4 pt-4 border-t border-gray-100">
              <div v-if="ipsStore.committed" class="text-xs text-emerald-700 bg-emerald-50 rounded-md p-2 mb-2">
                ✓ 확정됨
                <div class="text-[10px] text-emerald-600/80 font-mono mt-0.5">
                  {{ new Date(ipsStore.committed.committedAt).toLocaleString('ko-KR') }}
                </div>
              </div>
              <div v-else-if="!ipsStore.isValid" class="text-xs text-amber-700 bg-amber-50 rounded-md p-2 mb-2">
                ⚠ 검증 미통과
                <div class="text-[11px] text-amber-700/90 mt-0.5">
                  {{ ipsStore.validation.errors[0]?.message }}
                </div>
              </div>
              <div v-else class="text-xs text-blue-700 bg-blue-50 rounded-md p-2 mb-2">
                작성 완료 — 확정 가능
              </div>
            </div>
          </div>
        </aside>
      </div>

      <!-- 하단 액션 -->
      <div class="mt-8 flex items-center justify-between flex-wrap gap-4">
        <button
          @click="onReset"
          class="text-xs text-gray-500 hover:text-red-600 transition"
        >전체 초기화</button>

        <div class="flex items-center gap-2">
          <span v-if="flashSaved" class="text-xs text-gray-600">임시 저장됨</span>
          <span v-if="flashCommitted" class="text-xs text-emerald-700">IPS 확정 — console 확인</span>
          <span v-if="lastCommitError" class="text-xs text-red-600">{{ lastCommitError }}</span>

          <button
            @click="onSaveDraft"
            class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:border-gray-900 transition"
          >임시 저장</button>
          <button
            @click="onCommit"
            :disabled="!ipsStore.isValid"
            class="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 rounded-md hover:bg-black transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >확정</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 12px;
  font-weight: 500;
  color: #4b5563;
  letter-spacing: -0.005em;
}
.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
  color: #111827;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
  font-variant-numeric: tabular-nums;
}
.field-input:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
}
.field-input-error {
  border-color: #ef4444;
}
.field-input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}
.field-hint {
  font-size: 11px;
  color: #9ca3af;
}

.profile-chip {
  text-align: left;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 120ms ease;
}
.profile-chip:hover {
  border-color: #9ca3af;
}
.profile-chip-active {
  border-color: #111827;
  background: #111827;
  color: #ffffff;
}
.profile-chip-label {
  font-size: 13px;
  font-weight: 600;
}
.profile-chip-desc {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}
.profile-chip-active .profile-chip-desc {
  color: #d1d5db;
}

.alloc-bar {
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: #f3f4f6;
}
.alloc-bar-seg {
  height: 100%;
  transition: width 200ms ease;
}
.alloc-equity { background: #2563eb; }
.alloc-bond { background: #6b7280; }
.alloc-cash { background: #d1d5db; }

.summary-dt {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 2px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.summary-dd {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
