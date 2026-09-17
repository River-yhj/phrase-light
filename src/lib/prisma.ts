import { Prisma, PrismaClient } from "@prisma/client";

// 개발 중 hot-reload로 인해 커넥션이 중복 생성되는 걸 막기 위한 싱글턴 패턴
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/**
 * Prisma 에러 코드 판별
 *   - P2002: unique 제약 위반
 *   - P2025: 수정·삭제 대상 레코드가 없음
 */
export function isPrismaError(error: unknown, code: "P2002" | "P2025"): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** 다른 사용자에게 보여줄 작성자 정보 — email 등 개인정보는 응답에 싣지 않는다 */
export const authorSelect = { id: true, name: true } satisfies Prisma.UserSelect;
