<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <article class="board">
    <section class="board-hero">
      <div class="hero-figure-block">
        <span class="hero-eyebrow">{{ route.meta.eyebrow }} · 준비 중</span>
        <h2 class="hero-figure">
          <span>{{ route.meta.title }}</span>
        </h2>
        <div class="hero-delta">
          <span class="delta-meta">backend 계약과 사용자 흐름이 정해진 뒤 작업합니다.</span>
        </div>
      </div>
    </section>

    <section class="board-stats">
      <div class="stat">
        <span>Status</span>
        <strong>Draft</strong>
        <em>not yet shipped</em>
      </div>
      <div class="stat">
        <span>Editor</span>
        <strong>LIBRA</strong>
        <em>internal</em>
      </div>
      <div class="stat">
        <span>Release</span>
        <strong>TBD</strong>
        <em>tracking</em>
      </div>
      <div class="stat">
        <span>Next</span>
        <strong>Decision</strong>
        <em>Dashboard에서 Judge 실행</em>
      </div>
    </section>

    <section class="board-verdict" data-tone="neutral">
      <div class="verdict-copy">
        <span class="verdict-eyebrow">이 화면은 다음 호에 발행됩니다.</span>
        <h3>곧 도착</h3>
        <p>
          Backend 계약과 사용자 흐름이 정해진 뒤 작업합니다. 그때까지는 Decision Room에서
          Judge의 판단을 확인하세요.
        </p>
      </div>
      <div class="verdict-meta">
        <span class="verdict-conf">status <strong>DRAFT</strong></span>
        <RouterLink class="verdict-cta" to="/dashboard">Dashboard로 →</RouterLink>
      </div>
    </section>
  </article>
</template>
