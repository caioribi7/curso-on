"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/types";
import { requestPasswordReset, signIn, signInWithGoogle, signUp, updatePassword } from "./actions";

const initial: ActionState = {};

function err(state: ActionState, key: string) {
  return state.fieldErrors?.[key]?.[0];
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <div className="flex flex-col gap-7">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        {linkError && !state.error ? (
          <FormMessage state={{ error: "Esse link expirou ou já foi usado. Entre novamente." }} />
        ) : null}
        <FormMessage state={state} />
        <Field label="E-mail" htmlFor="email" error={err(state, "email")}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!err(state, "email")} />
        </Field>
        <Field
          label="Senha"
          htmlFor="password"
          error={err(state, "password")}
          aside={
            <Link href="/recuperar-senha" className="font-display text-sm font-bold text-brand hover:underline">
              Esqueci a senha
            </Link>
          }
        >
          <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!err(state, "password")} />
        </Field>
        <SubmitButton size="lg" className="mt-2 w-full" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </form>
      <OAuthBlock next={next} />
      <p className="text-center text-[15px] text-muted">
        Primeira vez aqui?{" "}
        <Link href={next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"} className="font-display font-extrabold text-brand hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, initial);
  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage state={state} />
        <Link href="/login" className="font-display font-extrabold text-brand hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-7">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <FormMessage state={state} />
        <Field label="Seu nome" htmlFor="fullName" error={err(state, "fullName")}>
          <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={!!err(state, "fullName")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={err(state, "email")}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!err(state, "email")} />
        </Field>
        <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números." error={err(state, "password")}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!err(state, "password")} />
        </Field>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="terms" className="mt-0.5 size-5 accent-[var(--course-primary)]" />
          <span>
            Li e aceito os Termos de Uso e a Política de Privacidade.
            {err(state, "terms") ? <span className="block font-semibold text-coral">{err(state, "terms")}</span> : null}
          </span>
        </label>
        <SubmitButton size="lg" className="mt-2 w-full" pendingText="Criando conta…">
          Criar conta
        </SubmitButton>
      </form>
      <OAuthBlock next={next} />
      <p className="text-center text-[15px] text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-display font-extrabold text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function OAuthBlock({ next }: { next?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-[13px] text-subtle">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <SubmitButton variant="secondary" size="lg" className="w-full" pendingText="Abrindo o Google…">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
            <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
            <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05" />
            <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335" />
          </svg>
          Continuar com Google
        </SubmitButton>
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="E-mail da conta" htmlFor="email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText="Enviando…">
        Enviar link
      </SubmitButton>
      <Link href="/login" className="text-center font-display font-extrabold text-brand hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres, com letras e números." error={err(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirme a nova senha" htmlFor="confirm" error={err(state, "confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingText="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
