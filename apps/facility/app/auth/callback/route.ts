import { NextResponse } from "next/server";
import { createServerClient } from "@spotomo/auth-client";
import { facilityOrigin } from "@/lib/stripe";

// メール確認（施設運営者登録）/ OAuth のコールバック。code を session に交換する。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const base = facilityOrigin() || origin;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/") ? `${base}${next}` : `${base}/owner`;
  const verify = searchParams.get("verify");

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (verify === "email") {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${base}/login?notice=verified`);
      }
      return NextResponse.redirect(dest);
    }
  }
  return NextResponse.redirect(`${base}/login?error=auth`);
}
