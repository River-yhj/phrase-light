import bcrypt from "bcrypt";
import type { Request } from "express";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "./prisma.js";

const SALT_ROUNDS = 12;

/** 세션·응답에 실어도 되는 사용자 형태 (비밀번호 해시 제외) */
export type PublicUser = Omit<User, "passwordHash">;

export type AuthProvider = "local" | "google" | "kakao";

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface OAuthProfile {
  provider: Exclude<AuthProvider, "local">;
  providerId: string;
  /** 카카오처럼 이메일을 주지 않는 제공자가 있으므로 항상 선택값이다 */
  email: string | null;
  name: string | null;
}

/**
 * provider + providerId 조합으로 사용자를 식별한다.
 * 이미 있으면 그대로 반환하고, 처음 보는 조합이면 새로 만든다.
 */
export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<User> {
  const { provider, providerId, email, name } = profile;

  const existing = await prisma.user.findUnique({
    where: { provider_providerId: { provider, providerId } },
  });
  if (existing) return existing;

  try {
    return await prisma.user.create({ data: { provider, providerId, email, name } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    // 동시에 같은 소셜 계정으로 두 번 들어온 경우 — 먼저 만들어진 쪽을 쓴다.
    const raced = await prisma.user.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
    if (raced) return raced;

    // 여기까지 왔다면 email이 이미 다른 계정(예: 로컬 가입)에 쓰이고 있다는 뜻이다.
    // 식별자는 어디까지나 provider + providerId이므로, 로그인 자체는 막지 않고
    // email만 비워 둔 채로 생성한다. (계정 연동은 별도 기능으로 다룰 문제)
    return prisma.user.create({ data: { provider, providerId, email: null, name } });
  }
}

/**
 * requireAuth를 통과한 요청에서 로그인 사용자 id를 꺼낸다.
 * requireAuth 없이 호출됐다면 라우터 설정 실수이므로 500으로 드러나게 한다.
 */
export function getUserId(req: Request): string {
  if (!req.isAuthenticated()) {
    throw new Error("getUserId는 requireAuth 미들웨어 뒤에서만 호출해야 합니다.");
  }
  return req.user.id;
}
