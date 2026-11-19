import type { Metadata } from "next";
import { getProfile, levelFromXp, requireUser } from "@/lib/dal";
import { initials } from "@/lib/utils";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/app/perfil");
  const profile = await getProfile();
  const lvl = levelFromXp(profile?.xp ?? 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="flex items-center gap-5">
        <span className="flex size-20 items-center justify-center rounded-full border-4 border-brand bg-sun font-display text-2xl font-black">
          {initials(profile?.full_name || "Você")}
        </span>
        <div>
          <h1 className="text-[32px] font-black leading-tight">{profile?.full_name || "Seu perfil"}</h1>
          <p className="text-muted">
            Nível {lvl.level} · {(profile?.xp ?? 0).toLocaleString("pt-BR")} XP
          </p>
        </div>
      </header>
      <section className="flex flex-col gap-6 rounded-[28px] border border-line bg-white p-6">
        <ProfileForm fullName={profile?.full_name ?? ""} email={user.email} />
      </section>
    </div>
  );
}
