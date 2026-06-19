import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * メール送信の薄いラッパー。Amazon SES（SESv2）を使用する。
 * AWS 認証情報（環境変数 or インスタンスロール）と FROM_ADDRESS が無ければログのみ（開発時 no-op）。
 * 別プロバイダに差し替える場合はこの関数のみ変更する。
 */
let _client: SESv2Client | null = null;
function sesClient(): SESv2Client {
  if (!_client) _client = new SESv2Client({ region: process.env.AWS_REGION ?? "ap-northeast-1" });
  return _client;
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const fromAddress = process.env.FROM_ADDRESS ?? process.env.EMAIL_FROM;
  const fromName = process.env.FROM_NAME;

  // SES 未設定（ローカル開発等）はメール送信をスキップしログ出力のみ。
  if (!fromAddress || !process.env.AWS_ACCESS_KEY_ID) {
    console.log(`[email skipped] to=${to} subject=${subject}`);
    return;
  }

  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  try {
    await sesClient().send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: text, Charset: "UTF-8" } },
          },
        },
      }),
    );
  } catch (e) {
    console.error("email send error", e);
  }
}
