import { type NextRequest } from "next/server";
import { updateSession } from "@spotomo/auth-client/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request, {
    // 施設運営者の専用領域。未ログインは facility 内の運営者ログインへ誘導する。
    protectedPrefixes: ["/owner", "/submit"],
    loginPath: "/login",
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
