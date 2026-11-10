import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { MAX_ANALYZE_TEXT_LENGTH, findPhrases } from "../lib/analyzer.js";
import { getUserId } from "../lib/auth.js";
import { readText, readTrimmedString } from "../lib/body.js";
import { firstDefinition } from "../lib/dictionary.js";
import { getPhraseIndex } from "../lib/phraseIndex.js";
import { prisma } from "../lib/prisma.js";
import { deleteImage, getUploadedImageUrl } from "../lib/storage.js";

const MAX_TITLE_LENGTH = 100;
const LIST_LIMIT = 50;
const PREVIEW_LENGTH = 120;

/** 노트 상세 응답에 싣는 찾은 표현 — 원문 순서대로 */
const noteDetailInclude = {
  matches: {
    orderBy: { start: "asc" },
    select: {
      id: true,
      matchedText: true,
      start: true,
      end: true,
      wordEntry: { select: { id: true, word: true, definitions: true } },
    },
  },
} satisfies Prisma.NoteInclude;

type NoteWithMatches = Prisma.NoteGetPayload<{ include: typeof noteDetailInclude }>;

/** 응답 모양: 찾은 표현마다 단어 id·표제어·첫 뜻을 펼쳐서 준다 */
function toNoteDetail(note: NoteWithMatches) {
  const { matches, ...rest } = note;
  return {
    ...rest,
    matches: matches.map(({ id, matchedText, start, end, wordEntry }) => ({
      id,
      wordId: wordEntry.id,
      word: wordEntry.word,
      matchedText,
      start,
      end,
      definition: firstDefinition(wordEntry.definitions),
    })),
  };
}

/** 원문을 분석해 NoteMatch로 저장할 행을 만든다 (규칙은 lib/analyzer.ts) */
async function analyzeForNote(text: string): Promise<Prisma.NoteMatchCreateManyNoteInput[]> {
  const matches = findPhrases(text, await getPhraseIndex());
  return matches.map(({ entryId, matchedText, start, end }) => ({ wordEntryId: entryId, matchedText, start, end }));
}

const titleRule = { field: "title", maxLength: MAX_TITLE_LENGTH, multiline: false } as const;
const textRule = { field: "text", maxLength: MAX_ANALYZE_TEXT_LENGTH } as const;

/** multipart에서는 문자열 "true", JSON에서는 boolean true로 올 수 있다 */
function readRemoveImage(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const value = (body as Record<string, unknown>).removeImage;
  return value === true || value === "true";
}

/**
 * POST /api/notes — multipart/form-data (title, text + 선택적 image)
 * 미들웨어 순서: requireAuth → imageUpload → createNote
 */
export async function createNote(req: Request, res: Response): Promise<void> {
  const imageUrl = getUploadedImageUrl(req.file);
  let saved = false;

  try {
    const title = readText(req.body, { ...titleRule, required: true });
    if (!title.ok) {
      res.status(400).json({ message: title.message });
      return;
    }
    const text = readText(req.body, { ...textRule, required: true });
    if (!text.ok) {
      res.status(400).json({ message: text.message });
      return;
    }

    const matches = await analyzeForNote(text.value);
    const note = await prisma.note.create({
      data: {
        title: title.value,
        text: text.value,
        sourceImageUrl: imageUrl,
        userId: getUserId(req),
        matches: { createMany: { data: matches } },
      },
      include: noteDetailInclude,
    });
    saved = true;
    res.status(201).json({ note: toNoteDetail(note) });
  } finally {
    // 검증 실패·DB 저장 실패 등으로 노트가 만들어지지 않았다면
    // 방금 저장한 파일은 어디서도 참조하지 않는 고아 파일이 되므로 지운다
    if (!saved) await deleteImage(imageUrl);
  }
}

/** GET /api/notes?q=제목검색어 — 내 노트만, 최근 수정순. 원문은 앞부분 미리보기만 준다 */
export async function listNotes(req: Request, res: Response): Promise<void> {
  const q = readTrimmedString(req.query, "q");
  const notes = await prisma.note.findMany({
    where: {
      userId: getUserId(req),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      title: true,
      text: true,
      sourceImageUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { matches: true } },
    },
  });

  res.json({
    notes: notes.map(({ text, _count, ...rest }) => ({
      ...rest,
      preview: [...text].length > PREVIEW_LENGTH ? `${[...text].slice(0, PREVIEW_LENGTH).join("")}…` : text,
      matchCount: _count.matches,
    })),
  });
}

