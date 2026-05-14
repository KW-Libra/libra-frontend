import axios, { AxiosError } from 'axios'
import type { ProblemDetail } from '@/types/api'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

export const TOKEN_KEY = 'libra.accessToken'
export const USER_KEY = 'libra.user'

export const api = axios.create({
  baseURL,
  timeout: 30_000
})

// --- Request: traceId + Bearer 자동 박음 ------------------------------------
api.interceptors.request.use((config) => {
  config.headers['X-Trace-Id'] = crypto.randomUUID()
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// --- Response: 401 → 토큰 비우고 /login ------------------------------------
// 라우터 직접 import 하면 순환 의존 → window.location 사용
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ProblemDetail>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.assign(`/login?redirect=${redirect}`)
      }
    }
    return Promise.reject(error)
  }
)
