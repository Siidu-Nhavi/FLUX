import authService from "../services/authService.js";
import { sendSuccess } from "../response.js";

async function signup(req, res, next) {
  try {
    const { email, password, name } = req.validatedAuthBody || req.body;
    const auth = await authService.signUp({ email, password, name });

    return sendSuccess(
      res,
      auth,
      auth.session
        ? "Account created."
        : "Check your email to confirm the account.",
      201,
    );
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.validatedAuthBody || req.body;
    const auth = await authService.signIn({ email, password });

    return sendSuccess(res, auth, "Logged in successfully.");
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res) {
  return sendSuccess(res, { loggedOut: true }, "Logged out successfully.");
}

async function me(req, res) {
  return sendSuccess(res, { user: req.user }, "Current user loaded.");
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.validatedAuthBody || req.body;
    await authService.sendPasswordResetEmail(email);

    return sendSuccess(res, { email }, "Password reset email sent.");
  } catch (error) {
    return next(error);
  }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = req.validatedAuthBody || req.body;
    await authService.resendVerificationEmail(email);

    return sendSuccess(res, { email }, "Verification email sent.");
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.validatedAuthBody || req.body;
    await authService.resetPasswordForUser(req.user.id, newPassword);

    return sendSuccess(
      res,
      { passwordUpdated: true },
      "Password updated successfully.",
    );
  } catch (error) {
    return next(error);
  }
}

export {
  signup,
  login,
  logout,
  me,
  forgotPassword,
  resendVerification,
  resetPassword,
};
