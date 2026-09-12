import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/80 text-white/50">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs sm:flex-row sm:text-sm">
        <p className="tracking-wide">
          © {new Date().getFullYear()} ChatShare
        </p>
        <nav
          aria-label="Legal"
          className="flex items-center gap-5"
        >
          <Link
            href="/community"
            className="transition-colors hover:text-cyan-300"
          >
            Community Guidelines
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-cyan-300"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
