import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { CourseForm } from "../../course-form";

export const metadata: Metadata = { title: "Novo curso" };

export default async function NewCoursePage() {
  await requireUser("/studio/cursos/novo");
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/studio" className="font-display text-sm font-bold text-muted hover:text-ink">
          ← Estúdio
        </Link>
        <h1 className="text-[40px] font-black leading-tight tracking-[-0.03em]">Novo curso</h1>
        <p className="text-muted">O básico agora. Módulos, aulas e questões você organiza na próxima tela.</p>
      </header>
      <CourseForm />
    </div>
  );
}
