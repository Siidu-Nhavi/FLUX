import { useState } from "react";
import GoogleIcon from "@mui/icons-material/Google";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const copy = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to continue to your meeting space.",
  },
  forgot: {
    title: "Reset your password",
    subtitle: "We will email you a secure reset link.",
  },
  verify: {
    title: "Verify your email",
    subtitle: "Send a fresh verification link to your inbox.",
  },
  reset: {
    title: "Create a new password",
    subtitle: "Choose a secure password for your account.",
  },
};

export default function SignIn({
  view,
  loading,
  user,
  onSubmit,
  onEmailAction,
  onResetPassword,
  onGoogleSignIn,
  onSignUp,
  onForgotPassword,
  onVerifyEmail,
  onBackToSignIn,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const details = copy[view] || copy.signin;

  const submit = (event) => {
    event.preventDefault();
    setFormError("");
    if (view === "signin") return onSubmit({ email, password });
    if (view === "reset") {
      if (newPassword !== confirmPassword)
        return setFormError("Passwords do not match.");
      return onResetPassword({ newPassword });
    }
    return onEmailAction({ email, action: view });
  };

  const passwordField = (label, value, onChange) => (
    <TextField
      label={label}
      type={showPassword ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
      fullWidth
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((visible) => !visible)}
              edge="end"
            >
              {showPassword ? (
                <VisibilityOffRoundedIcon />
              ) : (
                <VisibilityRoundedIcon />
              )}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );

  return (
    <Stack component="form" spacing={2.25} onSubmit={submit} noValidate>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          {details.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {details.subtitle}
        </Typography>
      </Box>
      {formError && (
        <Typography variant="body2" color="error">
          {formError}
        </Typography>
      )}
      {view === "signin" && (
        <>
          <Button
            variant="outlined"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={onGoogleSignIn}
            disabled={loading}
            sx={{ py: 1.25, textTransform: "none" }}
          >
            Continue with Google
          </Button>
          <Divider>or continue with email</Divider>
        </>
      )}
      {view !== "reset" && (
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
        />
      )}
      {view === "signin" &&
        passwordField("Password", password, setPassword, "current-password")}
      {view === "reset" && (
        <>
          {passwordField(
            "New password",
            newPassword,
            setNewPassword,
            "new-password",
          )}
          {passwordField(
            "Confirm new password",
            confirmPassword,
            setConfirmPassword,
            "new-password",
          )}
        </>
      )}
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={loading}
        sx={{ py: 1.25, fontWeight: 700 }}
      >
        {loading
          ? "Please wait..."
          : view === "signin"
            ? "Sign in"
            : view === "forgot"
              ? "Send reset link"
              : view === "verify"
                ? "Send verification link"
                : "Update password"}
      </Button>
      {view === "signin" && (
        <Stack spacing={1} alignItems="flex-start">
          <Link
            component="button"
            type="button"
            onClick={onForgotPassword}
            underline="hover"
          >
            Forgot your password?
          </Link>
          <Link
            component="button"
            type="button"
            onClick={onSignUp}
            underline="hover"
            fontWeight={700}
          >
            Create an account
          </Link>
          <Link
            component="button"
            type="button"
            onClick={onVerifyEmail}
            underline="hover"
            variant="body2"
          >
            Resend verification email
          </Link>
        </Stack>
      )}
      {view !== "signin" && (
        <Button
          type="button"
          onClick={onBackToSignIn}
          startIcon={
            view === "forgot" ? (
              <LockResetRoundedIcon />
            ) : (
              <MarkEmailReadRoundedIcon />
            )
          }
          sx={{ alignSelf: "center", textTransform: "none" }}
        >
          Back to sign in
        </Button>
      )}
    </Stack>
  );
}
