import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe → Curso On. The signature check is the only trust boundary here:
// paid enrollments come exclusively from verified, paid checkout sessions.
// Every handler is idempotent, so Stripe retries are safe.

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook não configurado.", { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return new Response("Assinatura inválida.", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status === "paid") await fulfill(session);
        break;
      }
      case "checkout.session.async_payment_failed":
        await recordPayment(event.data.object, "failed");
        break;
      case "charge.refunded": {
        const charge = event.data.object;
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intent && charge.refunded) await revoke(intent);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook]", event.type, err instanceof Error ? err.message : err);
    return new Response("Erro ao processar.", { status: 500 }); // Stripe tenta de novo.
  }

  return Response.json({ received: true });
}

function ids(session: Stripe.Checkout.Session) {
  const courseId = session.metadata?.course_id;
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  if (!courseId || !userId) throw new Error(`Sessão ${session.id} sem metadata.`);
  return { courseId, userId };
}

async function recordPayment(session: Stripe.Checkout.Session, status: "paid" | "failed") {
  const { courseId, userId } = ids(session);
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const { error } = await createAdminClient()
    .from("payments")
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: intent ?? null,
        amount_cents: session.amount_total ?? 0,
        currency: session.currency ?? "brl",
        status,
      },
      { onConflict: "stripe_checkout_session_id" },
    );
  if (error) throw error;
  return { courseId, userId };
}

async function fulfill(session: Stripe.Checkout.Session) {
  const { courseId, userId } = await recordPayment(session, "paid");
  const { error } = await createAdminClient()
    .from("enrollments")
    .upsert({ user_id: userId, course_id: courseId, source: "stripe" }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  if (error) throw error;
}

/** Refund: mark the payment and remove the access that came from it (progress stays). */
async function revoke(paymentIntent: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntent)
    .select("user_id, course_id");
  if (error) throw error;
  for (const p of data ?? []) {
    const { error: e } = await admin.from("enrollments").delete().eq("user_id", p.user_id).eq("course_id", p.course_id).eq("source", "stripe");
    if (e) throw e;
  }
}
