import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { getUserId } from "../lib/auth.js";
import { readTrimmedString } from "../lib/body.js";
import { fetchMeaning, retryFetchMeaning } from "../lib/dictionary.js";
import { authorSelect, isPrismaError, prisma } from "../lib/prisma.js";

const MAX_WORD_LENGTH = 100;
const SEARCH_LIMIT = 20;

/** "  Kick   The Bucket " → "kick the bucket" */
function normalizeWord(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * POST /api/words — find-or-create
 * 같은 단어가 이미 있으면 그대로 200으로 돌려주고, 없으면 사전에서 뜻을 채워 201로 생성한다.
 * meaning은 생성 시점에만 채우는 고정값이라 수정 API를 두지 않는다.
 */
export async function createWordEntry(req: Request, res: Response): Promise<void> {
  const raw = readTrimmedString(req.body, "word");
  if (!raw) {
    res.status(400).json({ message: "word가 필요합니다." });
    return;
  }
  const word = normalizeWord(raw);
  if (word.length > MAX_WORD_LENGTH) {
    res.status(400).json({ message: `word는 ${MAX_WORD_LENGTH}자 이하여야 합니다.` });
    return;
  }

  const existing = await prisma.wordEntry.findUnique({ where: { word } });
  if (existing) {
    res.status(200).json({ word: existing, created: false });
    return;
  }

  // 사전 조회가 404·타임아웃 등으로 실패해도 null로 받고 등록은 계속한다
  const meaning = await fetchMeaning(word);

  try {
    const created = await prisma.wordEntry.create({
      data: { word, meaning, userId: getUserId(req) },
    });
    res.status(201).json({ word: created, created: true });
  } catch (error) {
    // 사전 조회를 기다리는 사이 다른 요청이 같은 단어를 먼저 만든 경우 — 그쪽을 반환한다
    if (isPrismaError(error, "P2002")) {
      const raced = await prisma.wordEntry.findUnique({ where: { word } });
      if (raced) {
        res.status(200).json({ word: raced, created: false });
        return;
      }
    }
    throw error;
  }
}

/** GET /api/words?q=검색어 — q가 없으면 최근 등록순 */
export async function searchWordEntries(req: Request, res: Response): Promise<void> {
  const q = readTrimmedString(req.query, "q");

  const words = await prisma.wordEntry.findMany({
    where: q ? { word: { contains: normalizeWord(q) } } : undefined,
    orderBy: q ? { word: "asc" } : { createdAt: "desc" },
    take: SEARCH_LIMIT,
    select: {
      id: true,
      word: true,
      meaning: true,
      createdAt: true,
      _count: { select: { stories: true } },
    },
  });

  res.json({ words });
}

/** GET /api/words/:id — 단어 상세 + stories (voteCount 내림차순) */
export async function getWordEntry(req: Request<IdParams>, res: Response): Promise<void> {
  const word = await prisma.wordEntry.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: authorSelect },
      stories: {
        // 투표수가 같으면 최신 story를 위로
        orderBy: [{ voteCount: "desc" }, { createdAt: "desc" }],
        include: {
          user: { select: authorSelect },
          _count: { select: { comments: true } },
        },
      },
    },
  });

  if (!word) {
    res.status(404).json({ message: "단어를 찾을 수 없습니다." });
    return;
  }

  // 등록 당시 사전 조회가 실패해 meaning이 비어 있으면 한 번 더 시도해 채운다.
  // 이미 값이 있는 단어는 절대 다시 조회하거나 덮어쓰지 않는다 (meaning 고정 원칙).
  if (word.meaning === null) {
    const meaning = await retryFetchMeaning(word.word);
    if (meaning) {
      // 조건부 갱신: 그사이 다른 요청이 먼저 채웠다면 아무것도 바꾸지 않는다
      await prisma.wordEntry.updateMany({
        where: { id: word.id, meaning: null },
        data: { meaning },
      });
      const current = await prisma.wordEntry.findUnique({
        where: { id: word.id },
        select: { meaning: true },
      });
      word.meaning = current?.meaning ?? null;
    }
  }

  res.json({ word });
}
