import { TempoInit } from "@/components/tempo-init";
import { ThemeProvider, themeScript } from "@/components/ThemeProvider";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Geist, self-hosted (SIL Open Font License), same as autisync.com. No Google
// Fonts request at build or at runtime.
const inter = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",
});

// Fraunces (SIL Open Font License) for display headings on the public site.
const display = localFont({
  src: "./fonts/Fraunces-Variable.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: "SecureVoult by Autisync — Encrypted Password Manager",
  description: "The private, zero-knowledge password manager from Autisync. Passwords, 2FA codes, cards, bank details and files, encrypted on your device before they ever leave it.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon.svg",          type: "image/svg+xml" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/favicon-32x32.png",
  },
  openGraph: {
    title: "SecureVoult by Autisync — Encrypted Password Manager",
    description: "Passwords, 2FA codes, cards, bank details and files, encrypted on your device. Autofill, Windows Hello unlock and breach alerts.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecureVoult",
    description: "Zero-knowledge encrypted password manager.",
    images: ["/og-image.png"],
  },
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
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0f0f0e" />
      </head>
      <body className={`${inter.className} ${inter.variable} ${display.variable}`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <TempoInit />
      </body>
    </html>
  );
}
