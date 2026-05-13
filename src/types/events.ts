// SSE RunEvent union — 현재 stub.
// 다음 단계에서 design_spec_v1.md §2 의 RunEvent 풀세트로 확장:
//   compliance_check / agent_started / agent_completed / mediator_completed /
//   tentative_trades_computed / branch_determined / final_decision_completed /
//   interrupt_required / report_uploaded ...

export type RunEvent =
  | { event: 'run_started';     data: { thread_id: string; trigger: string; query: string } }
  | { event: 'node_started';    data: { node: string } }
  | { event: 'node_completed';  data: { node: string } }
  | { event: 'run_completed';   data: { thread_id: string; decision?: string; branch?: string } }
  | { event: 'run_failed';      data: { thread_id: string; error: string } }
  | { event: 'resume_received'; data: { thread_id: string; approved: boolean; option_index?: number } }
  | { event: 'resume_not_implemented'; data: { thread_id: string; note: string } }
