const supabase = require("../config/supabase");
const supabaseAdmin = require("../config/supabaseAdmin");

function getFrontendRedirectUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
}

async function signUp({ email, password, name }) {
  const redirectTo = getFrontendRedirectUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw createAuthError(error.message, 400);
  }

  return sanitizeSession(data);
}

async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw createAuthError(error.message, 401);
  }

  return sanitizeSession(data);
}

async function getUserFromToken(token) {
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw createAuthError("Unauthorized request.", 401);
  }

  return data.user;
}

async function sendPasswordResetEmail(email) {
  const redirectTo = getFrontendRedirectUrl();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw createAuthError(error.message, 400);
  }

  return data;
}

async function resendVerificationEmail(email) {
  const redirectTo = getFrontendRedirectUrl();
  const { data, error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw createAuthError(error.message, 400);
  }

  return data;
}

async function resetPasswordForUser(userId, newPassword) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    {
      password: newPassword,
    },
  );

  if (error) {
    throw createAuthError(error.message, 400);
  }

  return data;
}

function sanitizeSession(data) {
  return {
    user: data?.user || null,
    session: data?.session || null,
  };
}

function createAuthError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  signUp,
  signIn,
  getUserFromToken,
  sendPasswordResetEmail,
  resendVerificationEmail,
  resetPasswordForUser,
};
