import type { Metadata } from "next";
import { ForgotPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[40px] font-black leading-[44px] tracking-[-0.03em]">Esqueceu a senha?</h1>
        <p className="text-[17px] leading-[26px] text-muted">
          Sem estresse. Mandamos um link para você criar uma nova.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
