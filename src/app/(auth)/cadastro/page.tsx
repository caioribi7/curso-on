import type { Metadata } from "next";
import { SignUpForm } from "../forms";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[44px] font-black leading-[48px] tracking-[-0.03em]">Crie sua conta</h1>
        <p className="text-[17px] leading-[26px] text-muted">
          Estude, ganhe XP e, quando quiser, publique o seu próprio curso.
        </p>
      </header>
      <SignUpForm next={next} />
    </div>
  );
}
