import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as KakaoStrategy, type Profile as KakaoProfile } from "passport-kakao";
import { findOrCreateOAuthUser, toPublicUser } from "./auth.js";
import { prisma } from "./prisma.js";

/** 세션에는 user.id만 저장한다 */
passport.serializeUser<string>((user, done) => {
  done(null, user.id);
});

passport.deserializeUser<string>(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    // 탈퇴 등으로 사라진 사용자면 false를 넘겨 세션을 무효화한다
    done(null, user ? toPublicUser(user) : false);
  } catch (error) {
    done(error);
  }
});

function readOAuthEnv(prefix: "GOOGLE" | "KAKAO") {
  const clientID = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const callbackURL = process.env[`${prefix}_CALLBACK_URL`];
  if (!clientID || !callbackURL) return null;
  return { clientID, clientSecret, callbackURL };
}

const googleEnv = readOAuthEnv("GOOGLE");
if (googleEnv) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleEnv.clientID,
        clientSecret: googleEnv.clientSecret ?? "",
        callbackURL: googleEnv.callbackURL,
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: "google",
            providerId: profile.id,
            email: profile.emails?.[0]?.value ?? null,
            name: profile.displayName ?? null,
          });
          done(null, toPublicUser(user));
        } catch (error) {
          done(error instanceof Error ? error : new Error(String(error)));
        }
      }
    )
  );
} else {
  console.warn("[auth] GOOGLE_* 환경변수가 없어 Google 로그인을 비활성화합니다.");
}

/**
 * 카카오 응답에서 닉네임을 꺼낸다.
 * passport-kakao의 profile._json은 any라서, 필요한 부분만 좁혀서 읽는다.
 */
export function readKakaoNickname(rawJson: unknown): string | null {
  if (typeof rawJson !== "object" || rawJson === null) return null;
  const account = (rawJson as { kakao_account?: unknown }).kakao_account;
  if (typeof account !== "object" || account === null) return null;
  const kakaoProfile = (account as { profile?: unknown }).profile;
  if (typeof kakaoProfile !== "object" || kakaoProfile === null) return null;
  const nickname = (kakaoProfile as { nickname?: unknown }).nickname;
  return typeof nickname === "string" && nickname.length > 0 ? nickname : null;
}

/** 카카오는 이메일 동의항목이 없을 수 있으므로, 있으면 쓰고 없으면 그냥 비운다 */
export function readKakaoEmail(rawJson: unknown): string | null {
  if (typeof rawJson !== "object" || rawJson === null) return null;
  const account = (rawJson as { kakao_account?: unknown }).kakao_account;
  if (typeof account !== "object" || account === null) return null;
  const email = (account as { email?: unknown }).email;
  return typeof email === "string" && email.length > 0 ? email : null;
}

const kakaoEnv = readOAuthEnv("KAKAO");
if (kakaoEnv) {
  passport.use(
    new KakaoStrategy(
      {
        clientID: kakaoEnv.clientID,
        clientSecret: kakaoEnv.clientSecret,
        callbackURL: kakaoEnv.callbackURL,
      },
      async (_accessToken: string, _refreshToken: string, profile: KakaoProfile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: "kakao",
            providerId: String(profile.id),
            email: readKakaoEmail(profile._json),
            name: readKakaoNickname(profile._json) ?? profile.displayName ?? null,
          });
          done(null, toPublicUser(user));
        } catch (error) {
          done(error instanceof Error ? error : new Error(String(error)));
        }
      }
    )
  );
} else {
  console.warn("[auth] KAKAO_* 환경변수가 없어 Kakao 로그인을 비활성화합니다.");
}

export default passport;
