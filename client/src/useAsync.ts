import { useEffect, useState } from 'react'
import { ApiError } from './api'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'success'; data: T }

type Loader<T> = (signal: AbortSignal) => Promise<T>
type Settled<T> = { load: Loader<T>; result: Exclude<AsyncState<T>, { status: 'loading' }> }

/**
 * 페이지에서 API 하나를 불러오는 공통 훅 — 로딩·에러·성공 상태를 한 가지 모양으로 다룬다.
 * load는 호출한 쪽에서 useCallback으로 감싸 넘긴다 — load가 바뀌면(= 그 의존성이 바뀌면) 다시 불러오고,
 * 이전 요청은 취소(AbortController)해서 늦게 도착한 옛 응답이 화면을 덮어쓰지 않게 한다.
 *
 * "로딩 중"은 state로 따로 들고 있지 않고, 지금의 load에 대한 결과가 아직 없다는 사실에서 렌더링 중에 계산한다.
 * (이펙트 안에서 로딩으로 되돌리는 setState를 하지 않아도 되고, 검색어가 바뀐 순간 이전 결과가 잠깐 보이지도 않는다)
 */
export function useAsync<T>(load: Loader<T>): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    load(controller.signal)
      .then((data) => setSettled({ load, result: { status: 'success', data } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          load,
          result: {
            status: 'error',
            error: error instanceof ApiError ? error : new ApiError(0, '알 수 없는 오류가 발생했습니다.'),
          },
        })
      })

    return () => controller.abort()
  }, [load])

  if (!settled || settled.load !== load) return { status: 'loading' }
  return settled.result
}
