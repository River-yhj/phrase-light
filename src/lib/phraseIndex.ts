import { buildPhraseIndex, type PhraseIndex } from "./analyzer.js";
import { prisma } from "./prisma.js";

/**
 * 문장 분석기용 색인 캐시 — 등록된 단어 전체로 만든 색인을 메모리에 두고 재사용한다.
 *
 * 단어는 지워지거나 표제어가 바뀌지 않고 늘어나기만 하므로, (단어 수, 마지막 등록 시각)이 같으면
 * 색인도 같다. 분석할 때마다 이 두 값만 가볍게 확인하고, 달라졌을 때만 다시 만든다.
 * 같은 서버의 등록뿐 아니라 다른 프로세스(시드 스크립트)가 넣은 단어도 이렇게 반영된다.
 */

let cached: { version: string; index: PhraseIndex } | null = null;

export async function getPhraseIndex(): Promise<PhraseIndex> {
  const stats = await prisma.wordEntry.aggregate({ _count: { _all: true }, _max: { createdAt: true } });
  const version = `${stats._count._all}:${stats._max.createdAt?.toISOString() ?? ""}`;
  if (cached?.version === version) return cached.index;

  const entries = await prisma.wordEntry.findMany({ select: { id: true, word: true } });
  const index = buildPhraseIndex(entries);
  cached = { version, index };
  return index;
}
