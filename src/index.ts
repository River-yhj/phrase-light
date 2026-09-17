import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./lib/passport.js";
import { authRouter } from "./routes/auth.js";
import { commentRouter } from "./routes/comments.js";
import { storyRouter } from "./routes/stories.js";
import { wordEntryRouter } from "./routes/words.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// .env에 키는 있지만 값이 비어 있는 경우가 있어 ??(null 병합)로는 걸러지지 않는다.
// 빈 문자열까지 미설정으로 보고, 운영 환경에서는 아예 기동을 막는다.
const sessionSecret = process.env.SESSION_SECRET?.trim() || "dev-secret";
if (isProduction && sessionSecret === "dev-secret") {
  throw new Error("운영 환경에서는 SESSION_SECRET을 반드시 설정해야 합니다.");
}

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // OAuth는 제공자 사이트를 거쳐 콜백으로 돌아오므로 lax여야 쿠키가 유지된다
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/words", wordEntryRouter);
app.use("/api/stories", storyRouter);
app.use("/api/comments", commentRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`mutho-root api listening on :${port}`);
});
