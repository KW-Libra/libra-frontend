import type { RunEvent } from '@/types/events'

export type StageStatus = 'pending' | 'active' | 'completed'

export interface RunStageDefinition {
  node: string
  label: string
  description: string
}

export interface RunStageView extends RunStageDefinition {
  status: StageStatus
}

type RunNodeEvent = Extract<RunEvent, { event: 'node_started' | 'node_completed' }>

export const runStageDefinitions: RunStageDefinition[] = [
  { node: 'compliance_before', label: 'Compliance', description: '사전 정책 검증' },
  { node: 'round1', label: 'Round 1', description: '에이전트 1차 의견' },
  { node: 'mediator', label: 'Mediator', description: '충돌 식별과 재호출 판단' },
  { node: 'final_judge', label: 'Final Judge', description: '최종 분기와 판단 생성' },
  { node: 'human_review', label: 'Human Review', description: '승인 또는 생략 처리' }
]

export function runThreadMatches(threadId: string, currentThreadId: string | null, events: RunEvent[]) {
  return Boolean(threadId && currentThreadId === threadId && events.length > 0)
}

export function stageViews(events: RunEvent[]): RunStageView[] {
  const completedNodes = new Set(
    events
      .filter((event): event is RunNodeEvent => event.event === 'node_completed')
      .map((event) => event.data.node)
  )
  const startedNodes = new Set(
    events
      .filter((event): event is RunNodeEvent => event.event === 'node_started')
      .map((event) => event.data.node)
  )
  const activeNode = [...events]
    .reverse()
    .find(
      (event): event is RunNodeEvent =>
        event.event === 'node_started' && !completedNodes.has(event.data.node)
    )
    ?.data.node
  const humanReviewSkipped = events.some((event) => event.event === 'human_review_skipped')

  return runStageDefinitions.map((stage) => {
    let status: StageStatus = 'pending'
    if (completedNodes.has(stage.node) || (stage.node === 'human_review' && humanReviewSkipped)) {
      status = 'completed'
    } else if (activeNode === stage.node || startedNodes.has(stage.node)) {
      status = 'active'
    }
    return { ...stage, status }
  })
}

export function progressPercent(stages: RunStageView[]) {
  if (!stages.length) return 0
  return Math.round((stages.filter((stage) => stage.status === 'completed').length / stages.length) * 100)
}

export function latestEvent<T extends RunEvent['event']>(
  events: RunEvent[],
  name: T
): Extract<RunEvent, { event: T }> | null {
  const found = [...events].reverse().find((event) => event.event === name)
  return (found ?? null) as Extract<RunEvent, { event: T }> | null
}

export function agentEvents(events: RunEvent[]) {
  return events.filter((event): event is Extract<RunEvent, { event: 'agent_completed' }> => event.event === 'agent_completed')
}

export function toolObservationCount(events: RunEvent[]) {
  return events
    .filter((event): event is Extract<RunEvent, { event: 'tool_observation' }> => event.event === 'tool_observation')
    .reduce((sum, event) => sum + event.data.tools.length, 0)
}

export function agentLabel(agentId: string | null | undefined) {
  const labels: Record<string, string> = {
    judge: 'Judge',
    mediator: 'Mediator',
    final_judge: 'Final Judge',
    disclosure: '공시',
    news: '뉴스',
    report: '리포트',
    profit: '수익',
    cost: '비용',
    risk: '리스크',
    tax: '세금',
    macro: '매크로',
    sentiment: '심리',
    execution: '실행',
    esg: 'ESG',
    liquidity: '유동성',
    technical: '기술',
    technical_analysis: '기술'
  }
  if (!agentId) return 'Judge'
  return labels[agentId] ?? agentId
}

export function nodeLabel(node: string | null | undefined) {
  const labels: Record<string, string> = {
    compliance_before: '사전 컴플라이언스',
    round1: '1차 에이전트 의견',
    mediator: 'Mediator 조정',
    final_judge: '최종 Judge',
    human_review: '사용자 확인'
  }
  if (!node) return '노드'
  return labels[node] ?? node
}

export function phaseLabel(phase: string | null | undefined) {
  const labels: Record<string, string> = {
    agent_tool_loop: '도구 관찰',
    agent_response: '에이전트 응답',
    agent_response_repair: '에이전트 응답 보정',
    core_routing: 'Core 라우팅',
    core_routing_repair: 'Core 라우팅 보정',
    domain_routing: 'Domain 라우팅',
    domain_agent_response: 'Domain Agent 응답',
    domain_router_primary: 'Domain LLM 호출',
    domain_router_cross_validate: 'Domain 교차검증',
    round2_target_selection: 'Round 2 표적 선택',
    final_explanation: '최종 설명',
    final_decision_preliminary: '최종 판단',
    final_decision_final: '최종 판단'
  }
  if (!phase) return ''
  return labels[phase] ?? phase
}

