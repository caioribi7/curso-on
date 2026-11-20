import type { Metadata } from "next";
import { TrophyIcon } from "@/components/icons/flat-icons";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/dal";
import { isSalesEnabled } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pagamento" };

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/sucesso">) {
  const user = await requireUser("/app");
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]+$/.test(sp.session_id) ? sp.session_id : null;

  // Read-only confirmation. Access is granted by the webhook, never by this page.
  let slug: string | null = null;
  let paid = false;
  if (sessionId && isSalesEnabled()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.metadata?.user_id === user.id) {
        paid = session.payment_status === "paid";
        const supabase = await createClient();
        const { data } = await supabase.from("courses").select("slug").eq("id", session.metadata.course_id ?? "").maybeSingle();
        slug = data?.slug ?? null;
      }
    } catch {
      // Show the generic message.
    }
  }

  return (
    <div className="anim-in mx-auto flex max-w-xl flex-col items-center gap-5 rounded-card border border-line bg-surface p-10 text-center">
      <TrophyIcon size={120} />
      <h1 className="text-[36px] font-black leading-tight">{paid ? "Compra confirmada!" : "Recebemos seu pedido"}</h1>
      <p className="text-lg text-muted">
        {paid
          ? "Seu acesso libera em instantes. Bora para a primeira aula?"
          : "Pagamento por Pix pode levar alguns minutos. O curso aparece no seu início assim que for confirmado."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {slug ? <ButtonLink href={`/app/cursos/${slug}`}>Ir para o curso</ButtonLink> : null}
        <ButtonLink href="/app" variant="secondary">
          Meu início
        </ButtonLink>
      </div>
    </div>
  );
}
