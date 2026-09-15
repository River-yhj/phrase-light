import { Router } from "express";
import passport from "../lib/passport.js";
import {
  login,
  logout,
  me,
  oauthFailure,
  oauthSuccess,
  register,
} from "../controllers/authController.js";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", me);

authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
authRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/api/auth/failure" }),
  oauthSuccess
);

authRouter.get("/kakao", passport.authenticate("kakao"));
authRouter.get(
  "/kakao/callback",
  passport.authenticate("kakao", { failureRedirect: "/api/auth/failure" }),
  oauthSuccess
);

authRouter.get("/failure", oauthFailure);
