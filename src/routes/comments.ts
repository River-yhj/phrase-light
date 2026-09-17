import { Router } from "express";
import { deleteComment, updateComment } from "../controllers/commentController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireCommentOwner } from "../middlewares/requireOwnership.js";

export const commentRouter = Router();

commentRouter.patch("/:id", requireAuth, requireCommentOwner, updateComment);
commentRouter.delete("/:id", requireAuth, requireCommentOwner, deleteComment);
