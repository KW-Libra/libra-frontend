<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

defineProps<{
  theme: "dark" | "light";
  lang: "ko" | "en";
}>();

defineEmits<{
  toggleTheme: [];
  setLang: [value: "ko" | "en"];
}>();
</script>

<template>
  <div class="auth-shell">
    <header class="auth-shell-mast">
      <RouterLink to="/" class="auth-brand">
        <span class="auth-brand-mark" aria-hidden="true">LB</span>
        <span class="auth-brand-name">LIBRA · Balance Engine</span>
      </RouterLink>
      <div class="auth-shell-actions">
        <button
          class="auth-shell-toggle"
          type="button"
          @click="$emit('setLang', lang === 'ko' ? 'en' : 'ko')"
        >
          {{ lang.toUpperCase() }}
        </button>
        <button
          class="auth-shell-toggle"
          type="button"
          @click="$emit('toggleTheme')"
        >
          {{ theme === "dark" ? "DARK" : "LITE" }}
        </button>
      </div>
    </header>
    <main class="auth-shell-main">
      <RouterView />
    </main>
  </div>
</template>
