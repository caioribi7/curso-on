import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentCard } from "@/components/achievements/student-card";
import { getAchievements, getPublicProfile } from "@/lib/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/u/[id]">): Promise<Metadata> {
  const { id } = await params;
  const profile = UUID.test(id) ? await getPublicProfile(id) : null;
  return { title: profile?.full_name ? `${profile.full_name} no Curso On` : "Card do aluno" };
}

/** Public student card: only public fields (name, XP, streak, badges). */
export default async function PublicStudentPage({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const profile = await getPublicProfile(id);
  if (!profile) notFound();
  const achievements = await getAchievements(id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <p className="font-display text-sm font-extrabold uppercase tracking-wide text-brand">Card do aluno</p>
      <StudentCard profile={profile} achievements={achievements} />
      <p className="text-center text-sm text-muted">
        Estudando para o ENEM no Curso On desde {new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.
      </p>
    </div>
  );
}
