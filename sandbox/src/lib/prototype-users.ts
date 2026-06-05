import type { ApprovalLevel, MemoRecord } from "./approval";

export type PrototypeRole =
  | "requester"
  | "manager"
  | "general-manager"
  | "managing-director"
  | "read-recipient"
  | "admin";

export type PrototypeUser = {
  id: string;
  name: string;
  department: string;
  roleLabel: string;
  roles: PrototypeRole[];
  approvalLevel?: ApprovalLevel;
  readRecipientLabels?: string[];
};

export const PROTOTYPE_USERS: PrototypeUser[] = [
  {
    id: "admin",
    name: "อำภา หิงคำ",
    department: "HR&GA",
    roleLabel: "Admin / HR&GA Manager",
    roles: ["admin", "manager", "read-recipient"],
    approvalLevel: "Manager / Top Section",
    readRecipientLabels: ["HR&GA", "อำภา หิงคำ"],
  },
  {
    id: "requester",
    name: "Project Intern",
    department: "IT",
    roleLabel: "Requester",
    roles: ["requester"],
  },
  {
    id: "production-requester",
    name: "Production",
    department: "PD",
    roleLabel: "Requester",
    roles: ["requester"],
  },
  {
    id: "manager",
    name: "Manager User",
    department: "HR&GA",
    roleLabel: "Manager / Top Section",
    roles: ["manager"],
    approvalLevel: "Manager / Top Section",
  },
  {
    id: "gm",
    name: "GM User",
    department: "Management",
    roleLabel: "General Manager",
    roles: ["general-manager"],
    approvalLevel: "General Manager",
  },
  {
    id: "md",
    name: "MD User",
    department: "Executive",
    roleLabel: "Managing Director",
    roles: ["managing-director"],
    approvalLevel: "Managing Director",
  },
  {
    id: "accfin-reader",
    name: "ACC/FIN User",
    department: "ACC/FIN",
    roleLabel: "Read Recipient",
    roles: ["read-recipient"],
    readRecipientLabels: ["ACC/FIN", "ACC", "FIN"],
  },
  {
    id: "hrga-reader",
    name: "HR&GA User",
    department: "HR&GA",
    roleLabel: "Read Recipient",
    roles: ["read-recipient"],
    readRecipientLabels: ["HR&GA"],
  },
];

export const DEFAULT_PROTOTYPE_USER_ID = "admin";
export const DEFAULT_PROTOTYPE_USER = PROTOTYPE_USERS[0];

export function getPrototypeUserById(id: string | null | undefined): PrototypeUser {
  return PROTOTYPE_USERS.find((user) => user.id === id) ?? DEFAULT_PROTOTYPE_USER;
}

export function getPrototypeUserInitials(user: PrototypeUser): string {
  return user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function isPrototypeAdmin(user: PrototypeUser): boolean {
  return user.roles.includes("admin");
}

export function canApproveMemo(user: PrototypeUser, memo: MemoRecord): boolean {
  if (memo.status !== "pending") return false;
  if (isPrototypeAdmin(user)) return true;
  return user.approvalLevel === memo.currentStep;
}

export function canReturnOrRejectMemo(user: PrototypeUser, memo: MemoRecord): boolean {
  return canApproveMemo(user, memo);
}

export function canResubmitMemo(user: PrototypeUser, memo: MemoRecord): boolean {
  const canEnterRevision =
    memo.status === "returned" ||
    (memo.status === "rejected" && memo.rejectDisposition === "revision-allowed");
  if (!canEnterRevision) return false;
  return isPrototypeAdmin(user) || memo.requester === user.name;
}

export function canMarkReadRecipient(user: PrototypeUser, recipient: string): boolean {
  if (isPrototypeAdmin(user)) return true;
  const labels = new Set([user.name, user.department, ...(user.readRecipientLabels ?? [])]);
  return labels.has(recipient);
}
