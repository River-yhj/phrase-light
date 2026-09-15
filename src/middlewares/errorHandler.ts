import type { NextFunction, Request, Response } from "express";

/**
 * Express 5는 비동기 핸들러에서 난 에러도 여기까지 알아서 전달해 준다.
 * 라우터 등록이 모두 끝난 뒤 마지막에 붙여야 한다.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error("[error]", error);
  res.status(500).json({ message: "서버 오류가 발생했습니다." });
}
