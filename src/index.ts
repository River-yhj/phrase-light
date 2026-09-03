import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";

const app = express();

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
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// TODO: 기능별 채팅에서 구현하면서 라우터를 여기에 연결
// app.use("/api/auth", authRouter);
// app.use("/api/words", wordEntryRouter);
// app.use("/api/stories", storyRouter);
// app.use("/api/comments", commentRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`mutho-root api listening on :${port}`);
});
