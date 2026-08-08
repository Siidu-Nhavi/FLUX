import  { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }

  async function getHistoryOfUser() {
    // Attempt to fetch meeting history from backend API.
    try {
      const token = localStorage.getItem("flux_access_token") || session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      // Prevent browser caching/conditional requests which can return 304 Not Modified
      headers["Cache-Control"] = "no-cache";
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
      
      const resp = await fetch(`${apiBase}/api/meetings/history`, {
        headers,
        cache: "no-store",
      });

      if (!resp.ok) return [];
      const payload = await resp.json();
      // payload.data contains meetings according to backend sendSuccess format
      return Array.isArray(payload.data) ? payload.data : payload.data?.meetings || [];
    } catch (e) {
        console.error("Error fetching meeting history:", e);
      return [];
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, signOut, getHistoryOfUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
