<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuth } from "../composables/useAuth";

const route = useRoute();
const router = useRouter();
const { applyOauthCallback, fetchMe, clear } = useAuth();

const status = ref<"loading" | "error">("loading");
const errorMessage = ref<string | null>(null);

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (error) {
    status.value = "error";
    errorMessage.value = `OAuth 로그인 실패: ${error}`;
    return;
  }

  if (!applyOauthCallback(params)) {
    status.value = "error";
    errorMessage.value = "OAuth 응답에 토큰이 포함되지 않았습니다.";
    return;
  }

  const me = await fetchMe();
  if (!me) {
    clear();
    status.value = "error";
    errorMessage.value = "사용자 정보를 가져오지 못했습니다.";
    return;
  }

  const redirect = (route.query.redirect as string) || "/dashboard";
  router.replace(redirect);
});
</script>

<template>
  <section class="auth-paper">
    <template v-if="status === 'loading'">
      <span class="kicker">Authentication · OAuth callback</span>
      <h1 class="auth-title">로그인 정보를 확인하는 중…</h1>
      <p class="auth-deck">잠시 후 자동으로 이동합니다.</p>
    </template>
    <template v-else>
      <span class="kicker">Authentication · 실패</span>
      <h1 class="auth-title">로그인하지 못했습니다.</h1>
      <p class="auth-deck">{{ errorMessage }}</p>
      <div class="auth-footer">
        <RouterLink class="link-cta" to="/login">로그인 화면으로 →</RouterLink>
      </div>
    </template>
  </section>
</template>
