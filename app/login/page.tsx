import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log In — ChatCarousel",
  description: "Welcome back. Resume your ride on the Chat Carousel.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#0a0614] bg-[url('/carousel-login-bg.jpg')] bg-cover bg-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-transparent to-black/70"
      />

      <h1 className="sr-only">Log in to ChatCarousel</h1>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[12%] z-[1] select-none whitespace-nowrap text-center text-[13vw] font-black uppercase leading-none tracking-tighter text-white opacity-40 mix-blend-screen drop-shadow-[0_0_40px_rgba(236,72,153,0.35)] sm:top-[10%] sm:text-[16vw]"
      >
        CHAT CAROUSEL
      </p>

      <div className="relative z-10 mt-auto flex w-full justify-center px-6 pb-10 pt-40 sm:pb-14">
        <Suspense
          fallback={
            <div className="text-sm text-white/70">Loading…</div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
