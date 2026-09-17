import type { NextFunction, Request, Response } from "express";
import { isPrismaError } from "../lib/prisma.js";

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
  // 소유권 확인 직후 다른 요청이 먼저 지운 경우 등 — 대상이 사라졌으면 404
  if (isPrismaError(error, "P2025")) {
    res.status(404).json({ message: "대상을 찾을 수 없습니다." });
    return;
  }
  console.error("[error]", error);
  res.status(500).json({ message: "서버 오류가 발생했습니다." });
}
