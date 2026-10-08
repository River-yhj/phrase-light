import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMe, logout as requestLogout, type AuthUser } from '../api'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * 로그인 상태를 앱 전체에 공유한다.
 * 앱이 시작될 때(새로고침·OAuth 로그인 후 돌아왔을 때 포함) GET /api/auth/me로 세션을 확인한다.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('checking')
  const [user, setUserState] = useState<AuthUser | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getMe(controller.signal)
      .then((me) => setUserState(me))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // 서버에 연결할 수 없는 경우 등 — 로그인하지 않은 상태로 시작한다 (화면 자체는 쓸 수 있게)
        console.warn('[auth] 로그인 상태를 확인하지 못했습니다:', error)
        setUserState(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatus('ready')
      })
    return () => controller.abort()
  }, [])

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next)
    setStatus('ready')
  }, [])

  const logout = useCallback(async () => {
    try {
      await requestLogout()
    } catch (error) {
      console.warn('[auth] 로그아웃 요청 실패:', error)
    } finally {
      // 요청 성공 여부와 상관없이 화면은 바로 로그아웃 상태로 비운다
      setUserState(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ status, user, setUser, logout }), [status, user, setUser, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
