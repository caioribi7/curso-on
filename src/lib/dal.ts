import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Data Access Layer: the single place that resolves "who is calling".
 * getClaims() verifies the JWT signature, unlike getSession().
 */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    id: data.claims.sub as string,
    email: (data.claims.email as string | undefined) ?? "",
  };
});

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, xp, streak_days, last_study_date")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
});

/** Streak shown to the user: resets visually if they skipped a day. */
export function effectiveStreak(profile: Pick<Profile, "streak_days" | "last_study_date">) {
  if (!profile.last_study_date) return 0;
  const last = new Date(`${profile.last_study_date}T00:00:00Z`);
  const today = new Date();
  const diffDays = Math.floor(
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - last.getTime()) /
      86_400_000,
  );
  return diffDays <= 1 ? profile.streak_days : 0;
}

/** Level curve: each level needs a bit more XP than the previous one. */
export function levelFromXp(xp: number) {
  let level = 1;
  let need = 100;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = Math.round(need * 1.25);
  }
  return { level, current: remaining, next: need };
}
