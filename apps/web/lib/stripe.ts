import Stripe from "stripe";
import { createAdminClient, SCHEMA } from "@spotomo/auth-client";

let client: Stripe | null = null;

/** サーバー専用の Stripe クライアント。STRIPE_SECRET_KEY は制限付きキー推奨。 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY が設定されていません");
  client ??= new Stripe(key);
  return client;
}

/**
 * 共通ユーザの Stripe 顧客 ID を取得（無ければ作成）。決済顧客は共通基盤
 * account.billing_customers が保持する（施設運営者サブスク等と共用）。サービスロールで書く。
 */
export async function ensureBillingCustomer(userId: string, email: string | null): Promise<string> {
  const db = createAdminClient();
  const { data } = await db
    .schema(SCHEMA.account)
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    metadata: { user_id: userId },
  });
  await db
    .schema(SCHEMA.account)
    .from("billing_customers")
    .insert({ user_id: userId, stripe_customer_id: customer.id });
  return customer.id;
}
