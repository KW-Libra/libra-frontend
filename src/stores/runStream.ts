import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  resumeRunStream,
  startRunStream,
  type ResumeBody,
  type RunStartBody
} from '@/api/sse'
import type { RunEvent } from '@/types/events'

type RunCompletedEvent = Extract<RunEvent, { event: 'run_completed' }>
type InterruptRequiredEvent = Extract<RunEvent, { event: 'interrupt_required' }>

export type RunStreamPhase =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'interrupted'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'ignored'

export const useRunStreamStore = defineStore('runStream', () => {
  const phase = ref<RunStreamPhase>('idle')
  const events = ref<RunEvent[]>([])
  const currentThreadId = ref<string | null>(null)
  const pendingInterrupt = ref<InterruptRequiredEvent['data'] | null>(null)
  const completion = ref<RunCompletedEvent['data'] | null>(null)
  const errorMessage = ref<string | null>(null)

  let controller: AbortController | null = null
  let activeRequestId = 0

  const lastEvent = computed(() => events.value.at(-1) ?? null)
  const debateEvents = computed(() =>
    events.value.filter((event) =>
      [
        'judge_action',
        'agent_started',
        'agent_completed',
        'agent_failed',
        'mediator_decision',
        'consensus_updated',
        'final_decision_draft'
      ].includes(event.event)
    )
  )
  const isStreaming = computed(() => phase.value === 'connecting' || phase.value === 'streaming')
  const isAwaitingResume = computed(() => phase.value === 'interrupted' && !!pendingInterrupt.value)
  const hasTerminalEvent = computed(() =>
    phase.value === 'interrupted' ||
    phase.value === 'completed' ||
    phase.value === 'failed' ||
    phase.value === 'ignored'
  )

  function startController() {
    controller?.abort()
    controller = new AbortController()
    activeRequestId += 1
    return { requestId: activeRequestId, signal: controller.signal }
  }

  function isActive(requestId: number) {
    return requestId === activeRequestId
  }

  function clearRun() {
    events.value = []
    currentThreadId.value = null
    pendingInterrupt.value = null
    completion.value = null
    errorMessage.value = null
  }

  function reset() {
    cancel()
    clearRun()
    phase.value = 'idle'
  }

  function cancel() {
    activeRequestId += 1
    controller?.abort()
    controller = null
    if (!hasTerminalEvent.value) {
      phase.value = 'cancelled'
    }
  }

  function applyEvent(event: RunEvent) {
    events.value.push(event)

    switch (event.event) {
      case 'run_started':
        currentThreadId.value = event.data.thread_id
        phase.value = 'streaming'
        break
      case 'interrupt_required':
        currentThreadId.value = event.data.thread_id
        pendingInterrupt.value = event.data
        phase.value = 'interrupted'
        break
      case 'resume_received':
        currentThreadId.value = event.data.thread_id
        pendingInterrupt.value = null
        phase.value = 'streaming'
        break
      case 'resume_ignored':
        currentThreadId.value = event.data.thread_id
        pendingInterrupt.value = null
        phase.value = 'ignored'
        break
      case 'run_completed':
        currentThreadId.value = event.data.thread_id
        pendingInterrupt.value = null
        completion.value = event.data
        phase.value = 'completed'
        break
      case 'run_failed':
        currentThreadId.value = event.data.thread_id
        errorMessage.value = event.data.error
        phase.value = 'failed'
        break
      case 'node_started':
      case 'node_completed':
      case 'judge_action':
      case 'agent_started':
      case 'agent_completed':
      case 'agent_failed':
      case 'mediator_decision':
      case 'consensus_updated':
      case 'final_decision_draft':
        break
    }
  }

  function streamHandlers(requestId: number) {
    return {
      onOpen() {
        if (isActive(requestId) && phase.value === 'connecting') {
          phase.value = 'streaming'
        }
      },
      onEvent(event: RunEvent) {
        if (isActive(requestId)) {
          applyEvent(event)
        }
      },
      onError(err: unknown) {
        if (!isActive(requestId)) return
        errorMessage.value = err instanceof Error ? err.message : String(err)
        phase.value = 'failed'
      },
      onClose() {
        if (isActive(requestId)) {
          controller = null
        }
      }
    }
  }

  async function start(body: RunStartBody) {
    const { requestId, signal } = startController()
    clearRun()
    currentThreadId.value = body.thread_id ?? null
    phase.value = 'connecting'

    try {
      await startRunStream(body, streamHandlers(requestId), signal)
    } catch (err) {
      if (signal.aborted) return
      if (isActive(requestId)) {
        errorMessage.value = err instanceof Error ? err.message : String(err)
        phase.value = 'failed'
      }
      throw err
    } finally {
      if (isActive(requestId)) {
        controller = null
      }
    }
  }

  async function resume(body: ResumeBody) {
    if (!currentThreadId.value) {
      throw new Error('Cannot resume without a thread_id')
    }

    const threadId = currentThreadId.value
    const { requestId, signal } = startController()
    errorMessage.value = null
    phase.value = 'connecting'

    try {
      await resumeRunStream(threadId, body, streamHandlers(requestId), signal)
    } catch (err) {
      if (signal.aborted) return
      if (isActive(requestId)) {
        errorMessage.value = err instanceof Error ? err.message : String(err)
        phase.value = 'failed'
      }
      throw err
    } finally {
      if (isActive(requestId)) {
        controller = null
      }
    }
  }

  return {
    phase,
    events,
    currentThreadId,
    pendingInterrupt,
    completion,
    errorMessage,
    lastEvent,
    debateEvents,
    isStreaming,
    isAwaitingResume,
    hasTerminalEvent,
    start,
    resume,
    cancel,
    reset
  }
})
