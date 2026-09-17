import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { getUserId } from "../lib/auth.js";
import { readTrimmedString } from "../lib/body.js";
import { authorSelect, prisma } from "../lib/prisma.js";

const MAX_STORY_LENGTH = 10_000;

function readContent(body: unknown, res: Response): string | null {
  const content = readTrimmedString(body, "content");
  if (!content) {
    res.status(400).json({ message: "content가 필요합니다." });
    return null;
  }
  if (content.length > MAX_STORY_LENGTH) {
    res.status(400).json({ message: `content는 ${MAX_STORY_LENGTH}자 이하여야 합니다.` });
    return null;
  }
  return content;
}

/** POST /api/words/:id/stories */
export async function createStory(req: Request<IdParams>, res: Response): Promise<void> {
  const content = readContent(req.body, res);
  if (content === null) return;

  const wordEntry = await prisma.wordEntry.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!wordEntry) {
    res.status(404).json({ message: "단어를 찾을 수 없습니다." });
    return;
  }

  const story = await prisma.story.create({
    data: { content, wordEntryId: wordEntry.id, userId: getUserId(req) },
    include: { user: { select: authorSelect } },
  });
  res.status(201).json({ story });
}

/** PATCH /api/stories/:id — requireStoryOwner 통과 후 호출된다 */
export async function updateStory(req: Request<IdParams>, res: Response): Promise<void> {
  const content = readContent(req.body, res);
  if (content === null) return;

  const story = await prisma.story.update({
    where: { id: req.params.id },
    data: { content },
    include: { user: { select: authorSelect } },
  });
  res.json({ story });
}

/** DELETE /api/stories/:id — 달린 댓글·투표는 DB의 onDelete: Cascade로 함께 지워진다 */
export async function deleteStory(req: Request<IdParams>, res: Response): Promise<void> {
  await prisma.story.delete({ where: { id: req.params.id } });
  res.status(204).end();
}
