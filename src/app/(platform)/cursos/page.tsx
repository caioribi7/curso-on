import type { Metadata } from "next";
import Link from "next/link";
import { CourseIllustration } from "@/components/icons/flat-icons";
import { getPublishedCourses } from "@/lib/queries";
import { courseThemeVars, formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Cursos", description: "Explore cursos com aulas curtas, questões e XP." };

export default async function CatalogPage() {
  const courses = await getPublishedCourses();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[40px] font-black leading-tight tracking-[-0.03em]">Explorar cursos</h1>
        <p className="text-lg text-muted">Aulas curtas, prática com questões e XP a cada passo.</p>
      </header>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[32px] border-2 border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <CourseIllustration icon="bulb" size={96} />
          <h2 className="text-2xl font-black">O catálogo está esquentando</h2>
          <p className="max-w-md text-muted">Ainda não há cursos publicados. Que tal ser o primeiro a criar um?</p>
          <Link href="/studio/cursos/novo" className="font-display font-bold text-brand hover:underline">
            Criar um curso →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {courses.map((c) => (
            <li key={c.id} style={courseThemeVars(c.theme_color)}>
              <Link
                href={`/cursos/${c.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-[28px] border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex h-40 items-center justify-center bg-course-soft">
                  <CourseIllustration icon={c.icon} size={104} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="text-xl font-black leading-tight">{c.title}</h2>
                  <p className="line-clamp-2 text-sm text-muted">{c.subtitle}</p>
                  <span className="mt-auto w-fit rounded-full bg-course-soft px-3 py-1 font-display text-sm font-black text-course">
                    {formatPrice(c.price_cents, c.currency)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
