import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { ApiError, login, oauthLoginUrl, register } from '../api'
import { safeNextPath, useAuth } from '../auth/authContext'
import { Loading } from '../components/Status'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

type Mode = 'login' | 'register'

/** 서버 응답(400·401·409 등)을 사용자가 이해할 수 있는 문구로 바꾼다 */
function authErrorMessage(error: unknown, mode: Mode): string {
  if (!(error instanceof ApiError)) return '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.'
  if (error.status === 0) return error.message // 서버에 연결할 수 없음
  if (mode === 'login') {
    if (error.status === 401) return '이메일 또는 비밀번호가 올바르지 않습니다.'
    if (error.status === 400) return '이메일과 비밀번호를 모두 입력해 주세요.'
  } else {
    if (error.status === 409) return '이미 가입된 이메일입니다. 로그인 폼에서 로그인해 주세요.'
    if (error.status === 400) {
      if (/password/i.test(error.message)) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
      if (/email/i.test(error.message)) return '올바른 이메일 주소를 입력해 주세요.'
      return '입력한 내용을 다시 확인해 주세요.'
    }
  }
  if (error.status >= 500) return '서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.'
  return error.message
}

/** 서버에 보내기 전에 걸러낼 수 있는 입력 오류 */
function validate(mode: Mode, email: string, password: string): string | null {
  if (!email || !password) return '이메일과 비밀번호를 모두 입력해 주세요.'
  if (mode === 'register') {
    if (!EMAIL_PATTERN.test(email)) return '올바른 이메일 주소를 입력해 주세요.'
    if (password.length < MIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  return null
}

/**
 * /login — 이메일 로그인·회원가입 폼과 소셜 로그인 버튼.
 * 로그인(또는 가입)에 성공하면 ?next= 경로(없으면 홈)로 돌아간다.
 */
export default function LoginPage() {
  const { status, user } = useAuth()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))

  if (status === 'checking') return <Loading label="로그인 상태 확인 중…" />
  // 이미 로그인했거나 방금 로그인에 성공하면 원래 가려던 곳으로 보낸다
  if (user) return <Navigate to={next} replace />

  return (
    <section className="auth-page">
      <h1>로그인</h1>
      <div className="auth-forms">
        <AuthForm mode="login" />
        <AuthForm mode="register" />
      </div>

      <div className="oauth">
        <p className="oauth__divider">또는 소셜 계정으로</p>
        {/* fetch가 아니라 페이지 이동 — 제공자 로그인 후 백엔드가 프론트(OAUTH_SUCCESS_REDIRECT)로 돌려보낸다 */}
        <a className="oauth__button oauth__button--google" href={oauthLoginUrl('google')}>
          Google로 로그인
        </a>
        <a className="oauth__button oauth__button--kakao" href={oauthLoginUrl('kakao')}>
          카카오로 로그인
        </a>
        <p className="oauth__note">소셜 로그인 후에는 홈으로 돌아옵니다.</p>
      </div>
    </section>
  )
}

function AuthForm({ mode }: { mode: Mode }) {
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'
  const idPrefix = `auth-${mode}`

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    const invalid = validate(mode, trimmedEmail, password)
    if (invalid) {
      setError(invalid)
      return
    }

    setPending(true)
    setError(null)
    try {
      const me = isRegister ? await register(trimmedEmail, password, name.trim()) : await login(trimmedEmail, password)
      // 로그인 상태가 바뀌면 LoginPage가 next 경로로 이동시킨다
      setUser(me)
    } catch (caught) {
      setError(authErrorMessage(caught, mode))
      setPending(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-labelledby={`${idPrefix}-title`}>
      <h2 id={`${idPrefix}-title`}>{isRegister ? '이메일로 회원가입' : '이메일로 로그인'}</h2>

      <label htmlFor={`${idPrefix}-email`}>이메일</label>
      <input
        id={`${idPrefix}-email`}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <label htmlFor={`${idPrefix}-password`}>비밀번호{isRegister && ` (${MIN_PASSWORD_LENGTH}자 이상)`}</label>
      <input
        id={`${idPrefix}-password`}
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {isRegister && (
        <>
          <label htmlFor={`${idPrefix}-name`}>이름 (선택 — 글에 표시됩니다)</label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="button" disabled={pending}>
        {pending ? '처리 중…' : isRegister ? '가입하기' : '로그인'}
      </button>
    </form>
  )
}
