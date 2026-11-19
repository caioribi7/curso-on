"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { publicEnv, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const uuid = z.string().uuid();

export async function enrollFree(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const slug = z.string().regex(/^[a-z0-9-]+$/).parse(formData.get("slug"));
  await requireUser(`/cursos/${slug}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_free", { p_course: courseId });
  if (error) redirect(`/cursos/${slug}?erro=matricula`);
  revalidatePath("/app");
  redirect(`/app/cursos/${slug}`);
}

/** Creates a Stripe Checkout Session. Price always comes from the database, never the form. */
export async function startCheckout(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const user = await requireUser();
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, subtitle, price_cents, currency, status")
    .eq("id", courseId)
    .eq("status", "published")
    .maybeSingle();
  if (!course) redirect("/cursos");
  if (course.price_cents <= 0) redirect(`/cursos/${course.slug}`);
  if (!isStripeConfigured()) redirect(`/cursos/${course.slug}?erro=pagamento`);

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", course.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/app/cursos/${course.slug}`);

  const site = publicEnv.siteUrl();
  let session: Awaited<ReturnType<ReturnType<typeof getStripe>["checkout"]["sessions"]["create"]>>;
  try {
    session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email || undefined,
    client_reference_id: user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: course.currency,
          unit_amount: course.price_cents,
          product_data: { name: course.title, description: course.subtitle || undefined },
        },
      },
    ],
    metadata: { course_id: course.id, user_id: user.id },
    payment_intent_data: { metadata: { course_id: course.id, user_id: user.id } },
    success_url: `${site}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/cursos/${course.slug}?checkout=cancelado`,
    locale: "pt-BR",
    });
  } catch (err) {
    console.error("[checkout]", err instanceof Error ? err.message : err);
    redirect(`/cursos/${course.slug}?erro=pagamento`);
  }
  if (!session.url) redirect(`/cursos/${course.slug}?erro=pagamento`);
  redirect(session.url);
}

export async function completeLesson(formData: FormData) {
  const lessonId = uuid.parse(formData.get("lessonId"));
  const slug = z.string().regex(/^[a-z0-9-]+$/).parse(formData.get("slug"));
  const nextLesson = z.union([uuid, z.literal("")]).parse(formData.get("nextLessonId") ?? "");
  await requireUser();
  const supabase = await createClient();
  const { data: gained, error } = await supabase.rpc("complete_lesson", { p_lesson: lessonId });
  if (error) redirect(`/app/cursos/${slug}`);
  revalidatePath(`/app/cursos/${slug}`);
  revalidatePath("/app");
  const xp = typeof gained === "number" ? gained : 0;
  redirect(
    nextLesson
      ? `/app/cursos/${slug}/aulas/${nextLesson}?xp=${xp}`
      : `/app/cursos/${slug}?concluida=1&xp=${xp}`,
  );
}

export type AnswerState = {
  error?: string;
  result?: { isCorrect: boolean; correctOptionId: string; explanation: string; xpGained: number; chosen: string };
};

export async function answerQuestion(_prev: AnswerState, formData: FormData): Promise<AnswerState> {
  const q = uuid.safeParse(formData.get("questionId"));
  const o = uuid.safeParse(formData.get("optionId"));
  if (!q.success) return { error: "Questão inválida." };
  if (!o.success) return { error: "Escolha uma alternativa." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("answer_question", { p_question: q.data, p_option: o.data });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { error: "Não foi possível registrar sua resposta." };
  revalidatePath("/app");
  return {
    result: {
      isCorrect: row.is_correct,
      correctOptionId: row.correct_option_id,
      explanation: row.explanation ?? "",
      xpGained: row.xp_gained ?? 0,
      chosen: o.data,
    },
  };
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Digite seu nome.").max(80) })
    .safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil atualizado." };
}
