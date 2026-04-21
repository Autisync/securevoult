import { TempoInit } from "@/components/tempo-init";
import { ThemeProvider, themeScript } from "@/components/ThemeProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SecureVoult — Encrypted Password Manager",
  description: "Zero-knowledge, end-to-end encrypted password manager. Your data stays yours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        {/* Inline script to apply theme before first paint — prevents FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <TempoInit />
      </body>
    </html>
  );
}
