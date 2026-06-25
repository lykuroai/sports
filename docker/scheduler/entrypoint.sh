#!/bin/sh
# 起動時に CRON_SECRET を埋め込んだ crontab を生成して crond を前面実行する。
# 対象は内部ネットワークの web サービス（http://web:3000）。TLS/Caddy を経由しない。
set -e

: "${CRON_SECRET:?CRON_SECRET が未設定です（.env.production に設定してください）}"
: "${SCHED_TARGET:=http://web:3000}"

# 取り込み頻度（仕様: OSM 週1回 / マラソン大会 毎日〜週1回）。JST。
cat > /etc/crontabs/root <<EOF
# OSM(Overpass) 施設取り込み: 毎週月曜 03:10 JST
10 3 * * 1 curl -fsS -m 290 -H "x-cron-secret: ${CRON_SECRET}" "${SCHED_TARGET}/api/cron/sync-osm-facilities" >> /proc/1/fd/1 2>&1
# マラソン大会フィード取り込み: 毎日 03:30 JST（RACE_FEED_URL 未設定時はサーバ側で 500 を返すだけ）
30 3 * * * curl -fsS -m 290 -H "x-cron-secret: ${CRON_SECRET}" "${SCHED_TARGET}/api/cron/sync-races" >> /proc/1/fd/1 2>&1
EOF

echo "[scheduler] target=${SCHED_TARGET} crontab:"
cat /etc/crontabs/root
exec crond -f -l 8
