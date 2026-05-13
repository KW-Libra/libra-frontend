import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type LoginPayload, type SignupPayload } from '@/api/auth'
import { TOKEN_KEY, USER_KEY } from '@/api/client'
import type { AuthResponse, UserProfile } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserProfile | null>(null)
  let hydrated = false

  const isAuthenticated = computed(() => !!token.value)

  function hydrate() {
    if (hydrated) return
    hydrated = true
    const t = localStorage.getItem(TOKEN_KEY)
    const u = localStorage.getItem(USER_KEY)
    if (t) token.value = t
    if (u) {
      try {
        user.value = JSON.parse(u) as UserProfile
      } catch {
        /* corrupted — ignore */
      }
    }
  }

  function persist(t: string, u: UserProfile) {
    token.value = t
    user.value = u
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  function afterAuth(res: AuthResponse) {
    const profile: UserProfile = {
      id: res.userId,
      email: res.email,
      displayName: res.displayName,
      createdAt: new Date().toISOString() // /me 로 최종 확정
    }
    persist(res.accessToken, profile)
  }

  async function login(payload: LoginPayload) {
    const res = await authApi.login(payload)
    afterAuth(res.data)
  }

  async function signup(payload: SignupPayload) {
    const res = await authApi.signup(payload)
    afterAuth(res.data)
  }

  async function loadProfile() {
    const res = await authApi.me()
    user.value = res.data
    localStorage.setItem(USER_KEY, JSON.stringify(res.data))
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return {
    token,
    user,
    isAuthenticated,
    hydrate,
    login,
    signup,
    loadProfile,
    logout
  }
})
