import Link from "next/link";
import { Link2, MessagesSquare, ShieldCheck } from "lucide-react";
import { Cinzel } from "next/font/google";

import { ImportModal } from "@/components/landing/import-modal";

const displaySerif = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const features = [
  {
    icon: Link2,
    title: "One-click sharing",
    description:
      "Turn any conversation into a clean, readable page with a single shareable link.",
  },
  {
    icon: MessagesSquare,
    title: "Organized library",
    description:
      "Keep every chat in one place — searchable, taggable, and easy to revisit.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy first",
    description:
      "You decide what goes public. Everything else stays private by default.",
  },
] as const;

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <section className="relative min-h-screen w-full overflow-hidden bg-[url('/landscape-bg.jpg')] bg-cover bg-center bg-fixed">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"
        />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-6 py-24 text-center">
          <h1
            className={`${displaySerif.className} max-w-4xl text-5xl font-bold tracking-tight text-white drop-shadow-md md:text-7xl`}
          >
            Share your AI conversations,{" "}
            <span className="italic text-white/95">beautifully</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80 drop-shadow-sm md:text-xl">
            ChatShare turns your AI chats into polished, shareable pages. Save
            the conversations that matter, organize them into collections, and
            share insights with your team or the world — all with one link.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <ImportModal
              triggerLabel="Get started free"
              triggerClassName="h-auto border border-white/50 bg-white/20 px-8 py-4 text-base text-white shadow-[0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-md transition-all duration-300 hover:bg-white/30 hover:text-white"
            />
            <Link
              href="/feed"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 py-4 text-base font-medium text-white/90 backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:text-white"
            >
              See an example
            </Link>
          </div>

          <div className="mt-20 grid w-full gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[2rem] border border-white/20 bg-white/10 p-6 text-left shadow-2xl backdrop-blur-lg"
              >
                <feature.icon
                  className="mb-3 h-6 w-6 text-white drop-shadow-sm"
                  aria-hidden
                />
                <h2 className="text-lg font-semibold text-white">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
