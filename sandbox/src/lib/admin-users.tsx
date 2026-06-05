"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_PROTOTYPE_USER, PROTOTYPE_USERS, isPrototypeAdmin, type PrototypeUser } from "./prototype-users";

const STORAGE_KEY = "em-admin-users";

function hasAdmin(users: PrototypeUser[]): boolean {
  return users.some(isPrototypeAdmin);
}

function ensureAdminUser(users: PrototypeUser[]): PrototypeUser[] {
  if (hasAdmin(users)) return users;
  return [
    DEFAULT_PROTOTYPE_USER,
    ...users.filter((user) => user.id !== DEFAULT_PROTOTYPE_USER.id),
  ];
}

function isLastAdminEdit(prev: PrototypeUser[], id: string, nextUser: PrototypeUser): boolean {
  const current = prev.find((user) => user.id === id);
  if (!current || !isPrototypeAdmin(current)) return false;
  const adminCount = prev.filter(isPrototypeAdmin).length;
  return adminCount <= 1 && !isPrototypeAdmin(nextUser);
}

function loadUsers(): PrototypeUser[] {
  if (typeof window === "undefined") return [...PROTOTYPE_USERS];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PrototypeUser[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const safeUsers = ensureAdminUser(parsed);
        if (!hasAdmin(parsed)) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUsers));
        }
        return safeUsers;
      }
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
    const safeNext = ensureAdminUser(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeNext)); } catch {}
    return safeNext;
  };

  const addUser = useCallback((user: PrototypeUser) => {
    setUsers(prev => save([...prev, user]));
  }, []);

  const updateUser = useCallback((id: string, patch: Partial<Omit<PrototypeUser, "id">>) => {
    setUsers(prev => save(prev.map((u) => {
      if (u.id !== id) return u;
      const nextUser = { ...u, ...patch };
      if (!isLastAdminEdit(prev, id, nextUser)) return nextUser;
      return { ...nextUser, roles: Array.from(new Set([...nextUser.roles, "admin"])) };
    })));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => {
      const target = prev.find((user) => user.id === id);
      if (target && isPrototypeAdmin(target) && prev.filter(isPrototypeAdmin).length <= 1) {
        return save(prev);
      }
      return save(prev.filter(u => u.id !== id));
    });
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
