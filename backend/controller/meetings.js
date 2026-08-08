import prisma from "../config/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";

async function getMeetings(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, "Unauthorized", 401);

    const meetings = await prisma.meeting.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    return sendSuccess(res, meetings, "Meetings loaded.");
  } catch (error) {
    return next(error);
  }
}

export { getMeetings };
