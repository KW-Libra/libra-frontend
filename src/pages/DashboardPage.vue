<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  try {
    await auth.loadProfile()
  } catch {
    // 401 인터셉터가 알아서 /login 리다이렉트
  }
})

function onLogout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="min-h-screen p-8">
    <header class="flex justify-between items-center mb-8 max-w-3xl mx-auto">
      <h1 class="text-2xl font-semibold">Libra</h1>
      <button
        @click="onLogout"
        class="text-sm text-gray-600 hover:text-gray-900 underline"
      >
        로그아웃
      </button>
    </header>

    <main class="max-w-3xl mx-auto">
      <section class="mb-6">
        <p class="text-gray-700 mb-1">
          <strong>{{ auth.user?.email }}</strong> 로 로그인됨
        </p>
        <p class="text-gray-500 text-sm">
          userId: <code class="bg-gray-100 px-1 rounded">{{ auth.user?.id }}</code>
        </p>
      </section>

      <section class="p-4 bg-gray-100 rounded text-sm text-gray-700">
        <p class="font-medium mb-2">다음 단계 (이 페이지는 디자인 전 골격)</p>
        <ul class="list-disc list-inside space-y-1 text-gray-600">
          <li>의사결정 트리거 페이지 (pull / push / user_request → SSE 스트림)</li>
          <li>토론 트랜스크립트 시각화 (12 발언 + Mediator + Final Judge)</li>
          <li>합의 매트릭스 — vote_distribution</li>
          <li>HITL 다이얼로그 — interrupt_required 수신 시 3 옵션</li>
          <li>4분기 보고서 페이지 + 4차원 메트릭 비교</li>
          <li>IPS / ESG 설정 UI</li>
        </ul>
      </section>
    </main>
  </div>
</template>
