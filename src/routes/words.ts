import { Router } from "express";
import { createStory } from "../controllers/storyController.js";
import {
  createWordEntry,
  getWordEntry,
  searchWordEntries,
} from "../controllers/wordEntryController.js";
import { imageUpload } from "../lib/storage.js";
import { requireAuth } from "../middlewares/requireAuth.js";

export const wordEntryRouter = Router();

wordEntryRouter.get("/", searchWordEntries);
wordEntryRouter.post("/", requireAuth, createWordEntry);
wordEntryRouter.get("/:id", getWordEntry);
wordEntryRouter.post("/:id/stories", requireAuth, imageUpload, createStory);
