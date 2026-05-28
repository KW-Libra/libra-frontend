<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('demo@libra.local')
const password = ref('demo1234')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await auth.login({ email: email.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
  } catch (e: any) {
    error.value = e?.response?.data?.detail || e?.message || '로그인 실패'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section id="login-page" class="view-section">
    <div id="webgl-container" aria-hidden="true">
      <div class="jy-orbit-line one"></div>
      <div class="jy-orbit-line two"></div>
      <div class="jy-star-field"></div>
    </div>

    <div class="top-bar">
      <div class="version-tag">V03.01</div>
      <button type="button" class="theme-toggle">
        <i class="ph ph-moon"></i>
        <span>다크</span>
      </button>
    </div>

    <div class="tech-label label-top-left">SYS.CORE // ON-LINE</div>
    <div class="tech-label label-bottom-left">UPLINK_ESTABLISHED_</div>
    <div class="tech-label label-vertical-right">
      <span>TELE</span>
      <span>=</span>
      <span>PROMPT</span>
      <span>-3R</span>
    </div>

    <div class="layout-grid">
      <div class="auth-wrapper">
        <div class="auth-panel">
          <div class="header-group">
            <div class="system-badge">AURA.IDENTITY</div>
            <h1>Authenticate</h1>
            <p class="subtitle">Secure bio-metric or credential access.</p>
          </div>

          <div class="sso-grid">
            <button type="button" class="btn-sso" aria-label="Sign in with Apple" disabled>
              <i class="ph-fill ph-apple-logo"></i>
            </button>
            <button type="button" class="btn-sso" aria-label="Sign in with Google" disabled>
              <i class="ph-fill ph-google-logo"></i>
            </button>
            <button type="button" class="btn-sso" aria-label="Sign in with Github" disabled>
              <i class="ph-fill ph-github-logo"></i>
            </button>
          </div>

          <div class="sso-divider">STANDARD PROTOCOL</div>

          <form id="login-form" class="form-group" @submit.prevent="onSubmit">
            <div class="input-wrapper">
              <label for="login-email">IDENTIFIER</label>
              <input
                id="login-email"
                v-model="email"
                type="email"
                placeholder="user@domain.net"
                required
                autocomplete="email"
              />
            </div>
            <div class="input-wrapper">
              <label for="login-password">PASSCODE</label>
              <input
                id="login-password"
                v-model="password"
                type="password"
                placeholder="••••••••••••"
                required
                autocomplete="current-password"
              />
            </div>

            <p v-if="error" class="auth-error">{{ error }}</p>

            <button id="btn-signin-submit" type="submit" class="btn-primary" :disabled="submitting">
              {{ submitting ? 'UPLINKING...' : 'INITIALIZE UPLINK' }}
              <i class="ph ph-arrow-right"></i>
            </button>
          </form>

          <div class="auth-footer">
            <span class="auth-foot-text">신규 식별자 발급</span>
            <RouterLink id="btn-goto-signup" to="/signup" class="auth-foot-link">REGISTER&nbsp;→</RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css');
@import url('https://unpkg.com/@phosphor-icons/web@2.1.2/src/fill/style.css');
@import '@/assets/jy-design/login.css';

#login-page #webgl-container {
  background:
    radial-gradient(circle at 32% 45%, rgba(202, 214, 232, 0.5), transparent 13%),
    radial-gradient(circle at 24% 25%, rgba(255, 255, 255, 0.18), transparent 18%),
    radial-gradient(circle at 42% 65%, rgba(132, 157, 198, 0.28), transparent 19%),
    linear-gradient(130deg, #1c2431 0%, #6f7e92 46%, #151b25 100%);
  filter: saturate(0.75);
}

#login-page .jy-star-field {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 10% 15%, rgba(255,255,255,0.8) 1px, transparent 1px),
    radial-gradient(circle at 24% 28%, rgba(255,255,255,0.55) 1px, transparent 1px),
    radial-gradient(circle at 18% 63%, rgba(255,255,255,0.65) 1px, transparent 1px),
    radial-gradient(circle at 42% 18%, rgba(255,255,255,0.5) 1px, transparent 1px),
    radial-gradient(circle at 48% 70%, rgba(255,255,255,0.45) 1px, transparent 1px);
  background-size: 170px 140px;
  opacity: 0.6;
}

#login-page .jy-orbit-line {
  position: absolute;
  left: 13%;
  top: 27%;
  width: 38%;
  height: 38%;
  border: 1px solid rgba(221, 232, 255, 0.52);
  clip-path: polygon(0 55%, 50% 0, 100% 43%, 80% 90%, 30% 70%);
  opacity: 0.75;
}

#login-page .jy-orbit-line.two {
  transform: translate(18%, 28%) rotate(18deg);
  opacity: 0.55;
}

#login-page .auth-error {
  color: #ffb3ba;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  margin: 0;
}
</style>
