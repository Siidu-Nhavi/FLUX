const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  } else if (password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  }

  if (requireName && !name) {
    errors.push("Name is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      email,
      password,
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
  } else if (password.length < 6) {
    errors.push("New password must be at least 6 characters long.");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: { newPassword: password },
  };
}

module.exports = {
  validateSignup,
  validateLogin,
  validateEmailOnly,
  validateResetPassword,
};
