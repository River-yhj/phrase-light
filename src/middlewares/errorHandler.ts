import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { isPrismaError } from "../lib/prisma.js";
import { MAX_IMAGE_BYTES, UnsupportedImageTypeError } from "../lib/storage.js";

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

  // 업로드 에러 — 이미지는 메모리에서 시그니처 검사를 통과한 뒤에만 디스크에 쓰므로
  // 여기로 넘어온 요청에는 정리할 파일이 없다
  if (error instanceof UnsupportedImageTypeError) {
    res.status(400).json({ message: "이미지는 jpeg, png, webp, gif만 업로드할 수 있습니다." });
    return;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: `이미지는 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 이하만 업로드할 수 있습니다.` });
      return;
    }
    // 필드명이 image가 아니거나 파일을 2개 이상 보낸 경우 등
    res.status(400).json({ message: `업로드 요청이 올바르지 않습니다 (${error.code}).` });
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
