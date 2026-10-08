import { useCallback, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { searchWords } from '../api'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { useAsync } from '../useAsync'

/**
 * 홈(/) — 단어 검색.
 * 검색어는 URL(?q=)에 담아서, 상세 페이지에 갔다가 뒤로 가기를 해도 검색 결과가 그대로 남게 한다.
 * 검색어가 없으면 최근 등록된 단어를 보여준다 (백엔드가 q 없이 호출하면 최근순으로 준다).
 */
export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q')?.trim() ?? ''
  const load = useCallback((signal: AbortSignal) => searchWords(q, signal), [q])
  const state = useAsync(load)

  return (
    <section>
      {/* key={q}: 뒤로 가기 등으로 URL의 검색어가 바뀌면 폼을 새로 만들어 입력창도 그 검색어로 맞춘다 */}
      <SearchForm key={q} initial={q} onSearch={(next) => setSearchParams(next ? { q: next } : {})} />

      <h2 className="section-title">{q ? `'${q}' 검색 결과` : '최근 등록된 단어'}</h2>

      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorMessage error={state.error} />}
      {state.status === 'success' &&
        (state.data.length === 0 ? (
          <Empty>{q ? `'${q}'에 대한 검색 결과가 없습니다.` : '아직 등록된 단어가 없습니다.'}</Empty>
        ) : (
          <ul className="word-list">
            {state.data.map((word) => (
              <li key={word.id}>
                <Link to={`/words/${word.id}`} className="word-card">
                  <span className="word-card__word">{word.word}</span>
                  <span className="word-card__preview">
                    {word.definitions?.[0]?.text ?? '사전에서 찾을 수 없는 표현입니다'}
                  </span>
                  <span className="word-card__meta">이야기 {word._count.stories}개</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}

function SearchForm({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [input, setInput] = useState(initial)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(input.trim())
  }

  return (
    <form className="search" role="search" onSubmit={handleSubmit}>
      <label htmlFor="search-input" className="visually-hidden">
        단어 검색
      </label>
      <input
        id="search-input"
        type="search"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="단어나 숙어를 검색하세요 (예: soapbox, kick the bucket)"
        autoComplete="off"
      />
      <button type="submit">검색</button>
    </form>
  )
}
