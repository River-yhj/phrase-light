import type { NextFunction, Request, Response } from "express";

/**
 * 로그인한 사용자만 통과시킨다.
 * 세션 로그인과 OAuth 로그인이 공존하므로 판정은 req.isAuthenticated()로 통일한다.
 * 이후 소유권 검증 라우터(Story·Comment 수정·삭제)에서 이 미들웨어를 먼저 태운 뒤
 * req.user.id와 리소스의 userId를 비교하면 된다.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({ message: "로그인이 필요합니다." });
}
