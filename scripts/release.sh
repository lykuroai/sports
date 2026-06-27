#!/usr/bin/env bash
# spotomo 本番リリースバッチ（build → save → ship → deploy → healthcheck）。
#
# 前提・方針:
#   - 本番は EC2 ec2-18-181-207-71（lykuro-prod-data-node, arm64/Graviton）。lk-* と同居。
#   - エッジは AWS ALB(TLS終端) → ホストの lykuro-nginx(:80) → host:3002(web)/3003(admin)。
#   - **caddy は起動しない**（:80 を lykuro-nginx と取り合うため、リリース対象から除外）。
#   - ローカル arm64 で本番イメージをビルド → tar.gz に save → scp → EC2 で load →
#     `web admin scheduler` のみ up -d（EC2 の docker-compose.yml + override が auto-load）。
#   - EC2 の $EC2_DIR には docker-compose.yml / docker-compose.override.yml / .env.production /
#     data/ が配置済み（イメージのみ転送する）。
#
# 使い方:
#   scripts/release.sh                 # 既定の本番ホストへリリース
#   SERVICES="web admin" scripts/release.sh   # 一部サービスのみ
#   EC2_HOST=other-host scripts/release.sh    # 別ホスト
#   DRY_RUN=1 scripts/release.sh        # 実行コマンドを表示するだけ
set -euo pipefail

# ---- 設定（環境変数で上書き可）----
EC2_HOST="${EC2_HOST:-ec2-18-181-207-71.ap-northeast-1.compute.amazonaws.com}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY="${EC2_KEY:-$HOME/.ssh/lykuro-prod-key.pem}"
EC2_DIR="${EC2_DIR:-/data/spotomo}"
SERVICES="${SERVICES:-web admin scheduler}"   # caddy は含めない
TAR="spotomo-images.tar.gz"
SSH_OPTS=(-i "$EC2_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)

cd "$(dirname "$0")/.."   # リポジトリルートへ

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
run()  { if [ "${DRY_RUN:-0}" = 1 ]; then printf '  [dry-run] %s\n' "$*"; else eval "$*"; fi; }

# ---- 0. preflight ----
log "preflight"
command -v docker >/dev/null || die "docker が見つからない"
docker compose version >/dev/null 2>&1 || die "docker compose v2 が必要"
[ -f "$EC2_KEY" ] || die "SSH 鍵が無い: $EC2_KEY"
[ -f .env.production ] || die ".env.production が無い（リポジトリルートで実行すること）"
# EC2 は arm64(Graviton)。ローカル arch が違うと load 後に exec format error になる。
case "$(uname -m)" in
  arm64|aarch64) : ;;
  *) [ "${ALLOW_CROSS_ARCH:-0}" = 1 ] \
       || die "ローカル($(uname -m)) が EC2(arm64) と不一致。buildx で arm64 を作る前提なら ALLOW_CROSS_ARCH=1 で続行" ;;
esac
echo "  host=$EC2_USER@$EC2_HOST dir=$EC2_DIR services='$SERVICES'"

REL_IMAGES=""; for s in $SERVICES; do REL_IMAGES="$REL_IMAGES spotomo-$s"; done

# ---- 1. build ----
log "build images: $SERVICES"
run "docker compose build $SERVICES"

# ---- 2. save ----
log "save →$REL_IMAGES → $TAR"
run "docker save$REL_IMAGES | gzip > '$TAR'"
[ "${DRY_RUN:-0}" = 1 ] || ls -lh "$TAR"

# ---- 3. ship ----
log "ship → $EC2_USER@$EC2_HOST:$EC2_DIR/"
run "scp ${SSH_OPTS[*]} '$TAR' '$EC2_USER@$EC2_HOST:$EC2_DIR/'"

# ---- 4. deploy（web/admin/scheduler のみ。caddy は起動しない）----
log "deploy on EC2: load → up -d $SERVICES → prune"
run "ssh ${SSH_OPTS[*]} '$EC2_USER@$EC2_HOST' \"cd '$EC2_DIR' && gunzip -c '$TAR' | docker load && docker compose up -d $SERVICES && rm -f '$TAR' && docker image prune -f\""

# ---- 5. ローカル tar 掃除 ----
run "rm -f '$TAR'"

# ---- 6. ヘルスチェック（nginx 経由で実オリジン Host を投げる）----
if [ "${DRY_RUN:-0}" != 1 ]; then
  log "healthcheck via lykuro-nginx（起動待ちのため最大 ~30s リトライ）"
  ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" '
    ok=0
    for i in $(seq 1 15); do
      w=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: spotomo.lykuro.ai"       http://127.0.0.1/login || echo 000)
      case "$w" in 200|301|302|307|308) ok=1; break ;; esac
      sleep 2
    done
    a=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: admin-spotomo.lykuro.ai" http://127.0.0.1/ || echo 000)
    echo "  web spotomo.lykuro.ai/login = $w   admin admin-spotomo.lykuro.ai/ = $a"
    [ "$ok" = 1 ] || { echo "  ⚠ web が異常応答: $w"; exit 1; }
  ' || die "ヘルスチェック失敗（nginx→spotomo の経路を確認）"
fi

log "✅ リリース完了: ${EC2_USER}@${EC2_HOST}:${EC2_DIR} （services: ${SERVICES}）"
