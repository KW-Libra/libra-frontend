<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { AuthError, getApiBaseUrl, useAuth } from "../composables/useAuth";

const router = useRouter();
const { login } = useAuth();

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMessage = ref<string | null>(null);

const apiBase = getApiBaseUrl();

async function onSubmit() {
  errorMessage.value = null;
  loading.value = true;
  try {
    await login(email.value.trim(), password.value);
    const redirect = (router.currentRoute.value.query.redirect as string) || "/dashboard";
    router.replace(redirect);
  } catch (error) {
    if (error instanceof AuthError) {
      errorMessage.value =
        error.status === 401 ? "이메일 또는 비밀번호가 올바르지 않습니다." : error.message;
    } else if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = "로그인 중 오류가 발생했습니다.";
    }
  } finally {
    loading.value = false;
  }
}

function oauthHref(provider: "google" | "kakao" | "naver") {
  return `${apiBase}/oauth2/authorization/${provider}`;
}
</script>

<template>
  <section class="auth-screen">
    <div class="auth-product">
      <span class="auth-badge">AI Portfolio Judge</span>
      <h1>투자 판단 콘솔로 돌아갑니다.</h1>
      <p>
        목표 비중, KIS 잔고, 시장 신호, 에이전트 판단 이력을 한 화면에서 이어서 확인합니다.
      </p>

      <div class="auth-preview" aria-hidden="true">
        <div class="auth-preview-head">
          <span>Portfolio</span>
          <strong>REBALANCE</strong>
        </div>
        <div class="auth-preview-value">
          <strong>50,000,000원</strong>
          <span>confidence 85%</span>
        </div>
        <div class="auth-preview-bars">
          <i style="--w: 52%"></i>
          <i style="--w: 28%"></i>
          <i style="--w: 38%"></i>
        </div>
        <ol>
          <li><span>1</span>목표 포트폴리오 불러오기</li>
          <li><span>2</span>KIS 잔고와 현재가 동기화</li>
          <li><span>3</span>13개 에이전트 판단 확인</li>
        </ol>
      </div>
    </div>

    <div class="auth-panel">
      <div class="auth-panel-head">
        <span class="kicker">Authentication</span>
        <h2>로그인</h2>
        <p>저장된 포트폴리오와 판단 이력을 불러옵니다.</p>
      </div>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="auth-field">
          <span>Email</span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label class="auth-field">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            minlength="8"
            placeholder="8자 이상"
          />
        </label>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

        <button class="auth-primary" type="submit" :disabled="loading">
          <span>{{ loading ? "로그인 중" : "로그인" }}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <div class="auth-divider"><span>또는 소셜 계정으로 계속</span></div>

      <div class="auth-oauth">
        <a class="auth-oauth-btn" :href="oauthHref('google')"><span>G</span>Google</a>
        <a class="auth-oauth-btn" :href="oauthHref('kakao')"><span>K</span>Kakao</a>
        <a class="auth-oauth-btn" :href="oauthHref('naver')"><span>N</span>Naver</a>
      </div>

      <div class="auth-footer">
        <span>처음 사용하시나요?</span>
        <RouterLink to="/signup">계정 만들기</RouterLink>
      </div>
    </div>
  </section>
</template>
