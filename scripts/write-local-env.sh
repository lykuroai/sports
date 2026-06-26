#!/usr/bin/env bash
# ローカル Supabase（supabase start）のキーを各 app の .env.local に書き出す。
# Next.js は app ディレクトリ直下の .env.local を読むため、apps/* それぞれに生成する。
set -euo pipefail
cd "$(dirname "$0")/.."

STATUS=$(npx --yes supabase@latest status -o env 2>/dev/null)
get() { echo "$STATUS" | grep "^$1=" | cut -d= -f2- | tr -d '"'; }

API_URL=$(get API_URL)
ANON=$(get ANON_KEY)
SVC=$(get SERVICE_ROLE_KEY)

if [ -z "${API_URL}" ] || [ -z "${ANON}" ]; then
  echo "ローカル Supabase が起動していません。先に 'make db-start' を実行してください。" >&2
  exit 1
fi

# 統合サイト化により web/admin のみ。単一オリジン運用のため ACCOUNT_URL/FACILITY_URL は空。
for a in web admin; do
  cat > "apps/$a/.env.local" <<EOF
# 自動生成（make env-local）。ローカル Supabase 用。コミットしないこと。
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}
SUPABASE_SERVICE_ROLE_KEY=${SVC}
NEXT_PUBLIC_ACCOUNT_URL=
NEXT_PUBLIC_FACILITY_URL=
EMAIL_FROM=no-reply@example.com
EOF
done
echo "apps/*/.env.local を生成しました（API: ${API_URL}）"
