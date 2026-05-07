<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";

import { useAuth } from "./composables/useAuth";
import AppShell from "./layouts/AppShell.vue";
import AuthLayout from "./layouts/AuthLayout.vue";
import LandingPage from "./pages/LandingPage.vue";

type Theme = "dark" | "light";
type Lang = "ko" | "en";

const route = useRoute();
const { bootstrap } = useAuth();
const theme = ref<Theme>("light");
const lang = ref<Lang>("ko");

const layout = computed(() => (route.meta.layout as string) ?? "shell");

watchEffect(() => {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.value);
  root.setAttribute("data-lang", lang.value);
  root.setAttribute("lang", lang.value);
});

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

function setLang(value: Lang) {
  lang.value = value;
}

onMounted(() => {
  void bootstrap();
});
</script>

<template>
  <LandingPage
    v-if="layout === 'public'"
    :theme="theme"
    :lang="lang"
    @toggle-theme="toggleTheme"
    @set-lang="setLang"
  />
  <AuthLayout
    v-else-if="layout === 'auth'"
    :theme="theme"
    :lang="lang"
    @toggle-theme="toggleTheme"
    @set-lang="setLang"
  />
  <AppShell
    v-else
    :theme="theme"
    :lang="lang"
    @toggle-theme="toggleTheme"
    @set-lang="setLang"
  />
</template>
