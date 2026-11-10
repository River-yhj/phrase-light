import type { Request, Response } from "express";
import { MAX_ANALYZE_TEXT_LENGTH, findPhrases } from "../lib/analyzer.js";
import { readText } from "../lib/body.js";
import { firstDefinition } from "../lib/dictionary.js";
import { getPhraseIndex } from "../lib/phraseIndex.js";
import { prisma } from "../lib/prisma.js";

/**
 * POST /api/analyze { text } — 로그인 없이 쓸 수 있다.
 * 글에서 사전에 등록된 단어·숙어를 찾아 원문 위치와 첫 뜻을 돌려준다 (규칙은 lib/analyzer.ts).
 */
export async function analyzeText(req: Request, res: Response): Promise<void> {
  const parsed = readText(req.body, { field: "text", maxLength: MAX_ANALYZE_TEXT_LENGTH, required: true });
  if (!parsed.ok) {
    res.status(400).json({ message: parsed.message });
    return;
  }

  const matches = findPhrases(parsed.value, await getPhraseIndex());

  // 찾은 단어들의 뜻을 한 번에 가져온다 (단어 수만큼 쿼리하지 않도록)
  const words = await prisma.wordEntry.findMany({
    where: { id: { in: [...new Set(matches.map((match) => match.entryId))] } },
    select: { id: true, definitions: true },
  });
  const definitionById = new Map(words.map((word) => [word.id, firstDefinition(word.definitions)]));

  res.json({
    matches: matches.map(({ entryId, word, matchedText, start, end }) => ({
      wordId: entryId,
      word,
      matchedText,
      start,
      end,
      definition: definitionById.get(entryId) ?? null,
    })),
  });
}
