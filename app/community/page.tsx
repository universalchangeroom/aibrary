import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community Guidelines — ChatCarousel",
  description:
    "How ChatCarousel separates quality curation from safety reporting.",
};

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white/80">
      <article className="mx-auto mt-12 max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        <h1 className="mb-8 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-4xl font-extrabold text-transparent">
          Community Guidelines
        </h1>
        <p className="leading-relaxed">
          ChatCarousel is a shared gallery of AI conversations. These guidelines
          keep the ride useful, honest, and safe. Read them before you publish,
          vote, or report.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          Quality vs. Safety
        </h2>
        <p className="leading-relaxed">
          Not every disappointing chat is a safety incident. We deliberately
          separate taste from danger so the Report button stays sharp.
        </p>

        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <h3 className="text-lg font-semibold text-white">
              The Slop Filter (Props & Downvotes)
            </h3>
            <p className="mt-2 leading-relaxed">
              If a chat is boring, lazy, or hallucinates, use the downvote or
              withhold your Props. The community algorithm will handle the rest.
            </p>
          </div>

          <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-5">
            <h3 className="text-lg font-semibold text-white">
              The Emergency Brake (Report Button)
            </h3>
            <p className="mt-2 leading-relaxed">
              The Report function is strictly for safety violations. Use this
              ONLY for: Exposed Personal Identifiable Information (PII),
              malicious/dangerous prompts, illegal content, or severe harassment.
            </p>
          </div>
        </div>

        <p className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 leading-relaxed text-red-100">
          Weaponizing the Report button for opinions you simply disagree with
          will result in an account ban.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          What We Encourage
        </h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed">
          <li>Original, insightful, or useful AI conversations.</li>
          <li>Clear tags and honest summaries so others can discover context.</li>
          <li>Redacting secrets, private names, and sensitive identifiers before publishing.</li>
          <li>Generous but thoughtful Props for work that deserves the spotlight.</li>
        </ul>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          What Gets You Removed
        </h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed">
          <li>Publishing PII, private credentials, or doxxing material.</li>
          <li>Malicious or dangerous prompts intended to cause real-world harm.</li>
          <li>Illegal content or severe harassment.</li>
          <li>Spam floods, impersonation, or coordinated abuse of voting/reporting tools.</li>
        </ul>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          How Enforcement Works
        </h2>
        <p className="leading-relaxed">
          Admins review pending reports in the Security & Moderation queue.
          Threads that violate safety standards may be deleted; accounts that
          abuse reporting or repeatedly break these guidelines may be banned.
          Details of legal enforcement also appear in our{" "}
          <Link
            href="/terms"
            className="text-cyan-300 underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
