import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { IdParams } from "../types/params.js";

/** :id로 리소스를 찾아 작성자 id만 돌려주는 함수. 없으면 null */
type OwnerLoader = (id: string) => Promise<{ userId: string } | null>;

type OwnershipOptions = {
  /** 리소스가 없을 때(그리고 hideFromOthers면 남의 리소스일 때)의 응답 문구 */
  notFoundMessage: string;
  /**
   * true면 남의 리소스도 403 대신 404로 응답해 존재 여부까지 숨긴다.
   * 작성자만 볼 수 있는 리소스(분석 노트)에 쓴다.
   */
  hideFromOthers: boolean;
};

/**
 * 요청자 == 리소스 작성자인지 검증한다. 조회·수정·삭제 라우터에서 requireAuth 다음에 붙인다.
 *   - 리소스가 없으면 404
 *   - 작성자가 아니면 403 (hideFromOthers면 404)
 */
export function requireOwnership(loadOwner: OwnerLoader, options: OwnershipOptions) {
  return async (req: Request<IdParams>, res: Response, next: NextFunction): Promise<void> => {
    // requireAuth를 빠뜨리고 붙였더라도 소유권 검증이 뚫리지 않도록 여기서도 확인한다
    if (!req.isAuthenticated()) {
      res.status(401).json({ message: "로그인이 필요합니다." });
      return;
    }

    const resource = await loadOwner(req.params.id);
    const isOwner = resource !== null && resource.userId === req.user.id;
    if (!resource || (!isOwner && options.hideFromOthers)) {
      res.status(404).json({ message: options.notFoundMessage });
      return;
    }
    if (!isOwner) {
      res.status(403).json({ message: "본인이 작성한 글만 수정·삭제할 수 있습니다." });
      return;
    }
    next();
  };
}

/** 분석 노트는 작성자만 볼 수 있으므로, 남의 노트는 있어도 없는 것처럼 404로 응답한다 */
export const requireNoteOwner = requireOwnership(
  (id) => prisma.note.findUnique({ where: { id }, select: { userId: true } }),
  { notFoundMessage: "노트를 찾을 수 없습니다.", hideFromOthers: true }
);
