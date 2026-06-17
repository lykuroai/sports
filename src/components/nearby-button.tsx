"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 仕様 §6.5: 「現在地周辺」は施設検索の補助機能。
// ブラウザの位置情報を取得し、緯度経度付きで検索画面に遷移する。
export function NearbyButton({ radius = 5000 }: { radius?: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="btn-outline"
      disabled={loading}
      onClick={() => {
        if (!navigator.geolocation) {
          alert("お使いのブラウザは位置情報に対応していません。");
          return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            router.push(`/facilities?lat=${latitude}&lng=${longitude}&radius=${radius}`);
          },
          () => {
            setLoading(false);
            alert("位置情報を取得できませんでした。");
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }}
    >
      {loading ? "取得中..." : "📍 現在地周辺"}
    </button>
  );
}
