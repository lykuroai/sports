import Image from "next/image";

// next.config の remotePatterns に一致するホストのみ next/image（最適化）。
// 楽天の実画像ホストは不定のため、未許可ホストは素の img にフォールバックして
// 「hostname not configured」によるレンダリング例外でページ全体が落ちるのを防ぐ。
const ALLOWED_HOST = [/(^|\.)rakuten\.co\.jp$/i, /(^|\.)r10s\.jp$/i, /(^|\.)rakuten\.ne\.jp$/i, /(^|\.)supabase\.co$/i];

function isOptimizable(src: string): boolean {
  try {
    return ALLOWED_HOST.some((re) => re.test(new URL(src).hostname));
  } catch {
    return false;
  }
}

/** 親に relative＋サイズ指定のあるコンテナを置いて使う（fill レイアウト）。 */
export function CourseImage({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  if (isOptimizable(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" priority={priority} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />;
}
