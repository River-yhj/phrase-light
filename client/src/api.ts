/**
 * 백엔드 API 호출과 응답 타입을 이 파일 한 곳에 모은다.
 * Vite 프록시 없이 VITE_API_URL(백엔드 주소)로 직접 요청한다 — 백엔드의 CORS 설정이 이 출처를 허용한다.
 */

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

if (!API_URL) {
  console.warn('[api] VITE_API_URL이 설정되지 않았습니다. client/.env.example을 참고해 client/.env를 만들어 주세요.')
}

// ---------- 응답 타입 (백엔드 Prisma 모델 기준) ----------

/** 다른 사용자에게 공개되는 작성자 정보 — 백엔드가 id·name만 내려준다 */
export type Author = {
  id: string
  name: string | null
}

/** WordEntry.definitions의 항목. 사전 순서 유지, 품사별 최대 3개 */
export type Definition = {
  partOfSpeech: string
  text: string
}

/** GET /api/words?q= 목록의 항목 */
export type WordSummary = {
  id: string
  word: string
  /** null = 사전에서 아직 못 가져옴 (사전에 없는 표현일 수 있음) */
  definitions: Definition[] | null
  createdAt: string
  _count: { stories: number }
}

export type Story = {
  id: string
  content: string
  /** "/uploads/<파일명>" 형태의 상대경로. 표시할 때는 imageSrc()로 백엔드 주소를 붙인다 */
  imageUrl: string | null
  voteCount: number
  createdAt: string
  userId: string
  wordEntryId: string
  user: Author
  _count: { comments: number }
}

/** GET /api/words/:id — stories는 voteCount 내림차순(동률이면 최신순) */
export type WordDetail = {
  id: string
  word: string
  definitions: Definition[] | null
  createdAt: string
  userId: string
  user: Author
  stories: Story[]
}

// ---------- 공통 요청 함수 ----------

/** HTTP 에러(4xx·5xx)와 네트워크 에러를 구분할 수 있게 status를 함께 담는다 (네트워크 에러는 0) */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function readMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const message = (body as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      // 세션 쿠키를 주고받기 위해 모든 요청에 포함한다 (다음 단계의 로그인 연동 대비).
      // 백엔드 CORS가 credentials: true + 정확한 origin을 설정해 둬서 이 조합이 허용된다.
      credentials: 'include',
      headers: { Accept: 'application/json', ...init.headers },
    })
  } catch (error) {
    // 요청 취소는 에러로 바꾸지 않고 그대로 던져서 호출한 쪽이 무시할 수 있게 한다
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // CORS 차단도 브라우저에서는 이 경로(TypeError: Failed to fetch)로 들어온다
    throw new ApiError(0, '서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, readMessage(body) ?? `요청에 실패했습니다 (HTTP ${response.status})`)
  }
  return body as T
}

// ---------- 엔드포인트 ----------

/** 단어 검색. q가 비어 있으면 최근 등록된 단어를 돌려준다 (최대 20개) */
export async function searchWords(q: string, signal?: AbortSignal): Promise<WordSummary[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  const data = await request<{ words: WordSummary[] }>(`/api/words${query}`, { signal })
  return data.words
}

export async function getWord(id: string, signal?: AbortSignal): Promise<WordDetail> {
  const data = await request<{ word: WordDetail }>(`/api/words/${encodeURIComponent(id)}`, { signal })
  return data.word
}

/** DB에 저장된 이미지 상대경로("/uploads/...")를 브라우저가 불러올 수 있는 백엔드 절대 주소로 바꾼다 */
export function imageSrc(imageUrl: string): string {
  return `${API_URL}${imageUrl}`
}
