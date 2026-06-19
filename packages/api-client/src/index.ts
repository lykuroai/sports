/**
 * ドメイン別 API への型付き fetch クライアント。
 * 各 app の Route Handlers（`/api/<domain>/...`）を呼ぶための薄いラッパ。
 * golf を雛形とし、種目追加時は basePath と型のみ差し替える。
 */

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
    const json = res.headers.get("content-type")?.includes("application/json")
      ? await res.json()
      : null;
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (json as T) : null,
      error: res.ok ? undefined : (json?.error ?? res.statusText),
    };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: (e as Error).message };
  }
}

/** ドメイン（例: "golf"）向けのクライアントを生成する。 */
export function createDomainClient(basePath: string) {
  return {
    get: <T>(path: string) => request<T>("GET", `${basePath}${path}`),
    post: <T>(path: string, body?: unknown) => request<T>("POST", `${basePath}${path}`, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", `${basePath}${path}`, body),
    patch: <T>(path: string, body?: unknown) =>
      request<T>("PATCH", `${basePath}${path}`, body),
    del: <T>(path: string) => request<T>("DELETE", `${basePath}${path}`),
  };
}
