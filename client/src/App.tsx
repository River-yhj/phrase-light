import { useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router'
import { displayName, loginPath, useAuth } from './auth/authContext'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import WordPage from './pages/WordPage'

export default function App() {
  return (
    <div className="layout">
      <header className="site-header">
        <Link to="/" className="brand">
          MuthoRoot
        </Link>
        <span className="tagline">단어에 얽힌 이야기</span>
        <AuthNav />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/words/:id" element={<WordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* 모든 페이지 하단에 노출하는 디스클레이머 (decision-log: 서비스 컨셉) */}
      <footer className="site-footer">
        여기 실린 이야기는 검증된 학술 정보가 아니라 커뮤니티가 함께 만들어가는 설(說)입니다.
      </footer>
    </div>
  )
}

/** 헤더 오른쪽 — 비로그인이면 "로그인", 로그인이면 이름과 "로그아웃" */
function AuthNav() {
  const { status, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  // 로그인 여부를 확인하는 동안은 버튼을 그리지 않는다 (로그인 → 이름으로 깜빡이며 바뀌는 것 방지)
  if (status === 'checking') return <div className="auth-nav" aria-hidden="true" />

  if (!user) {
    return (
      <div className="auth-nav">
        <Link to={loginPath(location.pathname + location.search)} className="button button--small">
          로그인
        </Link>
      </div>
    )
  }

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    setLoggingOut(false)
    navigate('/')
  }

  return (
    <div className="auth-nav">
      <span className="auth-nav__name">{displayName(user)}</span>
      <button type="button" className="button button--small button--ghost" onClick={handleLogout} disabled={loggingOut}>
        로그아웃
      </button>
    </div>
  )
}
