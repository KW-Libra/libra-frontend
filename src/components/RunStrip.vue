<script setup lang="ts">
defineProps<{
  portfolioState: "idle" | "loading" | "syncing" | "live" | "demo" | "error";
  judgeState: "ready" | "running" | "done" | "error";
  calledCount: number;
  skippedCount: number;
  totalValueLabel: string;
}>();

function portfolioLabel(state: "idle" | "loading" | "syncing" | "live" | "demo" | "error") {
  if (state === "live") return "KIS snapshot";
  if (state === "loading") return "loading";
  if (state === "syncing") return "syncing KIS";
  if (state === "error") return "sync failed";
  return "demo snapshot";
}
</script>

<template>
  <section class="run-strip" aria-label="실행 상태">
    <div>
      <span>Portfolio</span>
      <strong>{{ portfolioLabel(portfolioState) }}</strong>
    </div>
    <div>
      <span>Judge</span>
      <strong>{{ judgeState }}</strong>
    </div>
    <div>
      <span>Called</span>
      <strong>{{ calledCount }} called · {{ skippedCount }} skipped</strong>
    </div>
    <div>
      <span>Total</span>
      <strong>{{ totalValueLabel }}원</strong>
    </div>
  </section>
</template>
