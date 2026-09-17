import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashPassword, toPublicUser, verifyPassword, type PublicUser } from "../lib/auth.js";
import { readString } from "../lib/body.js";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 세션을 발급하고(req.login) 사용자 정보를 응답한다 */
function establishSession(
  req: Request,
  res: Response,
  next: NextFunction,
  user: User,
  status: number
): void {
  const publicUser: PublicUser = toPublicUser(user);
  // req.login은 콜백 기반이라 에러가 자동으로 에러 미들웨어까지 가지 않는다 — 직접 next로 넘긴다
  req.login(publicUser, (error) => {
    if (error) return next(error);
    res.status(status).json({ user: publicUser });
  });
}

/** POST /api/auth/register — 로컬 가입 (email 필수) */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  const email = readString(req.body, "email")?.trim().toLowerCase() ?? null;
  const password = readString(req.body, "password");
  const name = readString(req.body, "name")?.trim() ?? null;

  if (!email || !EMAIL_PATTERN.test(email)) {
    res.status(400).json({ message: "올바른 email이 필요합니다." });
    return;
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ message: `password는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "이미 가입된 email입니다." });
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      provider: "local",
      name,
    },
  });

  establishSession(req, res, next, user, 201);
}

/** POST /api/auth/login — 로컬 로그인 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  const email = readString(req.body, "email")?.trim().toLowerCase() ?? null;
  const password = readString(req.body, "password");

  if (!email || !password) {
    res.status(400).json({ message: "email과 password가 필요합니다." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // 소셜 가입 계정은 passwordHash가 없다 — 어느 쪽이든 같은 메시지로 응답해
  // 가입 여부가 드러나지 않게 한다
  const isValid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !isValid) {
    res.status(401).json({ message: "email 또는 password가 올바르지 않습니다." });
    return;
  }

  establishSession(req, res, next, user, 200);
}

/** POST /api/auth/logout */
export function logout(req: Request, res: Response, next: NextFunction): void {
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);
    req.session.destroy((destroyError) => {
      if (destroyError) return next(destroyError);
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
}

/** GET /api/auth/me */
export function me(req: Request, res: Response): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: "로그인이 필요합니다." });
    return;
  }
  res.json({ user: req.user });
}

/** OAuth 콜백 성공 후 이동할 곳 (프론트엔드 연동 전에는 /api/auth/me로 보내 확인하기 쉽게 한다) */
export function oauthSuccess(_req: Request, res: Response): void {
  res.redirect(process.env.OAUTH_SUCCESS_REDIRECT ?? "/api/auth/me");
}

/** OAuth 실패 시 */
export function oauthFailure(_req: Request, res: Response): void {
  res.status(401).json({ message: "소셜 로그인에 실패했습니다." });
}
