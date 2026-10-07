import { Router } from "express";
import { createComment, listComments } from "../controllers/commentController.js";
import { deleteStory, updateStory } from "../controllers/storyController.js";
import { toggleVote } from "../controllers/voteController.js";
import { imageUpload } from "../lib/storage.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireStoryOwner } from "../middlewares/requireOwnership.js";

export const storyRouter = Router();

// 순서 중요: 소유권 확인(403)이 multer보다 먼저 — 남의 story에 보낸 파일은 디스크에 쓰이지 않는다
storyRouter.patch("/:id", requireAuth, requireStoryOwner, imageUpload, updateStory);
storyRouter.delete("/:id", requireAuth, requireStoryOwner, deleteStory);
storyRouter.post("/:id/votes", requireAuth, toggleVote);
storyRouter.get("/:id/comments", listComments);
storyRouter.post("/:id/comments", requireAuth, createComment);
