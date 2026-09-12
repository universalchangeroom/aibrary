import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ChatShare",
  description:
    "ChatShare lets you save, organize, and share your AI chat conversations with a single link.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <OnboardingModal />
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
