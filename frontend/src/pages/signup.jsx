import { useState } from "react";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function SignUp({ loading, onSubmit, onSignIn }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    setFormError("");
    if (form.password !== form.confirmPassword)
      return setFormError("Passwords do not match.");
    onSubmit(form);
  };
  const secureInput = (label, field) => (
    <TextField
      label={label}
      type={showPassword ? "text" : "password"}
      value={form[field]}
      onChange={update(field)}
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
          Create your account
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Start meeting with the people who matter.
        </Typography>
      </Box>
      {formError && (
        <Typography variant="body2" color="error">
          {formError}
        </Typography>
      )}
      <TextField
        label="Full name"
        value={form.name}
        onChange={update("name")}
        required
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <PersonRoundedIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <TextField
        label="Email address"
        type="email"
        value={form.email}
        onChange={update("email")}
        required
        fullWidth
      />
      {secureInput("Password", "password")}
      {secureInput("Confirm password", "confirmPassword")}
      <Typography variant="caption" color="text.secondary">
        Use at least 6 characters to protect your account.
      </Typography>
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={loading}
        sx={{ py: 1.25, fontWeight: 700 }}
      >
        {loading ? "Creating account..." : "Create account"}
      </Button>
      <Typography align="center" variant="body2" color="text.secondary">
        Already have an account?{" "}
        <Link
          component="button"
          type="button"
          onClick={onSignIn}
          underline="hover"
          fontWeight={700}
        >
          Sign in
        </Link>
      </Typography>
    </Stack>
  );
}
