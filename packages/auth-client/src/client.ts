import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, cookieOptions } from "./env";

/** クライアントコンポーネント用の Supabase クライアント（共通認証）。 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookieOptions: cookieOptions(),
  });
}
