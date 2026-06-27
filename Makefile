# スポともパーク 開発タスク（pnpm + Turborepo + Supabase ローカル）
# 使い方: `make help`
SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

SUPABASE := npx --yes supabase@latest

.PHONY: help install db-start db-stop db-reset env-local seed-dev up down dev build lint typecheck types check clean docker-build docker-up docker-down docker-logs

help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## 依存をインストール（pnpm）
	pnpm install

db-start: ## ローカル Supabase 起動（Docker・全マイグレーション+seed適用）
	$(SUPABASE) start

db-stop: ## ローカル Supabase 停止
	$(SUPABASE) stop

db-reset: ## DB を初期化して全マイグレーション+seed を再適用
	$(SUPABASE) db reset

env-local: ## ローカル Supabase のキーを apps/*/.env.local に書き出す
	bash scripts/write-local-env.sh

seed-dev: ## 開発用サンプルデータ（ユーザ/施設/募集）を投入（冪等）
	bash scripts/dev-seed.sh

up: db-start env-local seed-dev ## DB起動→env生成→サンプル投入をまとめて実行
	@echo "準備完了。'make dev' で全 app を起動できます。"

down: db-stop ## ローカル環境を停止
	-pkill -f "next dev" 2>/dev/null || true

dev: ## 全 app の開発サーバを起動（turbo, :3000-3006）
	pnpm dev

build: ## 全 app をビルド（型チェック込み）
	pnpm build

lint: ## ESLint
	pnpm lint

typecheck: ## 型チェック
	pnpm typecheck

types: ## Supabase から型生成（要 supabase link）
	pnpm db:types

check: lint typecheck build ## CI 相当の検証をローカルで実行

clean: ## ビルド成果物を削除
	find . -name '.next' -type d -prune -exec rm -rf {} + ; \
	find . -name '.turbo' -type d -prune -exec rm -rf {} +

# ---- 自前サーバ / EC2（Docker）----
docker-build: ## 全 app の本番イメージをビルド（docker compose）
	docker compose build

docker-up: ## コンテナ起動（7 app + Caddy）。本番・開発共通。要 .env.production + docker/certs
	docker compose up -d --build

docker-down: ## コンテナ停止
	docker compose down

docker-logs: ## ログ追従（make docker-logs s=golf で個別）
	docker compose logs -f $(s)

# ---- リリース / EC2 デプロイ（build → save → ship → deploy）----
# 例: make release EC2_HOST=ec2-18-181-207-71.ap-northeast-1.compute.amazonaws.com \
#                  EC2_KEY=~/.ssh/lykuro-prod-key.pem
# ローカルで本番イメージをビルド → tar.gz に save → EC2 へ scp → EC2 上で load → up -d。
# 前提: EC2 の $(EC2_DIR) に docker-compose.yml / .env.production / data/ が配置済み（イメージのみ転送）。
EC2_HOST     ?=
EC2_USER     ?= ubuntu
EC2_KEY      ?= ~/.ssh/lykuro-prod-key.pem
EC2_DIR      ?= /data/spotomo
REL_SERVICES ?= web admin scheduler
REL_IMAGES   := $(addprefix spotomo-,$(REL_SERVICES))
REL_TAR      := spotomo-images.tar.gz
SSH_OPTS     := -i $(EC2_KEY) -o StrictHostKeyChecking=accept-new

.PHONY: release release-build release-save release-ship release-deploy _require-ec2

release: release-build release-save release-ship release-deploy ## EC2 へリリース（build→save→ship→deploy）。要 EC2_HOST EC2_KEY
	@echo "✅ リリース完了: $(EC2_USER)@$(EC2_HOST):$(EC2_DIR)"

release-build: ## [release] web/admin/scheduler の本番イメージをビルド
	docker compose build $(REL_SERVICES)

release-save: ## [release] イメージを $(REL_TAR) に保存（gzip）
	docker save $(REL_IMAGES) | gzip > $(REL_TAR)

release-ship: _require-ec2 ## [release] tar を EC2:$(EC2_DIR) へ転送
	scp $(SSH_OPTS) $(REL_TAR) $(EC2_USER)@$(EC2_HOST):$(EC2_DIR)/

release-deploy: _require-ec2 ## [release] EC2 で load → up -d（web/admin/scheduler のみ）→ 古いイメージ掃除
	# caddy は本番では使わない（:80 を lykuro-nginx と競合）。必ず $(REL_SERVICES) に限定して up する。
	ssh $(SSH_OPTS) $(EC2_USER)@$(EC2_HOST) \
	  'cd $(EC2_DIR) && gunzip -c $(REL_TAR) | docker load && docker compose up -d $(REL_SERVICES) && rm -f $(REL_TAR) && docker image prune -f'

_require-ec2:
	@test -n "$(EC2_HOST)" || { echo "EC2_HOST が未設定です（例: make release EC2_HOST=... EC2_KEY=...）"; exit 1; }

release-sh: ## EC2 へ一括リリース（本番ホスト既定値入り・ヘルスチェック付き。scripts/release.sh）
	./scripts/release.sh
