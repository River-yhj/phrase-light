import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

/**
 * 이미지 저장소 — 업로드·삭제 로직을 이 파일 한 곳에 모은다.
 * 지금은 로컬 디스크(uploads/)에 저장하지만, 나중에 Supabase Storage 등으로 바꿀 때
 * 이 파일만 교체하면 되도록 컨트롤러는 아래 export만 사용한다.
 *   - imageUpload            : 요청에서 image 필드 1개를 받아 검사 후 저장하는 미들웨어
 *   - getUploadedImageUrl    : 방금 저장된 파일의 공개 URL (DB에 저장할 값)
 *   - deleteImage            : 공개 URL로 파일 삭제 (실패해도 예외를 던지지 않음)
 */

export const UPLOAD_DIR = path.resolve("uploads");
export const UPLOAD_URL_PREFIX = "/uploads/";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 클라이언트가 보낸 MIME은 1차 필터로만 쓴다 (위조 가능 — 최종 판정은 아래 시그니처 검사)
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);
const ascii = (text: string): number[] => [...text].map((ch) => ch.charCodeAt(0));

/**
 * 파일 앞부분 시그니처(매직 바이트)로 실제 이미지 형식을 판별해 저장 확장자를 돌려준다.
 * jpeg/png/webp/gif가 아니면 null.
 */
export function detectImageExtension(buffer: Buffer): string | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return ".jpg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ".png";
  if (startsWith(buffer, ascii("GIF87a")) || startsWith(buffer, ascii("GIF89a"))) return ".gif";
  if (startsWith(buffer, ascii("RIFF")) && startsWith(buffer, ascii("WEBP"), 8)) return ".webp";
  return null;
}

mkdirSync(UPLOAD_DIR, { recursive: true });

/** 허용되지 않은 파일 형식 — 공용 에러 미들웨어에서 400으로 변환한다 */
export class UnsupportedImageTypeError extends Error {
  constructor(detail: string) {
    super(`허용되지 않은 이미지 형식입니다: ${detail}`);
    this.name = "UnsupportedImageTypeError";
  }
}

// 메모리에 받아(최대 5MB) 시그니처를 확인한 뒤에만 디스크에 쓴다.
// 위조 파일은 디스크에 한 번도 쓰이지 않으므로 지울 파일 자체가 생기지 않는다.
const parseImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new UnsupportedImageTypeError(file.mimetype));
  },
}).single("image");

/** 시그니처 검사를 통과한 파일만 randomUUID + (시그니처 기준) 확장자로 저장한다 */
async function saveImageFile(file: Express.Multer.File): Promise<void> {
  const extension = detectImageExtension(file.buffer);
  if (!extension) {
    throw new UnsupportedImageTypeError(`시그니처 불일치 (클라이언트 MIME: ${file.mimetype})`);
  }
  const filename = `${randomUUID()}${extension}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await writeFile(filePath, file.buffer, { flag: "wx" });
  file.filename = filename;
  file.path = filePath;
}

export function imageUpload(req: Request, res: Response, next: NextFunction): void {
  parseImage(req, res, (error: unknown) => {
    if (error) return next(error);
    if (!req.file) return next();
    saveImageFile(req.file).then(() => next(), next);
  });
}

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
