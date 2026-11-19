"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return h.get("origin") ?? "http://localhost:3000";
}

const email = z.string().trim().toLowerCase().email("Digite um e-mail válido.").max(254);
const password = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
  .regex(/[0-9]/, "Use pelo menos um número.");

// Generic messages on purpose: never reveal whether an e-mail is registered.
function authErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Confira sua caixa de entrada.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Espere um pouco e tente de novo.";
    case "weak_password":
      return "Essa senha é fraca demais. Tente uma mais forte.";
    default:
      return "Não foi possível concluir agora. Tente novamente.";
  }
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Digite sua senha.").max(72) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.code) };

  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Conta pra gente seu nome.").max(120),
      email,
      password,
      terms: z.literal("on", { error: "Aceite os termos para continuar." }),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      terms: formData.get("terms"),
    });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/app`,
    },
  });
  if (error) return { error: authErrorMessage(error.code) };

  if (data.session) redirect("/app");
  return {
    ok: true,
    message: "Conta criada! Enviamos um link de confirmação para o seu e-mail.",
  };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?erro=oauth");
  redirect(data.url);
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: ["Digite um e-mail válido."] } };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/nova-senha`,
  });
  return {
    ok: true,
    message: "Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.",
  };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Seu link expirou. Peça um novo link de recuperação." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error.code) };
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
