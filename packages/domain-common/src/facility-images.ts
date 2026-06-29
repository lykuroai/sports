// 施設画像のURL解決（アップロードなし・URL方式）。
// 入力が画像URLならそのまま、HTMLページURLなら og:image / twitter:image を抽出して返す。
// 抽出できなければ null。管理者・承認済み運営者の操作からのみ呼ぶ前提（任意URLの取得）。

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
];

function resolveUrl(raw: string, base: string): string | null {
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

/**
 * URL を施設画像として使える画像URLに解決する。
 * - http(s) でなければ null。
 * - Content-Type が image/* ならその URL をそのまま採用。
 * - HTML なら og:image / twitter:image / image_src を抽出して絶対URL化。
 */
export async function resolveFacilityImageUrl(input: string): Promise<string | null> {
  const url = (input ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return null;

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": process.env.OSM_USER_AGENT || "Spotomo/1.0 (+https://spotomo.lykuro.ai)" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
  } catch {
    // 取得失敗時は、拡張子が画像っぽければそのまま採用（到達不能でも登録は許す）。
    return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url) ? url : null;
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.startsWith("image/")) return url;
  if (!ct.includes("html")) {
    return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url) ? url : null;
  }

  // HTML を先頭だけ読んで meta から抽出。
  let html = "";
  try {
    html = (await res.text()).slice(0, 200_000);
  } catch {
    return null;
  }
  for (const re of META_PATTERNS) {
    const m = html.match(re);
    if (m?.[1]) {
      const abs = resolveUrl(m[1], res.url || url);
      if (abs) return abs;
    }
  }
  return null;
}
