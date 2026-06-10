import type { ApprovalLevel, MemoRecord } from "./approval";
import type { SessionUser } from "./auth-jwt";

export type PrototypeRole =
  | "requester"
  | "manager"
  | "general-manager"
  | "senior-general-manager"
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
    name: "ปุณณวิช ภูประเสริฐ",
    department: "IT",
    roleLabel: "Admin / IT Support",
    roles: ["admin", "requester"],
    approvalLevel: undefined,
    readRecipientLabels: ["IT", "ปุณณวิช ภูประเสริฐ"],
  },
  {
    id: "requester",
    name: "นัดดา หาญกล้า",
    department: "HR&GA",
    roleLabel: "Requester",
    roles: ["requester"],
  },
  {
    id: "production-requester",
    name: "สุภาพร เจริญสุข",
    department: "PD",
    roleLabel: "Requester",
    roles: ["requester"],
  },
  {
    id: "manager",
    name: "สมชาย รักษ์ดี",
    department: "HR&GA",
    roleLabel: "Manager / Top Section",
    roles: ["manager"],
    approvalLevel: "Manager / Top Section",
  },
  {
    id: "gm",
    name: "ประเสริฐ สุขสวัสดิ์",
    department: "Management",
    roleLabel: "General Manager",
    roles: ["general-manager"],
    approvalLevel: "General Manager",
  },
  {
    id: "md",
    name: "วิชาญ ประสิทธิ์ชัย",
    department: "Executive",
    roleLabel: "Managing Director",
    roles: ["managing-director"],
    approvalLevel: "Managing Director",
  },
  {
    id: "accfin-reader",
    name: "กมลวรรณ สินธุ์ทอง",
    department: "ACC/FIN",
    roleLabel: "Read Recipient",
    roles: ["read-recipient"],
    readRecipientLabels: ["ACC/FIN", "ACC", "FIN"],
  },
  {
    id: "hrga-reader",
    name: "ปิยะนุช บุญมา",
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

export function sessionUserToPrototypeUser(user: SessionUser): PrototypeUser {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const approvalLevel = toApprovalLevel(user.approvalLevel);
  return {
    id: `auth-${user.userId}`,
    name,
    department: user.department,
    roleLabel: getRoleLabel(user.roles, approvalLevel),
    roles: user.roles.filter(isPrototypeRole),
    approvalLevel,
    readRecipientLabels: [name, user.department, user.email].filter(Boolean),
  };
}

function isPrototypeRole(role: string): role is PrototypeRole {
  return ["requester", "manager", "general-manager", "senior-general-manager", "managing-director", "read-recipient", "admin"].includes(role);
}

function toApprovalLevel(level: string | null): ApprovalLevel | undefined {
  if (level === "Manager / Top Section" || level === "General Manager" || level === "Managing Director") {
    return level;
  }
  return undefined;
}

function getRoleLabel(roles: string[], approvalLevel?: ApprovalLevel): string {
  if (roles.includes("admin")) return "Admin";
  if (approvalLevel) return approvalLevel;
  if (roles.includes("read-recipient")) return "Read Recipient";
  return "Requester";
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
