import type { ReactNode } from 'react'
import type { ApiError } from '../api'

/** 로딩·에러·빈 결과를 페이지마다 같은 모양으로 보여준다 */

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <p className="status status--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  )
}

export function ErrorMessage({ error, notFound }: { error: ApiError; notFound?: string }) {
  const message = error.status === 404 && notFound ? notFound : error.message
  return (
    <p className="status status--error" role="alert">
      {message}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="status status--empty">{children}</p>
}
