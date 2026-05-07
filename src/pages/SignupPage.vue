<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { AuthError, getApiBaseUrl, useAuth } from "../composables/useAuth";

const router = useRouter();
const { signup } = useAuth();

const email = ref("");
const password = ref("");
const name = ref("");
const loading = ref(false);
const errorMessage = ref<string | null>(null);

const apiBase = getApiBaseUrl();

async function onSubmit() {
  errorMessage.value = null;
  loading.value = true;
  try {
    await signup(email.value.trim(), password.value, name.value.trim());
    router.replace("/onboarding");
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 409) {
        errorMessage.value = "이미 가입된 이메일입니다. 로그인을 이용하세요.";
      } else {
        errorMessage.value = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = "회원가입 중 오류가 발생했습니다.";
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
      <span class="auth-badge">Initial Portfolio Setup</span>
      <h1>LIBRA 판단 기준을 처음 설정합니다.</h1>
      <p>
        가입 후 목표 포트폴리오를 만들고, KIS 종목/잔고를 연결한 뒤 Judge가 비교할 기준을 저장합니다.
      </p>

      <div class="auth-preview" aria-hidden="true">
        <div class="auth-preview-head">
          <span>Setup</span>
          <strong>3 STEPS</strong>
        </div>
        <div class="auth-preview-value">
          <strong>목표 비중</strong>
          <span>ready for judge</span>
        </div>
        <div class="auth-preview-bars">
          <i style="--w: 46%"></i>
          <i style="--w: 34%"></i>
          <i style="--w: 20%"></i>
        </div>
        <ol>
          <li><span>1</span>투자 성향과 운용 금액 설정</li>
          <li><span>2</span>KIS 종목 검색 후 바스켓 구성</li>
          <li><span>3</span>목표 비중 저장 후 대시보드 진입</li>
        </ol>
      </div>
    </div>

    <div class="auth-panel">
      <div class="auth-panel-head">
        <span class="kicker">Authentication</span>
        <h2>회원가입</h2>
        <p>첫 판단에 필요한 사용자 기준을 생성합니다.</p>
      </div>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="auth-field">
          <span>Name</span>
          <input v-model="name" type="text" required autocomplete="name" placeholder="홍길동" maxlength="120" />
        </label>
        <label class="auth-field">
          <span>Email</span>
          <input v-model="email" type="email" required autocomplete="email" placeholder="you@example.com" />
        </label>
        <label class="auth-field">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="new-password"
            minlength="8"
            placeholder="8자 이상"
          />
        </label>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

        <button class="auth-primary" type="submit" :disabled="loading">
          <span>{{ loading ? "계정 생성 중" : "회원가입" }}</span>
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
        <span>이미 계정이 있나요?</span>
        <RouterLink to="/login">로그인</RouterLink>
      </div>
    </div>
  </section>
</template>
