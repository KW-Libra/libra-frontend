<script setup lang="ts">
const initialItems = [
  "포트폴리오 상태",
  "판단 에이전트 실행 기록",
  "사용자 승인 대기 항목",
  "리밸런싱 후보"
];
</script>

<template>
  <main class="app-shell">
    <section class="workspace">
      <p class="eyebrow">LIBRA</p>
      <h1>투자 판단 워크스페이스</h1>
      <p class="lede">
        보유 종목, 판단 근거, 승인 대기 결정을 한 화면에서 확인합니다.
      </p>
      <div class="status-grid" aria-label="초기 작업 영역">
        <article v-for="item in initialItems" :key="item" class="status-item">
          <span>{{ item }}</span>
          <strong>준비 중</strong>
        </article>
      </div>
    </section>
  </main>
</template>