export function decisionToneClass(decision: string | null | undefined) {
  const value = (decision || '').toUpperCase()
  if (value.includes('REBALANCE') || value.includes('APPROVE')) {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }
  if (value.includes('USER') || value.includes('REJECT') || value.includes('FAILED')) {
    return 'border-amber-200 bg-amber-50 text-amber-800'
  }
  if (value.includes('DEFER')) {
    return 'border-gray-200 bg-gray-50 text-gray-700'
  }
  return 'border-gray-200 bg-white text-gray-900'
}

export function decisionHeadline(decision: string | null | undefined, fallback = '판단 결과를 기다리고 있습니다') {
  const value = (decision || '').toUpperCase()
  if (value.includes('REBALANCE')) return '리밸런싱 검토안이 나왔습니다'
  if (value.includes('USER')) return '사용자 확인이 필요합니다'
  if (value.includes('DEFER')) return '판단을 보류했습니다'
  if (value.includes('HOLD')) return '현재 포지션 유지 판단입니다'
  return fallback
}

export function stagePillClass(status: StageStatus) {
  if (status === 'completed') return 'border-emerald-100 bg-emerald-50 text-emerald-800'
  if (status === 'active') return 'border-blue-100 bg-blue-50 text-blue-800'
  return 'border-gray-100 bg-gray-50 text-gray-500'
}

export function stageDotClass(status: StageStatus) {
  if (status === 'completed') return 'bg-emerald-500 text-white'
  if (status === 'active') return 'bg-blue-500 text-white ring-4 ring-blue-100'
  return 'border border-gray-200 bg-white text-gray-400'
}

export function directionText(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0.00'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

export function percentText(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return `${Math.round(value * 100)}%`
}

export function formatUnknown(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function eventTitle(event: RunEvent) {
  switch (event.event) {
    case 'run_started':
      return '판단 시작'
    case 'node_started':
      return `${nodeLabel(event.data.node)} 시작`
    case 'node_completed':
      return `${nodeLabel(event.data.node)} 완료`
    case 'judge_action':
      return event.data.action === 'CALL_AGENT'
        ? `${agentLabel(event.data.agent_id)} 호출`
        : 'Judge 판단'
    case 'agent_started':
      return `${agentLabel(event.data.agent_id)} 분석 시작`
    case 'agent_completed':
      return `${agentLabel(event.data.agent_id)} 의견 제출`
    case 'agent_failed':
      return `${agentLabel(event.data.agent_id)} 실패`
    case 'tool_observation':
      return `${agentLabel(event.data.actor)} 도구 관찰`
    case 'llm_prompt':
      return `${agentLabel(event.data.actor)} 프롬프트 입력`
    case 'llm_response':
      return `${agentLabel(event.data.actor)} LLM 응답`
    case 'llm_error':
      return `${agentLabel(event.data.actor)} LLM 실패`
    case 'llm_skipped':
      return `${agentLabel(event.data.actor)} LLM 생략`
    case 'mediator_decision':
      return 'Mediator 판정'
    case 'consensus_updated':
      return '합의 업데이트'
    case 'final_decision_draft':
      return '최종 판단 초안'
    case 'human_review_skipped':
      return '사용자 확인 생략'
    case 'interrupt_required':
      return '사용자 확인 필요'
    case 'resume_received':
      return '재개 요청 수신'
    case 'resume_ignored':
      return '재개 요청 무시'
    case 'run_completed':
      return '판단 완료'
    case 'run_failed':
      return '판단 실패'
    default:
      return '이벤트'
  }
}

export function eventDetail(event: RunEvent) {
  switch (event.event) {
    case 'run_started':
      return event.data.query
    case 'judge_action':
      return event.data.reason || event.data.query || ''
    case 'agent_completed':
      return event.data.reasoning || event.data.limits_acknowledged || event.data.verdict || ''
    case 'agent_failed':
      return event.data.error
    case 'tool_observation':
      return `${event.data.tools.length}개 도구 관찰`
    case 'llm_prompt':
    case 'llm_response':
    case 'llm_error':
    case 'llm_skipped':
      return phaseLabel(event.data.phase)
    case 'mediator_decision':
      return event.data.rationale
    case 'final_decision_draft':
      return event.data.summary || event.data.reasoning || event.data.decision || ''
    case 'human_review_skipped':
      return event.data.message
    case 'interrupt_required':
      return event.data.message || event.data.decision || ''
    case 'run_completed':
      return [event.data.decision, event.data.branch, event.data.run_status].filter(Boolean).join(' · ')
    case 'run_failed':
      return event.data.error
    default:
      return ''
  }
}
