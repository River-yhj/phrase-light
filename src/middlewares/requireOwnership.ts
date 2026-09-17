import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { IdParams } from "../types/params.js";

/** :id로 리소스를 찾아 작성자 id만 돌려주는 함수. 없으면 null */
type OwnerLoader = (id: string) => Promise<{ userId: string } | null>;

/**
 * 요청자 == 리소스 작성자인지 검증한다. 수정·삭제 라우터에서 requireAuth 다음에 붙인다.
 *   - 리소스가 없으면 404
 *   - 작성자가 아니면 403
 */
export function requireOwnership(loadOwner: OwnerLoader) {
  return async (req: Request<IdParams>, res: Response, next: NextFunction): Promise<void> => {
    // requireAuth를 빠뜨리고 붙였더라도 소유권 검증이 뚫리지 않도록 여기서도 확인한다
    if (!req.isAuthenticated()) {
      res.status(401).json({ message: "로그인이 필요합니다." });
      return;
    }

    const resource = await loadOwner(req.params.id);
    if (!resource) {
      res.status(404).json({ message: "대상을 찾을 수 없습니다." });
      return;
    }
    if (resource.userId !== req.user.id) {
      res.status(403).json({ message: "본인이 작성한 글만 수정·삭제할 수 있습니다." });
      return;
    }
    next();
  };
}

export const requireStoryOwner = requireOwnership((id) =>
  prisma.story.findUnique({ where: { id }, select: { userId: true } })
);

export const requireCommentOwner = requireOwnership((id) =>
  prisma.comment.findUnique({ where: { id }, select: { userId: true } })
);
