import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { getUserId } from "../lib/auth.js";
import { readTrimmedString } from "../lib/body.js";
import { authorSelect, prisma } from "../lib/prisma.js";

const MAX_COMMENT_LENGTH = 2_000;

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: { user: { select: typeof authorSelect } };
}>;
type CommentNode = CommentWithAuthor & { replies: CommentNode[] };

/**
 * 평평한 댓글 목록을 parentId 기준 트리로 조립한다 (깊이 제한 없음).
 * 입력이 createdAt 오름차순이면 각 레벨의 replies도 그 순서를 유지한다.
 */
function buildThread(comments: CommentWithAuthor[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const comment of comments) nodes.set(comment.id, { ...comment, replies: [] });

  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

function readContent(body: unknown, res: Response): string | null {
  const content = readTrimmedString(body, "content");
  if (!content) {
    res.status(400).json({ message: "content가 필요합니다." });
    return null;
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    res.status(400).json({ message: `content는 ${MAX_COMMENT_LENGTH}자 이하여야 합니다.` });
    return null;
  }
  return content;
}

/** GET /api/stories/:id/comments — 스레드(트리) 구조로 반환 */
export async function listComments(req: Request<IdParams>, res: Response): Promise<void> {
  const story = await prisma.story.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!story) {
    res.status(404).json({ message: "story를 찾을 수 없습니다." });
    return;
  }

  // 한 번의 쿼리로 전부 가져와 메모리에서 트리를 만든다 (깊이만큼 쿼리하지 않기 위해)
  const comments = await prisma.comment.findMany({
    where: { storyId: story.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: authorSelect } },
  });
  res.json({ comments: buildThread(comments) });
}

/** POST /api/stories/:id/comments — body.parentId가 있으면 대댓글 */
export async function createComment(req: Request<IdParams>, res: Response): Promise<void> {
  const content = readContent(req.body, res);
  if (content === null) return;

  const storyId = req.params.id;
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true } });
  if (!story) {
    res.status(404).json({ message: "story를 찾을 수 없습니다." });
    return;
  }

  const parentId = readTrimmedString(req.body, "parentId");
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { storyId: true },
    });
    // 다른 story의 댓글에 대댓글을 다는 것을 막는다
    if (!parent || parent.storyId !== storyId) {
      res.status(400).json({ message: "parentId가 이 story의 댓글이 아닙니다." });
      return;
    }
  }

  const comment = await prisma.comment.create({
    data: { content, storyId, parentId, userId: getUserId(req) },
    include: { user: { select: authorSelect } },
  });
  res.status(201).json({ comment });
}

/** PATCH /api/comments/:id — requireCommentOwner 통과 후 호출된다 */
export async function updateComment(req: Request<IdParams>, res: Response): Promise<void> {
  const content = readContent(req.body, res);
  if (content === null) return;

  const comment = await prisma.comment.update({
    where: { id: req.params.id },
    data: { content },
    include: { user: { select: authorSelect } },
  });
  res.json({ comment });
}

/** DELETE /api/comments/:id — 대댓글 스레드는 onDelete: Cascade로 함께 지워진다 */
export async function deleteComment(req: Request<IdParams>, res: Response): Promise<void> {
  await prisma.comment.delete({ where: { id: req.params.id } });
  res.status(204).end();
}
