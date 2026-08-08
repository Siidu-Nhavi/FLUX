import React, { createContext, useEffect, useState } from "react";
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
      const resp = await fetch("/api/meetings", {
        credentials: "same-origin",
      });

      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? data : data.meetings || [];
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
