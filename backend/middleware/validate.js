import { sendError } from "../response.js";
import {
  validateSignup,
  validateLogin,
  validateEmailOnly,
  validateResetPassword,
} from "../authValidator.js";

function validateAuth(mode) {
  return (req, res, next) => {
    let validator = validateLogin;

    if (mode === "signup") {
      validator = validateSignup;
    } else if (mode === "email") {
      validator = validateEmailOnly;
    } else if (mode === "reset") {
      validator = validateResetPassword;
    }

    const result = validator(req.body);

    if (!result.valid) {
      return sendError(res, "Validation failed", 400, result.errors);
    }

    req.validatedAuthBody = result.value;
    return next();
  };
}

export { validateAuth };
