import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KDC CRM OS",
  description: "Kenny Donna Collective — internal CRM operations system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
