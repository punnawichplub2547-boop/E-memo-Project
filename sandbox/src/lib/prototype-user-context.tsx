"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PROTOTYPE_USER_ID } from "./prototype-users";
import type { PrototypeUser } from "./prototype-users";
import { useAdminUsers } from "./admin-users";

const STORAGE_KEY = "hr-ememo-prototype-user";

type PrototypeUserContextValue = {
  user: PrototypeUser;
  userId: string;
  setUserId: (id: string) => void;
};

const PrototypeUserContext = createContext<PrototypeUserContextValue | null>(null);

export function PrototypeUserProvider({ children }: { children: React.ReactNode }) {
  const { getUserById } = useAdminUsers();
  const [userId, setUserIdState] = useState(DEFAULT_PROTOTYPE_USER_ID);

  useEffect(() => {
    const applyStored = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setUserIdState(getUserById(stored).id);
      } catch {
        // Keep default prototype user when localStorage is unavailable.
      }
    };
    applyStored();
  }, [getUserById]);

  const setUserId = (id: string) => {
    const nextId = getUserById(id).id;
    setUserIdState(nextId);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      // Non-persistent selection is acceptable in prototype mode.
    }
  };

  const value = useMemo<PrototypeUserContextValue>(() => {
    const user = getUserById(userId);
    return { user, userId: user.id, setUserId };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, getUserById]);

  return (
    <PrototypeUserContext.Provider value={value}>
      {children}
    </PrototypeUserContext.Provider>
  );
}

export function usePrototypeUser() {
  const ctx = useContext(PrototypeUserContext);
  if (!ctx) throw new Error("usePrototypeUser must be used within PrototypeUserProvider");
  return ctx;
}
