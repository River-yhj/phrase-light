import type { Request, Response } from "express";
import type { IdParams } from "../types/params.js";
import { getUserId } from "../lib/auth.js";
import { isPrismaError, prisma } from "../lib/prisma.js";

/**
 * POST /api/stories/:id/votes — 토글
 * 이미 투표했으면 취소(Vote 삭제 + voteCount -1), 아니면 투표(Vote 생성 + voteCount +1).
 * Vote 행과 voteCount 카운터가 어긋나지 않도록 하나의 트랜잭션으로 묶는다.
 */
export async function toggleVote(req: Request<IdParams>, res: Response): Promise<void> {
  const userId = getUserId(req);
  const storyId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const story = await tx.story.findUnique({ where: { id: storyId }, select: { id: true } });
      if (!story) return null;

      const existing = await tx.vote.findUnique({
        where: { userId_storyId: { userId, storyId } },
        select: { id: true },
      });

      if (existing) {
        await tx.vote.delete({ where: { id: existing.id } });
        const updated = await tx.story.update({
          where: { id: storyId },
          data: { voteCount: { decrement: 1 } },
          select: { voteCount: true },
        });
        return { voted: false, voteCount: updated.voteCount };
      }

      await tx.vote.create({ data: { userId, storyId } });
      const updated = await tx.story.update({
        where: { id: storyId },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      });
      return { voted: true, voteCount: updated.voteCount };
    });

    if (!result) {
      res.status(404).json({ message: "story를 찾을 수 없습니다." });
      return;
    }
    res.json(result);
  } catch (error) {
    // 같은 사용자가 거의 동시에 두 번 누른 경우: 한쪽 트랜잭션이 unique 위반(P2002)이나
    // 이미 지워진 Vote 삭제(P2025)로 실패하며 통째로 롤백된다 — 카운터는 어긋나지 않는다
    if (isPrismaError(error, "P2002") || isPrismaError(error, "P2025")) {
      res.status(409).json({ message: "투표 요청이 겹쳤습니다. 다시 시도해 주세요." });
      return;
    }
    throw error;
  }
}
