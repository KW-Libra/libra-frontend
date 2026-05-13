import { api } from './client'
import type { AuthResponse, UserProfile } from '@/types/api'

export interface SignupPayload {
  email: string
  password: string
  displayName?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authApi = {
  signup: (body: SignupPayload) =>
    api.post<AuthResponse>('/api/auth/signup', body),

  login: (body: LoginPayload) =>
    api.post<AuthResponse>('/api/auth/login', body),

  me: () =>
    api.get<UserProfile>('/api/auth/me')
}
