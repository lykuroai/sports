import { createAdminClient, SCHEMA } from "@spotomo/auth-client";
import { getStripe } from "./stripe";

/**
 * 共通ユーザの Stripe 顧客 ID を取得（無ければ作成）。決済顧客は共通基盤
 * account.billing_customers が保持する（種目/施設をまたぐ）。サービスロールで書く。
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
