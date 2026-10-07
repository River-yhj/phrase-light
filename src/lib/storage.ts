import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import multer from "multer";

/**
 * 이미지 저장소 — 업로드·삭제 로직을 이 파일 한 곳에 모은다.
 * 지금은 로컬 디스크(uploads/)에 저장하지만, 나중에 Supabase Storage 등으로 바꿀 때
 * 이 파일만 교체하면 되도록 컨트롤러는 아래 export만 사용한다.
 *   - imageUpload            : 요청에서 image 필드 1개를 받아 저장하는 미들웨어
 *   - getUploadedImageUrl    : 방금 저장된 파일의 공개 URL (DB에 저장할 값)
 *   - deleteImage            : 공개 URL로 파일 삭제 (실패해도 예외를 던지지 않음)
 */

export const UPLOAD_DIR = path.resolve("uploads");
export const UPLOAD_URL_PREFIX = "/uploads/";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 저장 확장자는 원본 파일명이 아니라 검증된 MIME 타입에서 정한다
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

mkdirSync(UPLOAD_DIR, { recursive: true });

/** 허용되지 않은 파일 형식 — 공용 에러 미들웨어에서 400으로 변환한다 */
export class UnsupportedImageTypeError extends Error {
  constructor(mimetype: string) {
    super(`허용되지 않은 이미지 형식입니다: ${mimetype}`);
    this.name = "UnsupportedImageTypeError";
  }
}

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${EXTENSION_BY_MIME[file.mimetype]}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in EXTENSION_BY_MIME) cb(null, true);
    else cb(new UnsupportedImageTypeError(file.mimetype));
  },
}).single("image");

export function getUploadedImageUrl(file: Express.Multer.File | undefined): string | null {
  return file ? `${UPLOAD_URL_PREFIX}${file.filename}` : null;
}

/**
 * 공개 URL("/uploads/<파일명>")에 해당하는 파일을 지운다.
 * 이미 없는 파일 등 삭제 실패는 요청 전체를 실패시키지 않도록 로그만 남긴다.
 */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith(UPLOAD_URL_PREFIX)) return;

  // "/uploads/../.env" 같은 값이 DB에 들어 있더라도 uploads/ 밖은 절대 건드리지 않는다
  const filename = path.basename(url.slice(UPLOAD_URL_PREFIX.length));
  if (!filename || filename !== url.slice(UPLOAD_URL_PREFIX.length)) {
    console.warn(`[storage] 잘못된 이미지 경로라 삭제하지 않음: ${url}`);
    return;
  }

  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch (error) {
    console.warn(`[storage] 이미지 삭제 실패 (${url}):`, error instanceof Error ? error.message : error);
  }
}
