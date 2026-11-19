"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/types";
import { updateProfile } from "../actions";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfile, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Nome" htmlFor="fullName" error={state.fieldErrors?.fullName?.[0]} hint="Aparece no ranking da turma.">
        <Input id="fullName" name="fullName" defaultValue={fullName} required maxLength={80} autoComplete="name" />
      </Field>
      <Field
        label="E-mail"
        htmlFor="email"
        aside={
          <Link href="/recuperar-senha" className="text-sm font-semibold text-brand hover:underline">
            Trocar senha
          </Link>
        }
      >
        <Input id="email" value={email} disabled readOnly className="bg-canvas text-muted" />
      </Field>
      <FormMessage state={state} />
      <div>
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}
