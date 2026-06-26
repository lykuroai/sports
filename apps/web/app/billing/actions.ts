"use server";

import { redirect } from "next/navigation";
import { createServerClient, requireUser, selfOrigin, SCHEMA } from "@spotomo/auth-client";
import { getStripe, ensureBillingCustomer } from "@/lib/stripe";

/** プレミアム会員のサブスクを Stripe Checkout で開始する。 */
export async function startPremiumCheckout(): Promise<void> {
  const user = await requireUser("/billing");

  const supabase = await createServerClient();
  const { data: plan } = await supabase
    .schema(SCHEMA.account)
    .from("membership_plans")
    .select("id, stripe_price_id")
    .eq("code", "premium_member")
    .eq("is_active", true)
    .maybeSingle();
  if (!plan?.stripe_price_id) redirect("/billing?error=price_unset");

  const customerId = await ensureBillingCustomer(user.id, user.email ?? null);
  const origin = await selfOrigin();
  // user_id をサブスクの metadata に載せ、Webhook が user_subscriptions へ投影する。
  const meta = { user_id: user.id, plan_id: plan.id };

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/billing?success=1`,
    cancel_url: `${origin}/billing?canceled=1`,
    metadata: meta,
    subscription_data: { metadata: meta },
  });
  if (session.url) redirect(session.url);
  redirect("/billing?error=session");
}

/** Stripe カスタマーポータル（解約・支払い方法変更）。 */
export async function openPortal(): Promise<void> {
  const user = await requireUser("/billing");
  const customerId = await ensureBillingCustomer(user.id, user.email ?? null);
  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${accountOrigin()}/billing`,
  });
  redirect(portal.url);
}
