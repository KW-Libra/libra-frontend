<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { useAuth } from "../composables/useAuth";
import StockSearch from "../components/search/StockSearch.vue";
import { navItems } from "../router";

defineProps<{
  theme: "dark" | "light";
  lang: "ko" | "en";
}>();

defineEmits<{
  toggleTheme: [];
  setLang: [value: "ko" | "en"];
}>();

const route = useRoute();
const router = useRouter();
const { currentUser, logout } = useAuth();

const pageTitle = computed(() => (route.meta.title as string) ?? "LIBRA");
const pageEyebrow = computed(() => (route.meta.eyebrow as string) ?? "Workspace");
const showGlobalStockSearch = computed(() => route.path !== "/onboarding");

const userInitial = computed(() =>
  (currentUser.value?.name?.charAt(0) ?? "·").toUpperCase(),
);

async function onLogout() {
  await logout();
  router.replace("/login");
}
</script>

<template>
  <div class="workshell">
    <aside class="workshell-rail" aria-label="LIBRA navigation">
      <RouterLink to="/dashboard" class="rail-brand">
        <span class="rail-brand-mark" aria-hidden="true">LB</span>
        <span class="rail-brand-text">
          <strong>LIBRA</strong>
          <small>Balance Engine</small>
        </span>
      </RouterLink>

      <nav class="rail-nav" aria-label="LIBRA workspace">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="rail-link"
        >
          <span class="rail-link-mark" aria-hidden="true">{{ item.glyph }}</span>
          <span class="rail-link-text">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="rail-foot">
        <div class="rail-controls">
          <button
            type="button"
            class="rail-chip"
            :data-active="lang === 'ko'"
            @click="$emit('setLang', lang === 'ko' ? 'en' : 'ko')"
          >
            {{ lang === "ko" ? "KO" : "EN" }}
          </button>
          <button
            type="button"
            class="rail-chip"
            :aria-label="theme === 'dark' ? '라이트 테마' : '다크 테마'"
            @click="$emit('toggleTheme')"
          >
            {{ theme === "dark" ? "DARK" : "LITE" }}
          </button>
        </div>

        <div v-if="currentUser" class="rail-user">
          <span class="rail-user-mark" aria-hidden="true">{{ userInitial }}</span>
          <span class="rail-user-text">
            <strong>{{ currentUser.name }}</strong>
            <small>{{ currentUser.email }}</small>
          </span>
          <button type="button" class="rail-signout" @click="onLogout">↗</button>
        </div>
      </div>
    </aside>

    <main class="workshell-main">
      <header class="workshell-bar">
        <div class="bar-title">
          <span class="bar-eyebrow">{{ pageEyebrow }}</span>
          <h1>{{ pageTitle }}</h1>
        </div>
        <StockSearch v-if="showGlobalStockSearch" />
        <div v-else class="bar-context">
          <span>설정 흐름</span>
          <strong>기준 설정 → 종목 선택 → 비중 저장</strong>
        </div>
        <div class="bar-system">
          <span>판단 엔진</span>
          <strong>13 agents ready</strong>
        </div>
      </header>

      <RouterView />
    </main>
  </div>
</template>
