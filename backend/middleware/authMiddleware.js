import supabase from "../config/supabase.js";
import { sendError } from "../utils/response.js";

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return sendError(res, "Missing authorization token.", 401);
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return sendError(res, "Missing authorization token.", 401);
  }

  // Debug: log token presence (masking most of it) and Supabase response when validation fails
  try {
    const masked = `${token?.slice(0, 6)}...${token?.slice(-6)}`;
    console.debug("requireAuth: validating token", masked);
  } catch (e) {
    // ignore
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error) console.debug("requireAuth: supabase.getUser error", error.message || error);

  if (error || !data?.user) {
    return sendError(res, "Unauthorized request.", 401);
  }

  req.user = data.user;
  req.accessToken = token;
  return next();
}

export { requireAuth };
