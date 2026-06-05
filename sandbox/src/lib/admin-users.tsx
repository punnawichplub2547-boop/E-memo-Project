"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_PROTOTYPE_USER, PROTOTYPE_USERS, type PrototypeUser } from "./prototype-users";

const STORAGE_KEY = "em-admin-users";

function loadUsers(): PrototypeUser[] {
  if (typeof window === "undefined") return [...PROTOTYPE_USERS];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PrototypeUser[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...PROTOTYPE_USERS];
}

type AdminUsersContextValue = {
  users: PrototypeUser[];
  getUserById: (id: string | null | undefined) => PrototypeUser;
  addUser: (user: PrototypeUser) => void;
  updateUser: (id: string, patch: Partial<Omit<PrototypeUser, "id">>) => void;
  deleteUser: (id: string) => void;
  resetToDefaults: () => void;
};

const AdminUsersContext = createContext<AdminUsersContextValue | null>(null);

export function AdminUsersProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<PrototypeUser[]>(loadUsers);

  const save = (next: PrototypeUser[]) => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    return next;
  };

  const addUser = useCallback((user: PrototypeUser) => {
    setUsers(prev => save([...prev, user]));
  }, []);

  const updateUser = useCallback((id: string, patch: Partial<Omit<PrototypeUser, "id">>) => {
    setUsers(prev => save(prev.map(u => u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => save(prev.filter(u => u.id !== id)));
  }, []);

  const resetToDefaults = useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    setUsers([...PROTOTYPE_USERS]);
  }, []);

  const getUserById = useCallback((id: string | null | undefined): PrototypeUser => {
    return users.find(u => u.id === id) ?? users[0] ?? DEFAULT_PROTOTYPE_USER;
  }, [users]);

  return (
    <AdminUsersContext.Provider value={{ users, getUserById, addUser, updateUser, deleteUser, resetToDefaults }}>
      {children}
    </AdminUsersContext.Provider>
  );
}

export function useAdminUsers() {
  const ctx = useContext(AdminUsersContext);
  if (!ctx) throw new Error("useAdminUsers must be used within AdminUsersProvider");
  return ctx;
}
