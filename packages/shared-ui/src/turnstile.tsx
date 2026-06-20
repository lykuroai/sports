"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile ウィジェット。フォーム内に置くと、検証トークンを
 * hidden input `cf-turnstile-response` として送出する。Server Action 側は
 * `verifyTurnstile(formData.get("cf-turnstile-response"))` で検証する。
 *
 * siteKey 未指定（NEXT_PUBLIC_TURNSTILE_SITE_KEY 未設定）なら何も描画しない。
 * 鍵が無い開発環境でフォームを壊さないため。
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function Turnstile({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
}: {
  siteKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    function render() {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        "error-callback": () => setToken(""),
        "expired-callback": () => setToken(""),
      });
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (window.turnstile) {
      render();
    } else if (existing) {
      existing.addEventListener("load", render);
    } else {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.addEventListener("load", render);
      document.head.appendChild(s);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // ウィジェット破棄失敗は無視（アンマウント時のみ）
        }
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={ref} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </div>
  );
}
