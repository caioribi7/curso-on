import type { Metadata } from "next";
import { TrophyIcon } from "@/components/icons/flat-icons";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/dal";
import { isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pagamento confirmado" };

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/sucesso">) {
  const user = await requireUser("/app/compras");
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]+$/.test(sp.session_id) ? sp.session_id : null;

  // Read-only confirmation. Access is granted by the webhook, never by this page.
  let slug: string | null = null;
  let paid = false;
  if (sessionId && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.metadata?.user_id === user.id) {
        paid = session.payment_status === "paid";
        const supabase = await createClient();
        const { data } = await supabase.from("courses").select("slug").eq("id", session.metadata.course_id ?? "").maybeSingle();
        slug = data?.slug ?? null;
      }
    } catch {
      // ignore: show the generic message
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-[32px] border border-line bg-white p-10 text-center">
      <TrophyIcon size={120} />
      <h1 className="text-[36px] font-black leading-tight">{paid ? "Compra confirmada!" : "Recebemos seu pedido"}</h1>
      <p className="text-lg text-muted">
        {paid
          ? "Seu acesso é liberado em instantes. Bora para a primeira aula?"
          : "Pagamentos via Pix podem levar alguns minutos. Avisamos assim que for confirmado."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {slug ? <ButtonLink href={`/app/cursos/${slug}`}>Ir para o curso</ButtonLink> : null}
        <ButtonLink href="/app/compras" variant="secondary">
          Minhas compras
        </ButtonLink>
      </div>
    </div>
  );
}
