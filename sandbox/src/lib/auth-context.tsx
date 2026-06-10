"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { SessionUser } from "./auth-jwt";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async r => {
        if (r.ok) return r.json() as Promise<{ user: SessionUser | null }>;
        if (typeof window !== "undefined" && !["/login", "/register"].includes(window.location.pathname)) {
          window.location.href = "/login";
        }
        return { user: null };
      })
      .then((data: { user: SessionUser | null }) => setUser(data.user))
      .catch(() => {
        setUser(null);
        if (typeof window !== "undefined" && !["/login", "/register"].includes(window.location.pathname)) {
          window.location.href = "/login";
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
