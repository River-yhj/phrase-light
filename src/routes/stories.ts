import { Router } from "express";
import { createComment, listComments } from "../controllers/commentController.js";
import { deleteStory, updateStory } from "../controllers/storyController.js";
import { toggleVote } from "../controllers/voteController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireStoryOwner } from "../middlewares/requireOwnership.js";

export const storyRouter = Router();

storyRouter.patch("/:id", requireAuth, requireStoryOwner, updateStory);
storyRouter.delete("/:id", requireAuth, requireStoryOwner, deleteStory);
storyRouter.post("/:id/votes", requireAuth, toggleVote);
storyRouter.get("/:id/comments", listComments);
storyRouter.post("/:id/comments", requireAuth, createComment);
