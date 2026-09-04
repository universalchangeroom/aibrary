"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeUsername,
  validateProfileForm,
  type ProfileFormValues,
  type UpdateProfileResult,
} from "@/lib/validations/profile";

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
