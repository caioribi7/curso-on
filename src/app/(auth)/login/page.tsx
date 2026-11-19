import type { Metadata } from "next";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const linkError = typeof params.erro === "string";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[44px] font-black leading-[48px] tracking-[-0.03em]">Bora estudar?</h1>
        <p className="text-[17px] leading-[26px] text-muted">
          Entre na sua conta e continue de onde parou. Sua sequência está te esperando.
        </p>
      </header>
      <LoginForm next={next} linkError={linkError} />
    </div>
  );
}
