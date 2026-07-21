import express from ("express");
import {
  signup,
  login,
  logout,
  me,
  forgotPassword,
  resendVerification,
  resetPassword,
} from ("../controller/auth");
import { validateAuth } from ("../middleware/validate");
import { requireAuth } from ("../middleware/authMiddleware");

import router from  express.Router();

router.post("/signup", validateAuth("signup"), signup);
router.post("/login", validateAuth("login"), login);
router.post("/forgot-password", validateAuth("email"), forgotPassword);
router.post("/resend-verification", validateAuth("email"), resendVerification);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);
router.post(
  "/reset-password",
  requireAuth,
  validateAuth("reset"),
  resetPassword,
);

module.exports = router;
