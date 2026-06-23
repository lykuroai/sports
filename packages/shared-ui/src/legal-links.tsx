/**
 * フッタ用の法務ページリンク。法務ページは web ルート（NEXT_PUBLIC_SITE_URL）に集約するため、
 * 種目アプリ等からは baseUrl に web の絶対URLを渡す。web 自身は baseUrl 未指定で相対リンク。
 */
export function LegalLinks({ baseUrl = "" }: { baseUrl?: string }) {
  const links = [
    { href: `${baseUrl}/terms`, label: "利用規約" },
    { href: `${baseUrl}/privacy`, label: "プライバシーポリシー" },
    { href: `${baseUrl}/legal`, label: "特定商取引法に基づく表記" },
  ];
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((l) => (
        <a key={l.href} href={l.href} className="hover:text-brand hover:underline">
          {l.label}
        </a>
      ))}
    </nav>
  );
}
