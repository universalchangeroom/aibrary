import { Suspense } from "react";
import type { Metadata } from "next";

import { CarouselSignUpForm } from "@/components/auth/carousel-sign-up-form";

export const metadata: Metadata = {
  title: "Join the Chat Carousel — ChatShare",
  description:
    "Sign up for ChatShare and take your AI conversations for a spin on the Chat Carousel.",
};

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[60] flex h-screen w-screen items-center justify-center bg-[#12061d] bg-[url('/carousel-signup-bg.jpg')] bg-cover bg-center">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/55 via-violet-950/25 to-black/75" />
          <p className="relative z-10 text-amber-100/90">Loading…</p>
        </div>
      }
    >
      <CarouselSignUpForm />
    </Suspense>
  );
}
