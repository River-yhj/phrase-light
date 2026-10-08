import { useCallback } from 'react'
import { getComments, type Comment } from '../api'
import { useAsync } from '../useAsync'
import { Empty, ErrorMessage, Loading } from './Status'

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' })

/** story 하나의 댓글 스레드 — 펼칠 때 처음 불러온다 (읽기 전용) */
export default function CommentThread({ storyId }: { storyId: string }) {
  const load = useCallback((signal: AbortSignal) => getComments(storyId, signal), [storyId])
  const state = useAsync(load)

  if (state.status === 'loading') return <Loading label="댓글 불러오는 중…" />
  if (state.status === 'error') return <ErrorMessage error={state.error} />
  if (state.data.length === 0) return <Empty>아직 댓글이 없습니다.</Empty>
  return <CommentList comments={state.data} />
}

/** 대댓글은 재귀로 한 단계씩 들여쓴다 */
function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <ul className="comments">
      {comments.map((comment) => (
        <li key={comment.id}>
          <div className="comment">
            <p className="comment__meta">
              <span className="comment__author">{comment.user.name ?? '이름 없음'}</span>
              <time dateTime={comment.createdAt}>{dateFormat.format(new Date(comment.createdAt))}</time>
            </p>
            <p className="comment__content">{comment.content}</p>
          </div>
          {comment.replies.length > 0 && <CommentList comments={comment.replies} />}
        </li>
      ))}
    </ul>
  )
}
