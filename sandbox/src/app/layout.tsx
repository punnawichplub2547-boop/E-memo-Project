import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR&GA E-Memo Sandbox",
  description: "Prototype for E-Memo document drafting and workflow approval."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
