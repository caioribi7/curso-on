import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { NewPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nova senha" };

export default async function NewPasswordPage() {
  // The recovery link signs the user in; without a session there is nothing to update.
  await requireUser("/recuperar-senha");
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[40px] font-black leading-[44px] tracking-[-0.03em]">Crie uma nova senha</h1>
        <p className="text-[17px] leading-[26px] text-muted">Escolha uma senha forte que você ainda não usou aqui.</p>
      </header>
      <NewPasswordForm />
    </div>
  );
}
