import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — ChatCarousel",
  description:
    "Terms of Service for ChatCarousel, including user content, liability, and enforcement.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white/80">
      <article className="mx-auto mt-12 max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        <h1 className="mb-8 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 bg-clip-text text-4xl font-extrabold text-transparent">
          Terms of Service
        </h1>
        <p className="text-sm text-white/50">
          Last updated: {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <p className="mt-6 leading-relaxed">
          Welcome to ChatCarousel (also referred to as &quot;ChatShare,&quot;
          &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an
          account, accessing the site, or publishing content, you agree to these
          Terms of Service. If you do not agree, do not use the platform.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          1. Eligibility & Accounts
        </h2>
        <p className="leading-relaxed">
          You must be legally able to form a binding contract in your
          jurisdiction to use ChatCarousel. You are responsible for safeguarding
          your credentials and for all activity under your account. Provide
          accurate information and keep your username permanent once claimed.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          2. User Content
        </h2>
        <p className="leading-relaxed">
          You retain ownership of the conversations, transcripts, summaries,
          tags, and other materials you upload or publish (&quot;User
          Content&quot;). By posting User Content, you grant ChatCarousel a
          worldwide, non-exclusive, royalty-free license to host, display,
          reproduce, and distribute that content solely to operate, promote, and
          improve the service.
        </p>
        <p className="mt-4 leading-relaxed">
          You represent that you have the rights to share the User Content you
          submit, that it does not infringe third-party rights, and that it does
          not include confidential information you are not authorized to
          disclose. You are solely responsible for redacting secrets, credentials,
          and personal data before publishing.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          3. Acceptable Use
        </h2>
        <p className="leading-relaxed">
          You agree not to use ChatCarousel to distribute illegal content,
          malware, scams, doxxing material, severe harassment, or other safety
          violations described in our{" "}
          <Link
            href="/community"
            className="text-cyan-300 underline-offset-4 hover:underline"
          >
            Community Guidelines
          </Link>
          . Quality disputes (boring, lazy, or hallucinated chats) belong in
          Props and downvotes—not the Report system.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          Enforcement & Reporting
        </h2>
        <p className="leading-relaxed">
          ChatCarousel reserves the right to immediately terminate access and
          delete content for users who violate safety standards. Our reporting
          system is monitored by admins, and actions taken (including permanent
          bans) are final.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          4. AI-Generated Material & Third-Party Models
        </h2>
        <p className="leading-relaxed">
          Shared chats may include outputs from third-party AI systems. We do
          not control those models and do not warrant that shared content is
          accurate, complete, or safe to follow. Treat all AI output as
          unverified unless independently confirmed.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          5. Liability
        </h2>
        <p className="leading-relaxed">
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
          WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, CHATCAROUSEL AND ITS OPERATORS SHALL NOT BE
          LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL ARISING FROM YOUR
          USE OF THE SERVICE OR RELIANCE ON USER CONTENT.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          6. Account Termination
        </h2>
        <p className="leading-relaxed">
          You may stop using the service at any time. We may suspend or terminate
          accounts that violate these Terms, the Community Guidelines, or
          applicable law, with or without prior notice when safety requires
          immediate action. Upon termination, your license to use the service
          ends; provisions that by nature should survive (including licenses
          already granted for distributed content, liability limits, and
          enforcement rights) will survive.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          7. Changes
        </h2>
        <p className="leading-relaxed">
          We may update these Terms from time to time. Continued use after
          changes become effective constitutes acceptance of the revised Terms.
          Material updates will be reflected by the &quot;Last updated&quot; date
          on this page.
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold text-white">
          8. Contact
        </h2>
        <p className="leading-relaxed">
          Questions about these Terms can be raised through the in-product
          reporting and moderation channels available to authenticated users.
        </p>
      </article>
    </main>
  );
}
