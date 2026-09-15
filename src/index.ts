import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./lib/passport.js";
import { authRouter } from "./routes/auth.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev-secret",
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

// TODO: 기능별 채팅에서 구현하면서 라우터를 여기에 연결
// app.use("/api/words", wordEntryRouter);
// app.use("/api/stories", storyRouter);
// app.use("/api/comments", commentRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`mutho-root api listening on :${port}`);
});
