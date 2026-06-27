"use client";

import { usePathname } from "next/navigation";
import { CATEGORY_ICONS } from "../../lib/sport-icons";

// 種目明細ページ（/running, /sports/[code]）のときだけ、ヘッダのブランド「スポともパーク」の
// 前に種目絵文字を表示する。それ以外のページでは何も描画しない。
export function SportBrandEmoji() {
  const path = usePathname();
  let code: string | null = null;
  if (path === "/running") code = "running";
  else if (path.startsWith("/sports/")) code = path.split("/")[2] ?? null;

  const icon = code ? CATEGORY_ICONS[code] : undefined;
  if (!icon) return null;
  return (
    <span aria-hidden className="text-xl leading-none">
      {icon}
    </span>
  );
}
