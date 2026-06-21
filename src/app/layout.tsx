import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import { MobileNavShell } from "@/components/mobile-nav-shell";
import { PwaShell } from "@/components/pwa-shell";
import { isEnabled } from "@/lib/feature-flags";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibebet",
  description:
    "A play-money prediction market. Closed-loop virtual economy — no withdrawals, no real-money gambling.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vibebet",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mobileNavOn = await isEnabled("mobile_nav_enabled");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <Providers>
          <SiteChrome />
          <PwaShell />
          <main
            className={
              mobileNavOn
                ? "flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
                : "flex-1"
            }
          >
            {children}
          </main>
          <footer
            className={
              mobileNavOn
                ? "hidden border-t border-white/5 px-4 py-6 text-center text-xs text-zinc-500 md:block"
                : "border-t border-white/5 px-4 py-6 text-center text-xs text-zinc-500"
            }
          >
            VIBE Points and Gems are virtual currency for in-app use only. They
            have no cash value and cannot be withdrawn or transferred.
          </footer>
          <MobileNavShell />
        </Providers>
      </body>
    </html>
  );
}
