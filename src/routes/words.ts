import { Router } from "express";
import {
  createWordEntry,
  getWordEntry,
  searchWordEntries,
} from "../controllers/wordEntryController.js";
import { requireAuth } from "../middlewares/requireAuth.js";

export const wordEntryRouter = Router();

wordEntryRouter.get("/", searchWordEntries);
wordEntryRouter.post("/", requireAuth, createWordEntry);
wordEntryRouter.get("/:id", getWordEntry);
