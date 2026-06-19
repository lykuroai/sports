import Stripe from "stripe";

let client: Stripe | null = null;

/** サーバー専用の Stripe クライアント。STRIPE_SECRET_KEY は制限付きキー推奨。 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY が設定されていません");
  client ??= new Stripe(key);
  return client;
}

export const facilityOrigin = () =>
  process.env.NEXT_PUBLIC_FACILITY_URL ?? "http://localhost:3005";
