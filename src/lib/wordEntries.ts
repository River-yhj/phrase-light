import { Prisma, type WordEntry } from "@prisma/client";
import { fetchDefinitions } from "./dictionary.js";
import { isPrismaError, prisma } from "./prisma.js";

/**
 * 단어 등록 규칙 — API(POST /api/words)와 시드 스크립트(prisma/seed.ts)가 같은 코드를 쓰도록 여기 모은다.
 */

export const MAX_WORD_LENGTH = 100;

/** "  Kick   The Bucket " → "kick the bucket" */
export function normalizeWord(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * find-or-create: 정규화된 같은 단어가 이미 있으면 그대로 돌려주고(created: false),
 * 없으면 사전에서 뜻을 채워 새로 만든다(created: true).
 * definitions는 생성 시점에만 채우는 고정값이며, 사전 조회가 실패해도 등록은 막지 않는다 (DB NULL).
 * word는 normalizeWord를 거친 값이어야 한다.
 */
export async function findOrCreateWordEntry(
  word: string,
  userId: string
): Promise<{ entry: WordEntry; created: boolean }> {
  const existing = await prisma.wordEntry.findUnique({ where: { word } });
  if (existing) return { entry: existing, created: false };

  // 사전 조회가 404·타임아웃 등으로 실패해도 null로 받고 등록은 계속한다
  const definitions = await fetchDefinitions(word);

  try {
    const entry = await prisma.wordEntry.create({
      // Json 컬럼에 DB NULL을 넣으려면 null 대신 Prisma.DbNull을 써야 한다
      data: { word, definitions: definitions ?? Prisma.DbNull, userId },
    });
    return { entry, created: true };
  } catch (error) {
    // 사전 조회를 기다리는 사이 다른 요청이 같은 단어를 먼저 만든 경우 — 그쪽을 반환한다
    if (isPrismaError(error, "P2002")) {
      const raced = await prisma.wordEntry.findUnique({ where: { word } });
      if (raced) return { entry: raced, created: false };
    }
    throw error;
  }
}