/**
 * GET /api/notes/:id — 원문 + 찾은 표현(원문 순서)
 * 미들웨어 순서: requireAuth → requireNoteOwner(남의 노트는 404) → getNote
 */
export async function getNote(req: Request<IdParams>, res: Response): Promise<void> {
  const note = await prisma.note.findUnique({ where: { id: req.params.id }, include: noteDetailInclude });
  if (!note) {
    res.status(404).json({ message: "노트를 찾을 수 없습니다." });
    return;
  }
  res.json({ note: toNoteDetail(note) });
}

/**
 * PATCH /api/notes/:id — multipart/form-data (title·text·image·removeImage 모두 선택)
 * 미들웨어 순서: requireAuth → requireNoteOwner → imageUpload → updateNote
 * (소유권 확인을 multer보다 먼저 해서, 남의 노트면 파일이 디스크에 아예 쓰이지 않게 한다)
 * 원문(text)을 보내면 문장 분석기로 찾은 표현을 새 원문 기준으로 다시 만든다.
 */
export async function updateNote(req: Request<IdParams>, res: Response): Promise<void> {
  const newImageUrl = getUploadedImageUrl(req.file);
  let saved = false;

  try {
    const title = readText(req.body, { ...titleRule, required: false });
    if (!title.ok) {
      res.status(400).json({ message: title.message });
      return;
    }
    const text = readText(req.body, { ...textRule, required: false });
    if (!text.ok) {
      res.status(400).json({ message: text.message });
      return;
    }
    const removeImage = readRemoveImage(req.body);
    if (newImageUrl && removeImage) {
      res.status(400).json({ message: "image와 removeImage=true를 함께 보낼 수 없습니다." });
      return;
    }
    if (title.value === null && text.value === null && !newImageUrl && !removeImage) {
      res.status(400).json({ message: "수정할 내용(title, text, image, removeImage)이 없습니다." });
      return;
    }

    const current = await prisma.note.findUnique({
      where: { id: req.params.id },
      select: { sourceImageUrl: true },
    });
    if (!current) {
      res.status(404).json({ message: "노트를 찾을 수 없습니다." });
      return;
    }

    const data: Prisma.NoteUpdateInput = {};
    if (title.value !== null) data.title = title.value;
    if (text.value !== null) {
      data.text = text.value;
      // 한 번의 update 안에서 기존 표현을 지우고 새로 만든다 (Prisma가 중첩 쓰기를 한 트랜잭션으로 처리)
      data.matches = { deleteMany: {}, createMany: { data: await analyzeForNote(text.value) } };
    }
    if (newImageUrl) data.sourceImageUrl = newImageUrl;
    else if (removeImage) data.sourceImageUrl = null;

    const note = await prisma.note.update({
      where: { id: req.params.id },
      data,
      include: noteDetailInclude,
    });
    saved = true;

    // DB가 새 값으로 바뀐 뒤에 이전 파일을 지운다
    // (순서가 반대면 DB 갱신 실패 시 노트가 사라진 파일을 가리키게 된다)
    if (current.sourceImageUrl && current.sourceImageUrl !== note.sourceImageUrl) {
      await deleteImage(current.sourceImageUrl);
    }
    res.json({ note: toNoteDetail(note) });
  } finally {
    if (!saved) await deleteImage(newImageUrl);
  }
}

/**
 * DELETE /api/notes/:id
 * 찾은 표현은 DB의 onDelete: Cascade로, 출처 사진 파일은 DB 삭제가 끝난 뒤 지운다.
 */
export async function deleteNote(req: Request<IdParams>, res: Response): Promise<void> {
  const deleted = await prisma.note.delete({
    where: { id: req.params.id },
    select: { sourceImageUrl: true },
  });
  await deleteImage(deleted.sourceImageUrl);
  res.status(204).end();
}
