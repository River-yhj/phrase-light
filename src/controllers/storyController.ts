import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { getUserId } from "../lib/auth.js";
import { readContent } from "../lib/body.js";
import { authorSelect, prisma } from "../lib/prisma.js";
import { deleteImage, getUploadedImageUrl } from "../lib/storage.js";

const MAX_STORY_LENGTH = 10_000;

/** multipart에서는 문자열 "true", JSON에서는 boolean true로 올 수 있다 */
function readRemoveImage(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const value = (body as Record<string, unknown>).removeImage;
  return value === true || value === "true";
}

/**
 * POST /api/words/:id/stories — multipart/form-data (content + 선택적 image)
 * 미들웨어 순서: requireAuth → imageUpload → createStory
 */
export async function createStory(req: Request<IdParams>, res: Response): Promise<void> {
  const imageUrl = getUploadedImageUrl(req.file);
  let saved = false;

  try {
    const parsed = readContent(req.body, { maxLength: MAX_STORY_LENGTH, required: true });
    if (!parsed.ok) {
      res.status(400).json({ message: parsed.message });
      return;
    }
    const content = parsed.content;

    const wordEntry = await prisma.wordEntry.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!wordEntry) {
      res.status(404).json({ message: "단어를 찾을 수 없습니다." });
      return;
    }

    const story = await prisma.story.create({
      data: { content, imageUrl, wordEntryId: wordEntry.id, userId: getUserId(req) },
      include: { user: { select: authorSelect } },
    });
    saved = true;
    res.status(201).json({ story });
  } finally {
    // 검증 실패·단어 없음·DB 저장 실패 등으로 story가 만들어지지 않았다면
    // 방금 저장한 파일은 어디서도 참조하지 않는 고아 파일이 되므로 지운다
    if (!saved) await deleteImage(imageUrl);
  }
}

/**
 * PATCH /api/stories/:id — multipart/form-data (content·image·removeImage 모두 선택)
 * 미들웨어 순서: requireAuth → requireStoryOwner → imageUpload → updateStory
 * (소유권 확인을 multer보다 먼저 해서, 403이면 파일이 디스크에 아예 쓰이지 않게 한다)
 */
export async function updateStory(req: Request<IdParams>, res: Response): Promise<void> {
  const newImageUrl = getUploadedImageUrl(req.file);
  let saved = false;

  try {
    const parsed = readContent(req.body, { maxLength: MAX_STORY_LENGTH, required: false });
    if (!parsed.ok) {
      res.status(400).json({ message: parsed.message });
      return;
    }
    const content = parsed.content;
    const removeImage = readRemoveImage(req.body);
    if (newImageUrl && removeImage) {
      res.status(400).json({ message: "image와 removeImage=true를 함께 보낼 수 없습니다." });
      return;
    }
    if (!content && !newImageUrl && !removeImage) {
      res.status(400).json({ message: "수정할 내용(content, image, removeImage)이 없습니다." });
      return;
    }

    const current = await prisma.story.findUnique({
      where: { id: req.params.id },
      select: { imageUrl: true },
    });
    if (!current) {
      res.status(404).json({ message: "story를 찾을 수 없습니다." });
      return;
    }

    const data: Prisma.StoryUpdateInput = {};
    if (content) data.content = content;
    if (newImageUrl) data.imageUrl = newImageUrl;
    else if (removeImage) data.imageUrl = null;

    const story = await prisma.story.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: authorSelect } },
    });
    saved = true;

    // DB가 새 값으로 바뀐 뒤에 이전 파일을 지운다
    // (순서가 반대면 DB 갱신 실패 시 story가 사라진 파일을 가리키게 된다)
    if (current.imageUrl && current.imageUrl !== story.imageUrl) {
      await deleteImage(current.imageUrl);
    }
    res.json({ story });
  } finally {
    if (!saved) await deleteImage(newImageUrl);
  }
}

/**
 * DELETE /api/stories/:id
 * 달린 댓글·투표는 DB의 onDelete: Cascade로, 이미지 파일은 DB 삭제가 끝난 뒤 지운다.
 */
export async function deleteStory(req: Request<IdParams>, res: Response): Promise<void> {
  const deleted = await prisma.story.delete({
    where: { id: req.params.id },
    select: { imageUrl: true },
  });
  await deleteImage(deleted.imageUrl);
  res.status(204).end();
}
