"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const USERNAME_RE = /^[a-z0-9_]+$/;
export const BIO_MAX_LENGTH = 250;

export type ProfileFormValues = {
  username: string;
  display_name: string;
  bio: string;
};

export type UpdateProfileResult =
  | { success: true; profile: ProfileFormValues }
  | { success: false; error: string };

function normalizeUsername(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

export function validateProfileForm(values: ProfileFormValues): string | null {
  const username = normalizeUsername(values.username);
  if (username !== null && !USERNAME_RE.test(username)) {
    return "Username must be lowercase letters, numbers, and underscores only (no spaces).";
  }

  const bio = values.bio.trim();
  if (bio.length > BIO_MAX_LENGTH) {
    return `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export async function updateProfile(
  values: ProfileFormValues
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "You must be signed in to update your profile." };
  }

  const validationError = validateProfileForm(values);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const username = normalizeUsername(values.username);
  const displayName = values.display_name.trim() || null;
  const bio = values.bio.trim() || null;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName,
      bio,
    })
    .eq("id", user.id)
    .select("username, display_name, bio")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "That username is already taken. Please choose another.",
      };
    }
    return {
      success: false,
      error: error.message || "Failed to save profile. Please try again.",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Profile not found. Try refreshing the page.",
    };
  }

  const profile: ProfileFormValues = {
    username: typeof data.username === "string" ? data.username : "",
    display_name:
      typeof data.display_name === "string" ? data.display_name : "",
    bio: typeof data.bio === "string" ? data.bio : "",
  };

  revalidatePath("/settings");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/user/${user.id}`);
  if (profile.username) {
    revalidatePath(`/user/${profile.username}`);
  }
  revalidatePath("/feed");

  return { success: true, profile };
}
