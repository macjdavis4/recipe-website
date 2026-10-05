import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

const DESCRIPTION = "Share recipes, cook from what you have, and ask a cooking assistant.";

// A function so the public URL is read at request time, not at build time.
export function generateMetadata(): Metadata {
  return {
    // AUTH_URL is the public site URL (https://your-domain in production).
    metadataBase: new URL(process.env.AUTH_URL ?? "http://localhost:3000"),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: DESCRIPTION,
    openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US", description: DESCRIPTION },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#131915" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10 md:pb-12">
            {children}
          </main>
          <SiteFooter />
          <BottomTabs />
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
