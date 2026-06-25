# 定期バッチ用スケジューラ（統合サイト化 Phase 3）。
# busybox crond で web の cron ルートを内部ネットワーク経由で叩く。
# secret は env_file(.env.production) から受け取り、起動時に crontab へ埋め込む
# （busybox crond のジョブ環境変数伝播に依存しないため）。
FROM alpine:3.20
RUN apk add --no-cache curl tzdata jq
ENV TZ=Asia/Tokyo
COPY docker/scheduler/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
