import { PrismaClient } from "@prisma/client";

// 개발 중 hot-reload로 인해 커넥션이 중복 생성되는 걸 막기 위한 싱글턴 패턴
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
