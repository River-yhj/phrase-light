import { Router } from "express";
import { analyzeText } from "../controllers/analyzeController.js";

export const analyzeRouter = Router();

analyzeRouter.post("/", analyzeText);
