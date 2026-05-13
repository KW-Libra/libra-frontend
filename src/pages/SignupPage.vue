<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await auth.signup({
      email: email.value,
      password: password.value,
      displayName: displayName.value || undefined
    })
    router.replace('/dashboard')
  } catch (e: any) {
    error.value = e?.response?.data?.detail || e?.message || '가입 실패'
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
      <h1 class="text-xl font-semibold">회원가입</h1>

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
        <label class="block text-sm text-gray-700 mb-1">
          비밀번호 <span class="text-gray-400">(8자 이상)</span>
        </label>
        <input
          v-model="password"
          type="password"
          minlength="8"
          required
          autocomplete="new-password"
          class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <div>
        <label class="block text-sm text-gray-700 mb-1">
          표시 이름 <span class="text-gray-400">(선택)</span>
        </label>
        <input
          v-model="displayName"
          type="text"
          maxlength="80"
          class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full bg-gray-900 text-white py-2 rounded disabled:opacity-50"
      >
        {{ submitting ? '가입 중...' : '가입' }}
      </button>

      <p class="text-sm text-gray-500 text-center">
        이미 계정이 있나요?
        <RouterLink to="/login" class="text-gray-900 underline">로그인</RouterLink>
      </p>
    </form>
  </div>
</template>
