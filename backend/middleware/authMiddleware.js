import supabase from "../config/supabase.js";
import { sendError } from "../response.js";

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return sendError(res, "Missing authorization token.", 401);
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return sendError(res, "Missing authorization token.", 401);
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return sendError(res, "Unauthorized request.", 401);
  }

  req.user = data.user;
  req.accessToken = token;
  return next();
}

export { requireAuth };
