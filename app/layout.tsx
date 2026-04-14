import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "myConfluence",
  description: "사내 위키 POC - Confluence 대체",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
