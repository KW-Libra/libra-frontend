// backend (Spring) 응답 타입 — Java DTO 와 1:1 매핑

/**
 * RFC 7807 ProblemDetail (Spring + FastAPI 양쪽 모두 같은 포맷).
 * code: ErrorCode enum 이름 (양쪽 동기화)
 */
export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: string
  traceId?: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number // seconds
  userId: string
  email: string
  displayName: string | null
}

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  createdAt: string // ISO
}
