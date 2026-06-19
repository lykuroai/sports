export { createClient as createBrowserClient } from "./client";
export { createClient as createServerClient } from "./server";
export { createAdminClient } from "./admin";
export * from "./auth";
export * from "./env";
// middleware は next/server に依存するため "./middleware" サブパスから読む
