<script setup lang="ts">
defineProps<{
  portfolioState: "idle" | "loading" | "syncing" | "live" | "demo" | "error";
  judgeState: "ready" | "running" | "done" | "error";
  calledCount: number;
  skippedCount: number;
  totalValueLabel: string;
}>();

function portfolioLabel(state: "idle" | "loading" | "syncing" | "live" | "demo" | "error") {
  if (state === "live") return "KIS 반영";
  if (state === "loading") return "불러오는 중";
  if (state === "syncing") return "KIS 동기화 중";
  if (state === "error") return "동기화 실패";
  return "예시 스냅샷";
}

function judgeLabel(state: "ready" | "running" | "done" | "error") {
  if (state === "running") return "실행 중";
  if (state === "done") return "완료";
  if (state === "error") return "오류";
  return "대기";
}
</script>

<template>
  <section class="run-strip" aria-label="실행 상태">
    <div>
      <span>포트폴리오</span>
      <strong>{{ portfolioLabel(portfolioState) }}</strong>
    </div>
    <div>
      <span>Judge</span>
      <strong>{{ judgeLabel(judgeState) }}</strong>
    </div>
    <div>
      <span>호출</span>
      <strong>{{ calledCount }}개 검토 · {{ skippedCount }}개 건너뜀</strong>
    </div>
    <div>
      <span>평가금액</span>
      <strong>{{ totalValueLabel }}원</strong>
    </div>
  </section>
</template>
