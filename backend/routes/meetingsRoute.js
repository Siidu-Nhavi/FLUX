import express from "express";
import { getMeetings } from "../controller/meetings.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getMeetings);

export default router;
