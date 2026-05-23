/**
 * src/stores/ipsStore.ts
 *
 * IPS 작성/확정 상태 관리.
 *
 * - draft: 작성 중인 mutable 폼 상태
 * - committed: 확정된 immutable IPS (있으면)
 * - 영속화: localStorage 키 'libra:ips:v1'
 *
 * 백엔드 미정이므로 localStorage mock. 백엔드 연결 시 saveDraft/commit에서
 * 실제 API를 호출하도록 교체.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  emptyDraft,
  validateDraft,
  commitDraft,
  countCompletedSections,
  type IPS,
  type IPSDraft,
} from '@/types/ips'

const STORAGE_KEY = 'libra:ips:v1'

interface StoredPayload {
  draft: IPSDraft
  committed: IPS | null
}

export const useIPSStore = defineStore('ips', () => {
  const draft = ref<IPSDraft>(emptyDraft())
  const committed = ref<IPS | null>(null)
  let hydrated = false

  const validation = computed(() => validateDraft(draft.value))
  const isValid = computed(() => validation.value.valid)
  const completedSections = computed(() => countCompletedSections(draft.value))
  const errorMap = computed(() => {
    const map: Record<string, string> = {}
    for (const e of validation.value.errors) {
      if (!map[e.field]) map[e.field] = e.message
    }
    return map
  })

  function hydrate() {
    if (hydrated) return
    hydrated = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<StoredPayload>
      if (parsed.draft) {
        draft.value = { ...emptyDraft(), ...parsed.draft }
      }
      if (parsed.committed) {
        committed.value = Object.freeze(parsed.committed) as IPS
      }
    } catch {
      // corrupted — ignore
    }
  }

  function persist() {
    const payload: StoredPayload = {
      draft: draft.value,
      committed: committed.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  /** 임시 저장 — draft만 영속화. 검증 불필요. */
  function saveDraft() {
    persist()
  }

  /** 확정 — 검증 통과 시에만 committed로 봉인. */
  function commit(): { ok: true; ips: IPS } | { ok: false; errors: string[] } {
    const result = validateDraft(draft.value)
    if (!result.valid) {
      return { ok: false, errors: result.errors.map((e) => e.message) }
    }
    const ips = commitDraft(draft.value)
    committed.value = ips
    persist()
    // 시안 단계 확인용
    // eslint-disable-next-line no-console
    console.log('[IPS] committed', JSON.stringify(ips, null, 2))
    return { ok: true, ips }
  }

  function reset() {
    draft.value = emptyDraft()
    committed.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    draft,
    committed,
    validation,
    isValid,
    completedSections,
    errorMap,
    hydrate,
    saveDraft,
    commit,
    reset,
  }
})
