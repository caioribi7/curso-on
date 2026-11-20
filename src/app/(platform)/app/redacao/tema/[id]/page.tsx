import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MotivatingText } from "@/components/redacao/essay-ui";
import { requireUser } from "@/lib/dal";
import { getTheme } from "@/lib/redacao";
import { courseThemeVars } from "@/lib/utils";
import { EssayForm } from "./essay-form";

export const metadata: Metadata = { title: "Escrever redação" };

export default async function ThemePage({ params }: PageProps<"/app/redacao/tema/[id]">) {
  const { id } = await params;
  await requireUser(`/app/redacao/tema/${id}`);
  const theme = /^[0-9a-f-]{36}$/i.test(id) ? await getTheme(id) : null;
  if (!theme || !theme.is_open) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" style={courseThemeVars(theme.course?.theme_color ?? "#3B5BFD")}>
      <Link href="/app/redacao" className="self-start rounded-full px-3 py-1.5 font-display text-sm font-extrabold text-muted hover:bg-surface hover:text-ink">
        ← Redação
      </Link>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-[100px]">
          <MotivatingText title={theme.title} text={theme.motivating_text} instructions={theme.instructions} />
        </div>
        <EssayForm themeId={theme.id} />
      </div>
    </div>
  );
}
