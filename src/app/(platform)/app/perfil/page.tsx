import type { Metadata } from "next";
import Link from "next/link";
import { StudentCard } from "@/components/achievements/student-card";
import { getProfile, requireUser } from "@/lib/dal";
import { getAchievements } from "@/lib/queries";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/app/perfil");
  const [profile, achievements] = await Promise.all([getProfile(), getAchievements(user.id)]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px] font-black leading-tight">Meu perfil</h1>
        <Link href={`/u/${user.id}`} className="font-display font-extrabold text-brand hover:underline">
          Ver meu card público →
        </Link>
      </header>
      <StudentCard
        profile={{
          full_name: profile?.full_name ?? "",
          xp: profile?.xp ?? 0,
          streak_days: profile?.streak_days ?? 0,
          last_study_date: profile?.last_study_date ?? null,
        }}
        achievements={achievements}
        celebrateFor={user.id}
      />
      <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-card">
        <ProfileForm fullName={profile?.full_name ?? ""} email={user.email} />
      </section>
    </div>
  );
}
