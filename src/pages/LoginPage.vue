<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// 시드 demo 계정 prefill — 실제 운영에선 빈 값.
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
  <div class="min-h-screen flex items-center justify-center px-4">
    <form
      class="w-full max-w-sm space-y-4 p-8 bg-white rounded shadow"
      @submit.prevent="onSubmit"
    >
      <h1 class="text-xl font-semibold">로그인</h1>

      <div>
        <label class="block text-sm text-gray-700 mb-1">이메일</label>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <div>
        <label class="block text-sm text-gray-700 mb-1">비밀번호</label>
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full bg-gray-900 text-white py-2 rounded disabled:opacity-50"
      >
        {{ submitting ? '로그인 중...' : '로그인' }}
      </button>

      <p class="text-sm text-gray-500 text-center">
        계정이 없나요?
        <RouterLink to="/signup" class="text-gray-900 underline">가입</RouterLink>
      </p>
    </form>
  </div>
</template>
