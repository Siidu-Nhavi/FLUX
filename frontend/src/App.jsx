import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const initialForm = {
  name: '',
  email: '',
  password: '',
  newPassword: '',
  confirmPassword: '',
};

function parseAuthHash() {
  const hash = window.location.hash.replace(/^#/, '');

  if (!hash) {
    return {};
  }

  return Object.fromEntries(new URLSearchParams(hash));
}

function parseOAuthCode() {
  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get('code');

  return code || '';
}

function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);

  const fetchCurrentUser = useCallback(async (token, statusMessage = 'Current user loaded.') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load user.');
      }

      setUser(payload.data.user);
      setSession({ accessToken: token });
      setMessage(statusMessage);
      setError('');
    } catch (err) {
      localStorage.removeItem('flux_access_token');
      setUser(null);
      setSession(null);
      setError(err.message);
    }
  }, []);

  const handleOAuthLogin = useCallback(async (provider) => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      setError(err.message || 'OAuth sign-in failed.');
      setLoading(false);
    }
  }, []);

  const bootstrapAuthState = useCallback(async () => {
    const authHash = parseAuthHash();

    const oauthCode = parseOAuthCode();

    if (oauthCode) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (error) {
        setError(error.message);
        return;
      }

      const sessionToken = data.session?.access_token;

      if (sessionToken) {
        localStorage.setItem('flux_access_token', sessionToken);

        window.history.replaceState({}, document.title, window.location.pathname);

        setMessage('OAuth sign-in completed successfully.');

        await fetchCurrentUser(sessionToken, 'OAuth sign-in completed successfully.');
        return;
      }
    }

    if (authHash.access_token) {
      localStorage.setItem('flux_access_token', authHash.access_token);

      if (authHash.type === 'recovery') {
        setMode('reset');
      }

      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

      const statusMessage =
        authHash.type === 'recovery'
          ? 'Recovery link detected. Set a new password to finish the reset.'
          : authHash.type === 'signup'
            ? 'Email verified successfully. You can now continue.'
            : 'Current user loaded.';

      await fetchCurrentUser(authHash.access_token, statusMessage);
      return;
    }

    const token = localStorage.getItem('flux_access_token');

    if (!token) {
      return;
    }

    await fetchCurrentUser(token);
  }, [fetchCurrentUser]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void bootstrapAuthState();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [bootstrapAuthState]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const payloadByMode = {
      login: { email: form.email, password: form.password },
      signup: { name: form.name, email: form.email, password: form.password },
      forgot: { email: form.email },
      verify: { email: form.email },
      reset: { newPassword: form.newPassword },
    };

    const endpointByMode = {
      login: '/api/auth/login',
      signup: '/api/auth/signup',
      forgot: '/api/auth/forgot-password',
      verify: '/api/auth/resend-verification',
      reset: '/api/auth/reset-password',
    };

    if (mode === 'reset' && form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('flux_access_token');

      const response = await fetch(`${API_BASE_URL}${endpointByMode[mode]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(mode === 'reset' && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payloadByMode[mode]),
      });

      const result = await response.json();

      if (!response.ok) {
        const fallback = Array.isArray(result.errors) ? result.errors.join(' ') : 'Authentication failed.';
        throw new Error(result.message || fallback);
      }

      if (mode === 'login' || mode === 'signup') {
        const nextUser = result.data.user;
        const nextSession = result.data.session;

        if (nextSession?.access_token) {
          localStorage.setItem('flux_access_token', nextSession.access_token);
        }

        setUser(nextUser);
        setSession(nextSession);
      }

      if (mode === 'reset') {
        localStorage.removeItem('flux_access_token');
        setUser(null);
        setSession(null);
        setMode('login');
        setForm(initialForm);
      }

      setMessage(result.message);
      setForm((current) => ({
        ...current,
        password: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const token = localStorage.getItem('flux_access_token');

    if (token) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    await supabase.auth.signOut();
    localStorage.removeItem('flux_access_token');
    setUser(null);
    setSession(null);
    setMessage('Logged out successfully.');
  }

  const isSignup = mode === 'signup';
  const isResetMode = mode === 'reset';

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="hero-copy">
          <p className="eyebrow">Supabase authentication</p>
          <h1>Ship auth with sign in, verification, and password recovery.</h1>
          <p className="hero-text">
            Create an account, verify the email, request a reset link, and complete recovery against your Express backend.
          </p>
        </div>

        <div className="card">
          <div className="oauth-row">
            <button className="oauth-button google" type="button" disabled={loading} onClick={() => void handleOAuthLogin('google')}>
              Continue with Google
            </button>
          </div>

          <p className="oauth-divider">or use email and password</p>

          <div className="tab-row">
            <button className={mode === 'login' ? 'tab active' : 'tab'} type="button" onClick={() => setMode('login')}>
              Log in
            </button>
            <button className={mode === 'signup' ? 'tab active' : 'tab'} type="button" onClick={() => setMode('signup')}>
              Sign up
            </button>
            <button className={mode === 'forgot' ? 'tab active' : 'tab'} type="button" onClick={() => setMode('forgot')}>
              Reset link
            </button>
            <button className={mode === 'verify' ? 'tab active' : 'tab'} type="button" onClick={() => setMode('verify')}>
              Verify email
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label>
                <span>Name</span>
                <input name="name" value={form.name} onChange={handleChange} placeholder="Jane Doe" />
              </label>
            )}

            {mode !== 'reset' && (
              <label>
                <span>Email</span>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
              </label>
            )}

            {mode === 'login' || mode === 'signup' ? (
              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                />
              </label>
            ) : null}

            {isResetMode && (
              <>
                <label>
                  <span>New password</span>
                  <input
                    name="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Create a new password"
                  />
                </label>

                <label>
                  <span>Confirm new password</span>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat the new password"
                  />
                </label>
              </>
            )}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading
                ? 'Working...'
                : mode === 'signup'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset email'
                    : mode === 'verify'
                      ? 'Send verification email'
                      : mode === 'reset'
                        ? 'Update password'
                        : 'Log in'}
            </button>
          </form>

          <div className="helper-actions">
            <button className="link-button" type="button" onClick={() => setMode('forgot')}>
              Forgot your password?
            </button>
            <button className="link-button" type="button" onClick={() => setMode('verify')}>
              Resend verification email
            </button>
          </div>

          {message && <p className="status success">{message}</p>}
          {error && <p className="status error">{error}</p>}

          <div className="session-box">
            <div>
              <p className="session-label">Session</p>
              <p className="session-value">{session?.accessToken ? 'Active' : 'Inactive'}</p>
            </div>

            {user ? (
              <button className="secondary-button" type="button" onClick={handleLogout}>
                Log out
              </button>
            ) : null}
          </div>
        </div>

        <div className="profile-card">
          <p className="profile-title">Current user</p>
          {user ? (
            <pre>{JSON.stringify(user, null, 2)}</pre>
          ) : (
            <p className="empty-state">
              {isResetMode
                ? 'Use the recovery link to set a new password.'
                : 'Sign in to load the authenticated user payload from /api/auth/me.'}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;