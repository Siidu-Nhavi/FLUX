import express from "express";
import { getMeetings } from "../controller/meetings.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// List meetings for authenticated user
router.get("/", requireAuth, getMeetings);

// Alias path for history requested by frontend
router.get("/history", requireAuth, getMeetings);

// Create meeting record (saved when a meeting ends)
router.post("/", requireAuth, (req, res, next) => import("../controller/meetings.js").then(m => m.createMeeting(req, res, next)).catch(next));

export default router;
