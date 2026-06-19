import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, cookieOptions } from "./env";

/**
 * サーバーコンポーネント／Server Actions／Route Handlers 用クライアント。
 * Cookie を介してセッションを共有する（@supabase/ssr）。サブドメイン間で
 * Cookie を共有するため、本番では Cookie ドメインを `.spotomo-park.jp` に設定する。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookieOptions: cookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component から呼ばれた場合は set 不可。proxy/middleware がセッション更新を担う。
        }
      },
    },
  });
}
