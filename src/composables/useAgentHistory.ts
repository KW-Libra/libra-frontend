import { ref } from 'vue'
import { agentRunsApi, type AgentRunSummary, type AgentRunTranscript } from '@/api/agentRuns'

/**
 * Loads persisted past deliberation runs and a selected run's transcript
 * for the History tab.
 */
export function useAgentHistory() {
  const runs = ref<AgentRunSummary[]>([])
  const loading = ref(false)
  const selected = ref<AgentRunTranscript | null>(null)
  const error = ref<string | null>(null)

  async function loadRuns() {
    loading.value = true
    error.value = null
    try {
      runs.value = (await agentRunsApi.list(0, 20)).content
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function selectRun(runId: string) {
    error.value = null
    try {
      selected.value = await agentRunsApi.transcript(runId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function clearSelection() {
    selected.value = null
  }

  return { runs, loading, selected, error, loadRuns, selectRun, clearSelection }
}
