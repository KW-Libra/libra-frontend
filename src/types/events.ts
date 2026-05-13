// SSE RunEvent contract v0.
// Keep this aligned with libra-agent/docs/run-events.md.

export type RunEventName =
  | 'run_started'
  | 'node_started'
  | 'node_completed'
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
