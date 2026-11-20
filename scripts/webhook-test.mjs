// Sends a correctly signed `checkout.session.completed` event to the local webhook,
// exactly like `stripe trigger` would. Usage:
//   node --env-file=.env.local scripts/webhook-test.mjs <courseId> <userId> [amountCents]
import Stripe from "stripe";

const [courseId, userId, amount = "4990"] = process.argv.slice(2);
const secret = process.env.STRIPE_WEBHOOK_SECRET;
const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/stripe";
if (!courseId || !userId || !secret) {
  console.error("uso: STRIPE_WEBHOOK_SECRET=... node scripts/webhook-test.mjs <courseId> <userId> [amountCents]");
  process.exit(1);
}

const sessionId = `cs_test_${Date.now()}`;
const payload = JSON.stringify({
  id: `evt_test_${Date.now()}`,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: sessionId,
      object: "checkout.session",
      payment_status: "paid",
      amount_total: Number(amount),
      currency: "brl",
      payment_intent: `pi_test_${Date.now()}`,
      client_reference_id: userId,
      metadata: { course_id: courseId, user_id: userId },
    },
  },
});

const stripe = new Stripe("sk_test_unused");
const header = stripe.webhooks.generateTestHeaderString({ payload, secret });

const send = (sig) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body: payload }).then(
    async (r) => `${r.status} ${await r.text()}`,
  );

console.log("assinatura falsa  →", await send("t=1,v1=deadbeef"));
console.log("assinatura válida →", await send(header));
console.log("reenvio (idempot.)→", await send(header));
console.log("session:", sessionId);
