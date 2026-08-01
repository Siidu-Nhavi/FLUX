import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TOKEN_KEY = "flux_access_token";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        navigate("/auth/login", { replace: true });
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load your profile.");
        }
        setUser(payload.data.user);
      } catch (profileError) {
        localStorage.removeItem(TOKEN_KEY);
        setError(profileError.message);
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [navigate]);

  async function handleLogout() {
    setLoggingOut(true);
    const token = localStorage.getItem(TOKEN_KEY);

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await supabase.auth.signOut();
      localStorage.removeItem(TOKEN_KEY);
      navigate("/auth/login", { replace: true });
    } catch (logoutError) {
      setError(logoutError.message || "Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  const displayName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Flux user";
  const isGuest = user?.is_anonymous;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: 5,
        px: 2,
        background:
          "radial-gradient(circle at top left, #e8f0ff 0%, #f7f9fc 45%, #eef3ff 100%)",
      }}
    >
      <Container maxWidth="sm">
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
              p: { xs: 3, sm: 5 },
              borderRadius: 5,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 24px 60px rgba(41, 67, 117, 0.12)",
            }}
          >
            {loading ? (
              <Stack alignItems="center" spacing={2} py={5}>
                <CircularProgress />
                <Typography color="text.secondary">
                  Loading your profile...
                </Typography>
              </Stack>
            ) : error ? (
              <Stack spacing={2}>
                <Alert severity="error">{error}</Alert>
                <Button
                  component={RouterLink}
                  to="/auth/login"
                  variant="contained"
                >
                  Go to sign in
                </Button>
              </Stack>
            ) : (
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      width: 64,
                      height: 64,
                      bgcolor: "primary.main",
                      fontSize: "1.75rem",
                      fontWeight: 700,
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight={800}>
                      {displayName}
                    </Typography>
                    <Typography color="text.secondary">
                      {isGuest ? "Guest account" : "Flux Meet account"}
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: "action.hover" }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <EmailRoundedIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          EMAIL
                        </Typography>
                        <Typography>
                          {user.email || "No email for guest accounts"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <PersonRoundedIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          ACCOUNT ID
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ overflowWrap: "anywhere" }}
                        >
                          {user.id}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Box>
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  startIcon={<LogoutRoundedIcon />}
                  onClick={handleLogout}
                  disabled={loggingOut}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </Button>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
