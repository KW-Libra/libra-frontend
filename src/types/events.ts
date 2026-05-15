// SSE RunEvent contract v0.
// Keep this aligned with libra-agent/docs/run-events.md.

export type RunEventName =
  | 'run_started'
  | 'node_started'
  | 'node_completed'
  | 'judge_action'
  | 'agent_started'
  | 'agent_completed'
  | 'agent_failed'
  | 'mediator_decision'
  | 'consensus_updated'
  | 'final_decision_draft'
  | 'interrupt_required'
  | 'resume_received'
  | 'resume_ignored'
  | 'run_completed'
  | 'run_failed'

export type RunNodeName =
  | 'compliance_before'
  | 'round1'
  | 'mediator'
  | 'final_judge'
  | 'human_review'

export type RunStatus = 'completed' | 'completed_after_resume' | (string & {})

export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'REVISE' | 'DEFER' | (string & {})

export interface ApprovalOption {
  decision: ApprovalDecision
  label: string
}

export interface ApprovalRequest {
  type: 'human_approval'
  reason: 'approval_required' | (string & {})
  message: string
  decision?: string | null
  branch?: string | null
  options: ApprovalOption[]
}

export interface SerializedInterrupt {
  id?: string | null
  value?: ApprovalRequest | Record<string, unknown> | null
}

export interface ApprovalResponse {
  approved: boolean
  decision?: ApprovalDecision | null
  option_index?: number | null
  override_plan?: Record<string, number> | null
  note?: string | null
}

export interface AgentToolCallSummary {
  tool_name: string
  purpose?: string | null
  summary?: string | null
}

export interface AgentCompletedPayload {
  agent_id: string
  layer?: string | null
  turn_number?: number | null
  verdict?: string | null
  opinion?: string | null
  direction?: number | null
  strength?: number | null
  confidence?: number | null
  urgency?: string | null
  risk_level?: string | null
  focus_tickers?: string[]
  reasoning?: string | null
  limits_acknowledged?: string | null
  tools_called?: AgentToolCallSummary[]
}

export interface JudgeActionPayload {
  layer?: string | null
  turn_number?: number | null
  action: 'CALL_AGENT' | 'FINALIZE' | 'FINALIZE_DOMAIN_REVIEW' | (string & {})
  agent_id?: string | null
  reason?: string | null
  query?: string | null
  depth?: string | null
  candidate_rebalance_plan?: Record<string, number>
  called_agents?: string[]
  response_count?: number
}

export type RunEvent =
  | {
      event: 'run_started'
      data: {
        thread_id: string
        trigger: 'pull' | 'push' | 'user_request' | (string & {})
        query: string
        approval_required: boolean
      }
    }
  | {
      event: 'node_started' | 'node_completed'
      data: { node: RunNodeName | string }
    }
  | {
      event: 'judge_action'
      data: JudgeActionPayload
    }
  | {
      event: 'agent_started'
      data: {
        agent_id: string
        layer?: string | null
        turn_number?: number | null
        query?: string | null
        depth?: string | null
      }
    }
  | {
      event: 'agent_completed'
      data: AgentCompletedPayload
    }
  | {
      event: 'agent_failed'
      data: {
        agent_id: string
        layer?: string | null
        turn_number?: number | null
        error: string
      }
    }
  | {
      event: 'mediator_decision'
      data: {
        targets_to_recall: string[]
        skip_round_2: boolean
        rationale: string
        round1_count?: number
        round2_count?: number
      }
    }
  | {
      event: 'consensus_updated'
      data: Record<string, unknown>
    }
  | {
      event: 'final_decision_draft'
      data: {
        decision?: string | null
        branch?: string | null
        summary?: string | null
        reasoning?: string | null
        confidence?: number | null
        urgency?: string | null
        called_agents?: string[]
        skipped_agents?: string[]
        requires_approval?: boolean
        trades?: unknown[]
      }
    }
  | {
      event: 'interrupt_required'
      data: ApprovalRequest & {
        thread_id: string
        interrupt_id?: string | null
        interrupts: SerializedInterrupt[]
      }
    }
  | {
      event: 'resume_received'
      data: {
        thread_id: string
        approved: boolean
        option_index?: number | null
      }
    }
  | {
      event: 'resume_ignored'
      data: {
        thread_id: string
        reason: 'no_pending_interrupt' | (string & {})
      }
    }
  | {
      event: 'run_completed'
      data: {
        thread_id: string
        decision?: string | null
        branch?: string | null
        run_status: RunStatus
        approval_response?: ApprovalResponse | null
      }
    }
  | {
      event: 'run_failed'
      data: {
        thread_id: string
        error: string
      }
    }
