//  Updated regex: still simple, avoids catastrophic backtracking
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Stronger password regex (at least 8 chars, upper, lower, digit, special)
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

function validateEmailPassword(body, { requireName = false } = {}) {
  const errors = [];
  const email = (body?.email || "").trim();
  const password = (body?.password || "").trim();
  const name = (body?.name || "").trim();

  if (!email) {
    errors.push("Email is required.");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("Email must be a valid email address.");
  }

  if (!password) {
    errors.push("Password is required.");
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.push(
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
    );
  }

  if (requireName && !name) {
    errors.push("Name is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      email,
      name,
    },
  };
}

function validateSignup(body) {
  return validateEmailPassword(body, { requireName: true });
}

function validateLogin(body) {
  return validateEmailPassword(body, { requireName: false });
}

function validateEmailOnly(body) {
  const email = (body?.email || "").trim();
  const errors = [];

  if (!email) {
    errors.push("Email is required.");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("Email must be a valid email address.");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: { email },
  };
}

function validateResetPassword(body) {
  const password = (body?.newPassword || "").trim();
  const errors = [];

  if (!password) {
    errors.push("New password is required.");
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.push(
      "New password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {},
  };
}

export {
  validateSignup,
  validateLogin,
  validateEmailOnly,
  validateResetPassword,
};
