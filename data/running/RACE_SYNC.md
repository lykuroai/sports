# マラソン大会データの定期取り込み（race sync）

未来日（開催日 ≥ 当日）のマラソン大会データを公式API/許諾フィードから定期取得し、
`running.races` と `(source, source_id)` で照合して **新規は追加・既存は更新**する。

- エンドポイント: `running` アプリの `POST|GET /api/cron/sync-races`
- 取り込みロジック: `apps/running/lib/race-sync.ts`
- 認可: ヘッダ `Authorization: Bearer $CRON_SECRET`（または `x-cron-secret: $CRON_SECRET`）
- 実行: サービスロール（RLS バイパス）。`SUPABASE_SERVICE_ROLE_KEY` 必須。

> 継続的な自動取得は **利用規約・robots.txt の順守が前提**（CLAUDE.md §6.6）。
> 出所は公式API、または主催者/JAAF 等から許諾を得たフィードに限る。
> 許可のないサイトの継続スクレイピングは行わない。

## 必要な環境変数（`.env.example` 参照）

| 変数 | 説明 |
|------|------|
| `RACE_FEED_URL` | フィードURL。JSON 配列 / `{races:[...]}` / `{data:[...]}` のいずれか |
| `RACE_FEED_KEY` | フィード認証が要る場合の Bearer トークン（任意） |
| `RACE_FEED_SOURCE` | 取り込み行の `source` 値（既定 `feed`。Wikipedia 由来と区別） |
| `CRON_SECRET` | cron 起動を認可する共有シークレット |

## フィード各要素のキー（緩く吸収）

`source_id`|`id`、`name`|`title`、`prefecture`、`city`、
`event_date`|`date`|`held_on`（`YYYY-MM-DD`）、`website_url`|`url`、`latitude`、`longitude`。

`source_id` と `name` は必須。`event_date` が未来日の行のみ取り込む。

## 照合・更新の挙動

1. フィードを取得し未来日のみ抽出。
2. `running.races` の同一 `source` の既存行を `source_id` で索引。
3. 既存に無ければ **insert**、あれば内容差分があるもののみ **update**（`last_synced_at` を更新）。
4. レスポンスに件数を返す: `{ fetched, future, inserted, updated, unchanged }`。

## スケジュール例

本番は同一 Mac の docker 運用。外部 cron（または Supabase pg_cron）から日次で叩く。

```bash
# 例: 毎日 04:00 に実行（crontab -e）
0 4 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://<running の公開URL>/api/cron/sync-races >> /var/log/race-sync.log 2>&1
```

Supabase pg_cron を使う場合は `net.http_post` で同URLを叩き、ヘッダに同シークレットを付与する。

## 手元での疎通確認

```bash
RACE_FEED_URL=... RACE_FEED_KEY=... CRON_SECRET=dev \
  curl -X POST -H "Authorization: Bearer dev" http://localhost:3000/api/cron/sync-races
```
