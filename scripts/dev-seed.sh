#!/usr/bin/env bash
# ローカル開発用のサンプルデータ投入（冪等）。
# テストユーザ・施設・golf 募集を作成し、画面確認をしやすくする。
# 本番 seed.sql には含めない（auth.users が必要なため admin API 経由）。
set -euo pipefail
cd "$(dirname "$0")/.."

STATUS=$(npx --yes supabase@latest status -o env 2>/dev/null)
URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
SVC=$(echo "$STATUS" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
[ -n "$URL" ] || { echo "ローカル Supabase 未起動。make db-start を先に。" >&2; exit 1; }

H_SVC=(-H "apikey: $SVC" -H "Authorization: Bearer $SVC")
EMAIL="taro@example.com"

echo "» テストユーザ ($EMAIL / password123)"
curl -s "$URL/auth/v1/admin/users" "${H_SVC[@]}" -H "Content-Type: application/json" \
  -d '{"email":"'"$EMAIL"'","password":"password123","email_confirm":true,"user_metadata":{"nickname":"ゴルフ太郎"}}' >/dev/null || true
OWNER=$(curl -s "$URL/rest/v1/users?select=id&email=eq.$EMAIL" "${H_SVC[@]}" -H "Accept-Profile: account" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')")
[ -n "$OWNER" ] || { echo "ユーザ取得失敗" >&2; exit 1; }
echo "  owner=$OWNER"

echo "» 施設"
FAC_CNT=$(curl -s "$URL/rest/v1/facilities?select=id&name=eq.青葉ゴルフクラブ" "${H_SVC[@]}" -H "Accept-Profile: facility" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
if [ "$FAC_CNT" = "0" ]; then
  curl -s -o /dev/null "$URL/rest/v1/facilities" "${H_SVC[@]}" -H "Content-Type: application/json" -H "Content-Profile: facility" \
    -d '{"name":"青葉ゴルフクラブ","facility_type":"ゴルフ場","prefecture":"千葉県","city":"市原市","address":"市原1-1"}'
  echo "  作成"
else echo "  既存（スキップ）"; fi

echo "» golf 募集"
EV_CNT=$(curl -s "$URL/rest/v1/events?select=id" "${H_SVC[@]}" -H "Accept-Profile: golf" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
if [ "$EV_CNT" = "0" ]; then
  SPORTID=$(curl -s "$URL/rest/v1/sports?select=id&slug=eq.golf" "${H_SVC[@]}" -H "Accept-Profile: core" | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
  curl -s -o /dev/null "$URL/rest/v1/events" "${H_SVC[@]}" -H "Content-Type: application/json" -H "Content-Profile: golf" \
    -d '{"organizer_id":"'"$OWNER"'","sport_id":"'"$SPORTID"'","title":"週末ラウンド募集（初心者歓迎）","description":"のんびり回りましょう。クラブ貸出あり。","prefecture":"千葉県","city":"市原市","event_start_at":"2026-07-20T08:00:00+09:00","capacity":4,"participation_fee":12000,"beginner_allowed":true,"approval_type":"approval","status":"open"}'
  curl -s -o /dev/null "$URL/rest/v1/events" "${H_SVC[@]}" -H "Content-Type: application/json" -H "Content-Profile: golf" \
    -d '{"organizer_id":"'"$OWNER"'","sport_id":"'"$SPORTID"'","title":"早朝スループレー","prefecture":"東京都","event_start_at":"2026-07-25T06:30:00+09:00","capacity":2,"participation_fee":15000,"beginner_allowed":false,"approval_type":"first_come","status":"open"}'
  echo "  2件作成"
else echo "  既存${EV_CNT}件（スキップ）"; fi

echo "完了。golf: http://localhost:3002 / facility: http://localhost:3005"
