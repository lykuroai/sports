import { type NextRequest } from "next/server";
import { updateSession } from "@spotomo/auth-client/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request, {
    protectedPrefixes: ["/mypage", "/events/new", "/profile", "/chat"],
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
