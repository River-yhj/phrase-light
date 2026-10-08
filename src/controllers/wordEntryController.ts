import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { getUserId } from "../lib/auth.js";
import { readTrimmedString } from "../lib/body.js";
import { retryFetchDefinitions } from "../lib/dictionary.js";
import { authorSelect, prisma } from "../lib/prisma.js";
import { MAX_WORD_LENGTH, findOrCreateWordEntry, normalizeWord } from "../lib/wordEntries.js";

const SEARCH_LIMIT = 20;

/**
 * POST /api/words — find-or-create (규칙은 lib/wordEntries.ts — 시드 스크립트와 공유)
 * 같은 단어가 이미 있으면 그대로 200으로 돌려주고, 없으면 사전에서 뜻을 채워 201로 생성한다.
 * definitions는 생성 시점에만 채우는 고정값이라 수정 API를 두지 않는다.
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

  const { entry, created } = await findOrCreateWordEntry(word, getUserId(req));
  res.status(created ? 201 : 200).json({ word: entry, created });
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
      definitions: true,
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

  // 등록 당시 사전 조회가 실패해 definitions가 비어 있으면 한 번 더 시도해 채운다.
  // 이미 값이 있는 단어는 절대 다시 조회하거나 덮어쓰지 않는다 (definitions 고정 원칙).
  if (word.definitions === null) {
    const definitions = await retryFetchDefinitions(word.word);
    if (definitions) {
      // 조건부 갱신: 그사이 다른 요청이 먼저 채웠다면 아무것도 바꾸지 않는다
      await prisma.wordEntry.updateMany({
        where: { id: word.id, definitions: { equals: Prisma.DbNull } },
        data: { definitions },
      });
      const current = await prisma.wordEntry.findUnique({
        where: { id: word.id },
        select: { definitions: true },
      });
      word.definitions = current?.definitions ?? null;
    }
  }

  // 로그인 사용자가 각 story에 추천했는지 (비로그인이면 전부 false) — 추천 버튼의 눌림 상태 표시용.
  // story 수만큼 쿼리하지 않도록 이 단어의 story들에 대한 내 투표를 한 번에 가져온다.
  const myVotes = req.isAuthenticated()
    ? await prisma.vote.findMany({
        where: { userId: req.user.id, storyId: { in: word.stories.map((story) => story.id) } },
        select: { storyId: true },
      })
    : [];
  const votedStoryIds = new Set(myVotes.map((vote) => vote.storyId));

  res.json({
    word: {
      ...word,
      stories: word.stories.map((story) => ({ ...story, votedByMe: votedStoryIds.has(story.id) })),
    },
  });
}
