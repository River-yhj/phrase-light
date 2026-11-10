import { useCallback } from 'react'
import { useParams } from 'react-router'
import { getWord, type Definition } from '../api'
import { ErrorMessage, Loading } from '../components/Status'
import { useAsync } from '../useAsync'

const CC_BY_SA_URL = 'https://creativecommons.org/licenses/by-sa/4.0/'

/** Wiktionary 문서 주소 — 백엔드가 사전을 조회할 때와 같은 규칙(공백 → _)으로 만든다 */
function wiktionaryUrl(word: string): string {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word.replace(/ /g, '_'))}`
}

/** 품사별로 묶는다. 품사가 처음 나온 순서와 품사 안의 정의 순서(사전 순서)를 그대로 유지한다 */
function groupByPartOfSpeech(definitions: Definition[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const { partOfSpeech, text } of definitions) {
    const list = groups.get(partOfSpeech)
    if (list) list.push(text)
    else groups.set(partOfSpeech, [text])
  }
  return [...groups.entries()]
}

export default function WordPage() {
  const { id = '' } = useParams()
  const load = useCallback((signal: AbortSignal) => getWord(id, signal), [id])
  const state = useAsync(load)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorMessage error={state.error} notFound="단어를 찾을 수 없습니다." />

  const word = state.data

  return (
    <article>
      <header className="entry">
        <h1 className="entry__word">{word.word}</h1>

        {word.definitions === null ? (
          <p className="entry__missing">사전에서 찾을 수 없는 표현입니다</p>
        ) : (
          <>
            {groupByPartOfSpeech(word.definitions).map(([partOfSpeech, texts]) => (
              <section key={partOfSpeech} className="pos">
                <h2 className="pos__name">{partOfSpeech}</h2>
                <ol className="pos__list">
                  {texts.map((text, index) => (
                    <li key={index}>{text}</li>
                  ))}
                </ol>
              </section>
            ))}
            {/* Wiktionary 본문은 CC BY-SA — 뜻을 보여줄 때 출처와 라이선스를 함께 표시해야 한다 (decision-log) */}
            <p className="entry__source">
              출처:{' '}
              <a href={wiktionaryUrl(word.word)} target="_blank" rel="noreferrer">
                Wiktionary
              </a>{' '}
              (
              <a href={CC_BY_SA_URL} target="_blank" rel="noreferrer license">
                CC BY-SA
              </a>
              )
            </p>
          </>
        )}
      </header>
    </article>
  )
}
