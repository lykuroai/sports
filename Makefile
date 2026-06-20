# スポともパーク 開発タスク（pnpm + Turborepo + Supabase ローカル）
# 使い方: `make help`
SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

SUPABASE := npx --yes supabase@latest

.PHONY: help install db-start db-stop db-reset env-local seed-dev up down dev build lint typecheck types check clean docker-build docker-up docker-up-local docker-down docker-logs

# ローカル https 確認用の compose オーバーレイ（Caddy=tls internal / NEXT_PUBLIC_*）
COMPOSE_LOCAL := -f docker-compose.yml -f docker-compose.local.yml

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

docker-up: ## コンテナ起動（7 app + Caddy）。要 .env.production
	docker compose up -d --build

docker-up-local: ## ローカルhttps起動（tls internal / *-spotomo.lykuro.ai）。要 /etc/hosts
	docker compose $(COMPOSE_LOCAL) up -d --build

docker-down: ## コンテナ停止
	docker compose down

docker-logs: ## ログ追従（make docker-logs s=golf で個別）
	docker compose logs -f $(s)
