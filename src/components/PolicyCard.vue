<script setup lang="ts">
/**
 * src/components/PolicyCard.vue
 *
 * 정책 설정 페이지의 섹션 카드. IPS · ESG 등에서 공유.
 *
 * - 좌측: 인덱스 번호, 제목, 부제
 * - 우측: 완료 표시 (✓) 또는 에러 표시 (!)
 * - 본문: slot 으로 폼 내용 주입
 */

defineProps<{
  index?: number | string
  title: string
  subtitle?: string
  /** 'done' | 'error' | 'idle' */
  status?: 'done' | 'error' | 'idle'
  errorMessage?: string
}>()

const emit = defineEmits<{
  /** 사용자가 상태 배지(✓ 또는 —)를 클릭해 acknowledged 상태를 토글 */
  (e: 'toggle'): void
}>()
</script>

<template>
  <section class="policy-card">
    <header class="pc-header">
      <div class="pc-title-row">
        <span v-if="index !== undefined" class="pc-index">{{ index }}</span>
        <div class="pc-title-block">
          <h3 class="pc-title">{{ title }}</h3>
          <p v-if="subtitle" class="pc-subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <button
        v-if="status === 'done'"
        type="button"
        class="pc-status pc-status-done pc-status-toggle"
        aria-label="작성 완료 — 클릭하여 해제"
        title="클릭하여 기본값으로 되돌리기"
        @click="emit('toggle')"
      >✓</button>
      <span
        v-else-if="status === 'error'"
        class="pc-status pc-status-error"
        :aria-label="errorMessage || '오류'"
        :title="errorMessage"
      >!</span>
      <button
        v-else
        type="button"
        class="pc-status pc-status-idle pc-status-toggle"
        aria-label="기본값 — 클릭하여 확인 처리"
        title="기본값을 유지합니다 — 클릭하여 확인"
        @click="emit('toggle')"
      >—</button>
    </header>

    <div class="pc-body">
      <slot />
    </div>

    <div v-if="status === 'error' && errorMessage" class="pc-error-message">
      {{ errorMessage }}
    </div>
  </section>
</template>

<style scoped>
.policy-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 22px;
}
.pc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.pc-title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.pc-index {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.pc-title-block {
  min-width: 0;
}
.pc-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.01em;
}
.pc-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}
.pc-status {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  border: none;
  padding: 0;
  font-family: inherit;
}
.pc-status-toggle {
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease, background 100ms ease;
}
.pc-status-toggle:hover {
  transform: scale(1.08);
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
}
.pc-status-toggle:active {
  transform: scale(0.95);
}
.pc-status-done {
  background: #ecfdf5;
  color: #047857;
}
.pc-status-error {
  background: #fef2f2;
  color: #b91c1c;
}
.pc-status-idle {
  background: #f3f4f6;
  color: #9ca3af;
  font-weight: 600;
}
.pc-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pc-error-message {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 8px;
  font-size: 12px;
  color: #b91c1c;
  line-height: 1.4;
}
</style>
