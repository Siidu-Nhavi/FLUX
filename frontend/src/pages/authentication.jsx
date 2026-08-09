import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useParams, useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Alert, Box, Button, Container, Paper, Stack, TextField } from "@mui/material";
import { supabase } from "../lib/supabaseClient";
import SignIn from "./signin";
import SignUp from "./signup";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "https://flux-43to.onrender.com";
const TOKEN_KEY = "flux_access_token";
const VIEW_BY_ROUTE = {
  login: "signin",
  register: "signup",
  guest: "signin",
};

function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export default function Authentication() {
  const { authAction } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState(() => VIEW_BY_ROUTE[authAction] || "signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [guestMeetingCode, setGuestMeetingCode] = useState("");

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const request = useCallback(async (path, body, token) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload.message ||
          payload.errors?.join(" ") ||
          "Authentication failed.",
      );
    }

    return payload;
  }, []);

  const loadCurrentUser = useCallback(async (token, successMessage) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();

    if (!response.ok) {
      localStorage.removeItem(TOKEN_KEY);
      throw new Error(payload.message || "Unable to load your account.");
    }

    setUser(payload.data.user);
    if (successMessage) setMessage(successMessage);
  }, []);

  useEffect(() => {
    const initialiseAuth = async () => {
      const hash = getHashParams();
      const code = new URLSearchParams(window.location.search).get("code");

      try {
        let token = "";
        if (code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) throw exchangeError;
          token = data.session?.access_token || "";
        } else if (hash.get("access_token")) {
          token = hash.get("access_token");
          if (hash.get("type") === "recovery") setView("reset");
        } else {
          token = localStorage.getItem(TOKEN_KEY) || "";

          if (!token && authAction === "guest") {
            setLoading(true);
            const { data, error: guestError } =
              await supabase.auth.signInAnonymously();

            if (guestError) throw guestError;
            token = data.session?.access_token || "";

            if (!token) {
              throw new Error("Unable to start a guest session.");
            }
          }
        }

        if (!token) return;
        localStorage.setItem(TOKEN_KEY, token);
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        await loadCurrentUser(
          token,
          hash.get("type") === "recovery"
            ? "Create a new password to finish recovering your account."
            : code
              ? "Google sign-in completed successfully."
              : authAction === "guest"
                ? "Guest session started. You can use Flux Meet without creating an account."
                : "",
        );
        // After a successful OAuth/code exchange or guest sign-in, navigate home.
        if (code || hash.get("access_token") || authAction === "guest") {
          navigate("/home", { replace: true });
        }
      } catch (authError) {
        setError(authError.message || "Unable to complete authentication.");
      } finally {
        setLoading(false);
      }
    };

    void initialiseAuth();
  }, [authAction, loadCurrentUser, navigate]);

  const handleGuestJoin = async () => {
    clearFeedback();
    if (!guestMeetingCode.trim()) {
      setError("Please enter a meeting code to join as a guest.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: guestError } = await supabase.auth.signInAnonymously();
      if (guestError) throw guestError;
      const token = data.session?.access_token || "";
      if (!token) throw new Error("Unable to start a guest session.");
      localStorage.setItem(TOKEN_KEY, token);
      await loadCurrentUser(token, "Guest session started.");
      navigate(`/${guestMeetingCode.trim()}`, { replace: true });
    } catch (e) {
      setError(e.message || "Unable to join as guest.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async ({ email, password }) => {
    setLoading(true);
    clearFeedback();
    try {
      const result = await request("/api/auth/login", { email, password });
      const token = result.data.session?.access_token;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      setUser(result.data.user);
      setMessage(result.message);
      if (token) navigate("/home", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async ({ name, email, password }) => {
    setLoading(true);
    clearFeedback();
    try {
      const result = await request("/api/auth/signup", {
        name,
        email,
        password,
      });
      const token = result.data.session?.access_token;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      setUser(result.data.user);
      setMessage(result.message);
      if (!token) setView("signin");
      if (token) navigate("/home", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAction = async ({ email, action }) => {
    setLoading(true);
    clearFeedback();
    try {
      const path =
        action === "forgot"
          ? "/api/auth/forgot-password"
          : "/api/auth/resend-verification";
      const result = await request(path, { email });
      setMessage(result.message);
      setView("signin");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async ({ newPassword }) => {
    setLoading(true);
    clearFeedback();
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const result = await request(
        "/api/auth/reset-password",
        { newPassword },
        token,
      );
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setMessage(result.message);
      setView("signin");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    clearFeedback();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (oauthError) {
      setError(oauthError.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  const changeView = (nextView) => {
    clearFeedback();
    setView(nextView);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 5,
        background:
          "radial-gradient(circle at top left, #e8f0ff 0%, #f7f9fc 45%, #eef3ff 100%)",
      }}
    >
      <Container maxWidth="sm" disableGutters>
        <Stack spacing={3}>
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBackRoundedIcon />}
            sx={{ alignSelf: "flex-start", color: "text.secondary" }}
          >
            Back to home
          </Button>
          <Paper
            elevation={0}
            sx={{
              overflow: "hidden",
              borderRadius: 5,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 24px 60px rgba(41, 67, 117, 0.12)",
            }}
          >
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              {message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {message}
                </Alert>
              )}
              {error && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  onClose={() => setError("")}
                >
                  {error}
                </Alert>
              )}
              {authAction === "guest" && (
                <Stack spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    label="Meeting code"
                    value={guestMeetingCode}
                    onChange={(e) => setGuestMeetingCode(e.target.value)}
                    placeholder="e.g. team-sync-42"
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    onClick={handleGuestJoin}
                    disabled={loading}
                  >
                    Join as guest
                  </Button>
                </Stack>
              )}
              {view === "signup" ? (
                <SignUp
                  loading={loading}
                  onSubmit={handleSignUp}
                  onSignIn={() => changeView("signin")}
                />
              ) : (
                <SignIn
                  view={view}
                  loading={loading}
                  user={user}
                  onSubmit={handleSignIn}
                  onEmailAction={handleEmailAction}
                  onResetPassword={handlePasswordReset}
                  onGoogleSignIn={handleGoogleSignIn}
                  onSignUp={() => changeView("signup")}
                  onForgotPassword={() => changeView("forgot")}
                  onVerifyEmail={() => changeView("verify")}
                  onBackToSignIn={() => changeView("signin")}
                />
              )}
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
