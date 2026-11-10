import { Router } from "express";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "../controllers/noteController.js";
import { imageUpload } from "../lib/storage.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireNoteOwner } from "../middlewares/requireOwnership.js";

export const noteRouter = Router();

// 분석 노트는 작성자만 볼 수 있다 — 모든 라우트가 로그인 필요, :id 라우트는 소유권 확인(남의 노트는 404)
noteRouter.use(requireAuth);

noteRouter.get("/", listNotes);
noteRouter.post("/", imageUpload, createNote);
noteRouter.get("/:id", requireNoteOwner, getNote);
// 순서 중요: 소유권 확인이 multer보다 먼저 — 남의 노트에 보낸 파일은 디스크에 쓰이지 않는다
noteRouter.patch("/:id", requireNoteOwner, imageUpload, updateNote);
noteRouter.delete("/:id", requireNoteOwner, deleteNote);
