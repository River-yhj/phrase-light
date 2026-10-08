import { createContext, useContext } from 'react'
import type { AuthUser } from '../api'

export type AuthContextValue = {
  /** 'checking' = 앱 시작 직후 GET /api/auth/me 응답을 기다리는 중 (아직 로그인 여부를 모름) */
  status: 'checking' | 'ready'
  user: AuthUser | null
  /** 로그인·가입 성공 시 받은 사용자로 바꾸거나, 세션이 끊긴 걸 알았을 때 null로 비운다 */
  setUser: (user: AuthUser | null) => void
  /** 서버 세션을 끝내고 로그인 상태를 비운다 (요청이 실패해도 화면은 로그아웃 상태로 둔다) */
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.')
  return value
}

/** 사용자 표시 이름 — 이메일 가입자는 이름이 없을 수 있다 */
export function displayName(user: AuthUser): string {
  return user.name ?? user.email ?? '사용자'
}

/**
 * 로그인 뒤 돌아갈 경로. 같은 사이트 안의 경로("/..."로 시작)만 허용한다.
 * "//evil.example" 같은 값으로 다른 사이트로 튕겨 나가는 오픈 리디렉션을 막는다.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

/** 로그인 페이지 주소 — 로그인 후 next로 돌아온다 */
export function loginPath(next: string): string {
  return next === '/' || next.startsWith('/login') ? '/login' : `/login?next=${encodeURIComponent(next)}`
}
