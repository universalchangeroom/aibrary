"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type PreferenceResult =
  | { success: true; autoUnstar: boolean }
  | { success: false; error: string };

export async function setAutoUnstarPreference(
  autoUnstar: boolean
): Promise<PreferenceResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ auto_unstar: autoUnstar })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/starred");
  return { success: true, autoUnstar };
}
