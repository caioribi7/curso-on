import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily-created Stripe client (server only; the secret key never reaches the browser). */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada.");
  client ??= new Stripe(key, { appInfo: { name: "Curso On", url: "https://github.com/caioribi7/curso-on" } });
  return client;
}
