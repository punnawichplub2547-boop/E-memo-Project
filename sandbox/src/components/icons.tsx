import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const Ic = ({ children, size = 16, style, className }: { children: React.ReactNode; size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconGauge = (p: IconProps) => <Ic {...p}><path d="M12 14l4-4"/><path d="M21 12a9 9 0 1 0-3.5 7.1"/><path d="M12 21a9 9 0 0 0 9-9"/></Ic>;
export const IconPen = (p: IconProps) => <Ic {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></Ic>;
export const IconRoute = (p: IconProps) => <Ic {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 6h7a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h7"/></Ic>;
export const IconSearch = (p: IconProps) => <Ic {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Ic>;
export const IconHistory = (p: IconProps) => <Ic {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></Ic>;
export const IconShield = (p: IconProps) => <Ic {...p}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></Ic>;
export const IconBell = (p: IconProps) => <Ic {...p}><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 19a2 2 0 0 0 4 0"/></Ic>;
export const IconPlus = (p: IconProps) => <Ic {...p}><path d="M12 5v14M5 12h14"/></Ic>;
export const IconSparkles = (p: IconProps) => <Ic {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></Ic>;
export const IconUpload = (p: IconProps) => <Ic {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></Ic>;
export const IconCheck = (p: IconProps) => <Ic {...p}><path d="M5 12l5 5 9-12"/></Ic>;
export const IconCheckCircle = (p: IconProps) => <Ic {...p}><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/></Ic>;
export const IconX = (p: IconProps) => <Ic {...p}><path d="M18 6L6 18M6 6l12 12"/></Ic>;
export const IconEye = (p: IconProps) => <Ic {...p}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></Ic>;
export const IconEyeOff = (p: IconProps) => <Ic {...p}><path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4 4"/><path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-2.3 3.1"/><path d="M6.7 6.7C4 8.5 2.5 12 2.5 12s3.5 7 9.5 7a10 10 0 0 0 4.2-.9"/></Ic>;
export const IconArrowRight = (p: IconProps) => <Ic {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Ic>;
export const IconArrowUp = (p: IconProps) => <Ic {...p}><path d="M12 19V5M5 12l7-7 7 7"/></Ic>;
export const IconArrowDown = (p: IconProps) => <Ic {...p}><path d="M12 5v14M5 12l7 7 7-7"/></Ic>;
export const IconFilter = (p: IconProps) => <Ic {...p}><path d="M22 3H2l8 10v6l4 2v-8z"/></Ic>;
export const IconUsers = (p: IconProps) => <Ic {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3 3-5 7-5s7 2 7 5"/><path d="M16 11a3.5 3.5 0 1 0 0-7"/><path d="M18 21c0-2.5-1.5-4-4-4.5"/></Ic>;
export const IconBuilding = (p: IconProps) => <Ic {...p}><path d="M3 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M17 9h2a2 2 0 0 1 2 2v10"/><path d="M9 9h.01M9 13h.01M9 17h.01M13 9h.01M13 13h.01M13 17h.01"/></Ic>;
export const IconClock = (p: IconProps) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Ic>;
export const IconFileText = (p: IconProps) => <Ic {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></Ic>;
export const IconCrown = (p: IconProps) => <Ic {...p}><path d="M3 18h18l-1.5-9-4 4L12 6l-3.5 7-4-4z"/><path d="M3 21h18"/></Ic>;
export const IconPaperclip = (p: IconProps) => <Ic {...p}><path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3 3 0 1 1 4 4l-9 9a1 1 0 0 1-1.5-1.5L15 8"/></Ic>;
export const IconChevDown = (p: IconProps) => <Ic {...p}><path d="M6 9l6 6 6-6"/></Ic>;
export const IconChevRight = (p: IconProps) => <Ic {...p}><path d="M9 6l6 6-6 6"/></Ic>;
export const IconRefresh = (p: IconProps) => <Ic {...p}><path d="M3 12a9 9 0 0 1 15.5-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.4L3 16"/><path d="M3 21v-5h5"/></Ic>;
export const IconCircle = (p: IconProps) => <Ic {...p}><circle cx="12" cy="12" r="9"/></Ic>;
export const IconSlash = (p: IconProps) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></Ic>;
export const IconReturn = (p: IconProps) => <Ic {...p}><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 4 4v3"/></Ic>;
export const IconTag = (p: IconProps) => <Ic {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/></Ic>;
export const IconCalendar = (p: IconProps) => <Ic {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Ic>;
export const IconMail = (p: IconProps) => <Ic {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></Ic>;
export const IconPrinter = (p: IconProps) => <Ic {...p}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></Ic>;
export const IconDots = (p: IconProps) => <Ic {...p}><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></Ic>;
export const IconTrash = (p: IconProps) => <Ic {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></Ic>;
export const IconKey = (p: IconProps) => <Ic {...p}><circle cx="8" cy="15" r="4"/><path d="M12 11l8-8"/><path d="M17 6l2 2"/><path d="M14 9l2 2"/></Ic>;
export const IconSettings = (p: IconProps) => <Ic {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Ic>;
export const IconUserPlus = (p: IconProps) => <Ic {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></Ic>;
export const IconSort = (p: IconProps) => <Ic {...p}><path d="M8 7v14M4 17l4 4 4-4"/><path d="M16 17V3M20 7l-4-4-4 4"/></Ic>;
export const IconDownload = (p: IconProps) => <Ic {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></Ic>;
export const IconWallet = (p: IconProps) => <Ic {...p}><path d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><circle cx="17.5" cy="13.5" r="1.5"/></Ic>;
