import type { PublicUser } from "../lib/auth.js";

// passport가 선언한 비어 있는 Express.User 인터페이스에,
// 이 프로젝트에서 실제로 세션에 실리는 사용자 형태를 병합한다.
// (passwordHash가 빠진 형태 — lib/auth.ts의 toPublicUser 참고)
declare global {
  namespace Express {
    interface User extends PublicUser {}
  }
}

export {};
