import { redirect } from "next/navigation";

import { AutoUnstarToggle } from "@/components/dashboard/auto-unstar-toggle";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("auto_unstar")
    .eq("id", user.id)
    .maybeSingle();

  const autoUnstar = profile?.auto_unstar !== false;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your Generosification preferences.
        </p>
      </header>

      <AutoUnstarToggle initialAutoUnstar={autoUnstar} />
    </main>
  );
}
