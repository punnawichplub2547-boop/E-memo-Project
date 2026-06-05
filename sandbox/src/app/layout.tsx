import type { Metadata } from "next";
import "./globals.css";
import { MemoProvider } from "@/lib/memo-store";
import { PrototypeUserProvider } from "@/lib/prototype-user-context";
import { AdminUsersProvider } from "@/lib/admin-users";

export const metadata: Metadata = {
  title: "HR&GA E-Memo",
  description: "E-Memo Online Workflow Approval — Complete Auto Rubber Manufacturing"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>
        <AdminUsersProvider>
          <PrototypeUserProvider>
            <MemoProvider>
              {children}
            </MemoProvider>
          </PrototypeUserProvider>
        </AdminUsersProvider>
      </body>
    </html>
  );
}
