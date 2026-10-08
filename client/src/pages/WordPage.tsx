import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import { getWord, imageSrc, type Definition, type Story } from '../api'
import CommentThread from '../components/CommentThread'
import { Empty, ErrorMessage, Loading } from '../components/Status'
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

/** 백엔드가 이미 voteCount 내림차순으로 주지만, 화면 요구사항이라 한 번 더 보장한다 (안정 정렬이라 동률 순서는 유지) */
function byVotes(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => b.voteCount - a.voteCount)
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' })

export default function WordPage() {
  const { id = '' } = useParams()
  const load = useCallback((signal: AbortSignal) => getWord(id, signal), [id])
  const state = useAsync(load)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorMessage error={state.error} notFound="단어를 찾을 수 없습니다." />

  const word = state.data
  const stories = byVotes(word.stories)

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

      <section>
        <h2 className="section-title">이야기 {stories.length}개</h2>
        {stories.length === 0 ? (
          <Empty>아직 이 단어에 얽힌 이야기가 없습니다.</Empty>
        ) : (
          <ol className="story-list">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} word={word.word} />
            ))}
          </ol>
        )}
      </section>
    </article>
  )
}

function StoryCard({ story, word }: { story: Story; word: string }) {
  const [showComments, setShowComments] = useState(false)
  const commentCount = story._count.comments
  const threadId = `comments-${story.id}`

  return (
    <li className="story">
      {story.imageUrl && (
        <img className="story__thumb" src={imageSrc(story.imageUrl)} alt={`${word} 이야기 첨부 이미지`} loading="lazy" />
      )}
      <div className="story__body">
        <p className="story__content">{story.content}</p>
        <p className="story__meta">
          <span>{story.user.name ?? '이름 없음'}</span>
          <span className="story__votes">추천 {story.voteCount}</span>
          <time dateTime={story.createdAt}>{dateFormat.format(new Date(story.createdAt))}</time>
          {commentCount === 0 ? (
            <span>댓글 0</span>
          ) : (
            <button
              type="button"
              className="link-button"
              aria-expanded={showComments}
              aria-controls={threadId}
              onClick={() => setShowComments((open) => !open)}
            >
              {showComments ? `댓글 ${commentCount}개 접기` : `댓글 ${commentCount}개 보기`}
            </button>
          )}
        </p>
        {/* 펼쳤을 때만 마운트 → 그때 처음 스레드를 불러온다 */}
        {showComments && (
          <div id={threadId} className="story__comments">
            <CommentThread storyId={story.id} />
          </div>
        )}
      </div>
    </li>
  )
}
