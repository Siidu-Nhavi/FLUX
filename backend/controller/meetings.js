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

async function createMeeting(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, "Unauthorized", 401);

    const { meetingCode, date } = req.body || {};
    if (!meetingCode) return sendError(res, "meetingCode is required", 400);

    const meeting = await prisma.meeting.create({
      data: {
        userId,
        meetingCode,
        date: date ? new Date(date) : undefined,
      },
    });

    return sendSuccess(res, meeting, "Meeting saved.");
  } catch (error) {
    return next(error);
  }
}

export { getMeetings };
export { createMeeting };
