import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { AutoUnstarToggle } from "@/components/dashboard/auto-unstar-toggle";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { Button } from "@/components/ui/button";
import type { ProfileFormValues } from "@/lib/validations/profile";
import { authorPortfolioHref } from "@/lib/author-profile";
import { ensureViewerPropsBalance } from "@/lib/props-balance";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/settings")}`);
  }

  // Ensure a profiles row exists before loading/editing public fields.
  await ensureViewerPropsBalance(supabase, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, auto_unstar")
    .eq("id", user.id)
    .maybeSingle();

  const initialValues: ProfileFormValues = {
    username: typeof profile?.username === "string" ? profile.username : "",
    display_name:
      typeof profile?.display_name === "string" ? profile.display_name : "",
    bio: typeof profile?.bio === "string" ? profile.bio : "",
  };

  const autoUnstar = profile?.auto_unstar !== false;
  const publicProfileHref =
    authorPortfolioHref(
      profile
        ? {
            id: user.id,
            username:
              typeof profile.username === "string" ? profile.username : null,
          }
        : { id: user.id, username: null },
      user.id
    ) ?? `/user/${encodeURIComponent(user.id)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your public profile and Generosification preferences.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 gap-2">
          <Link href={publicProfileHref}>
            <ExternalLink className="h-4 w-4" aria-hidden />
            View My Public Profile
          </Link>
        </Button>
      </header>

      <ProfileSettingsForm initialValues={initialValues} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Preferences</h2>
        <AutoUnstarToggle initialAutoUnstar={autoUnstar} />
      </section>
    </main>
  );
}
