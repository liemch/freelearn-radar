import { logger } from "@/lib/logger";
import { getServerEnv } from "@/lib/env";

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  /** RFC 8058 one-click unsubscribe; required for good inbox placement. */
  listUnsubscribeUrl?: string;
};

export type EmailSendResult = {
  ok: boolean;
  id?: string;
  dryRun?: boolean;
  error?: string;
};

export interface EmailProvider {
  sendEmail(input: EmailInput): Promise<EmailSendResult>;
}

export class DryRunEmailProvider implements EmailProvider {
  async sendEmail(input: EmailInput): Promise<EmailSendResult> {
    logger.info("email.dry_run", {
      to: input.to,
      subject: input.subject,
      tags: input.tags ?? [],
      textPreview: (input.text ?? input.html).slice(0, 200),
    });
    return { ok: true, dryRun: true, id: `dry-run-${Date.now()}` };
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly timeoutMs: number,
    private readonly replyTo: string | null = null,
  ) {}

  async sendEmail(input: EmailInput): Promise<EmailSendResult> {
    // Every other outbound dependency is bounded; a hung connection here would
    // otherwise hold the monitor cron until the platform kills it.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          ...(this.replyTo ? { reply_to: this.replyTo } : {}),
          subject: input.subject,
          html: input.html,
          text: input.text,
          tags: input.tags?.map((name) => ({ name })),
          ...(input.listUnsubscribeUrl
            ? {
                headers: {
                  "List-Unsubscribe": `<${input.listUnsubscribeUrl}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          ok: false,
          error: `Resend ${response.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await response.json()) as { id?: string };
      return { ok: true, id: data.id };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error && error.name === "AbortError"
            ? `Resend timed out after ${this.timeoutMs}ms`
            : error instanceof Error
              ? error.message
              : "send failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const env = getServerEnv();
  const dryRun =
    env.EMAIL_DRY_RUN === "true" ||
    env.EMAIL_DRY_RUN === "1" ||
    !env.RESEND_API_KEY;

  if (dryRun) {
    cached = new DryRunEmailProvider();
    return cached;
  }

  const from = env.EMAIL_FROM || "alerts@freelearnradar.com";
  cached = new ResendEmailProvider(
    env.RESEND_API_KEY,
    from,
    env.EMAIL_REQUEST_TIMEOUT_MS,
    env.EMAIL_REPLY_TO || null,
  );
  return cached;
}

export function resetEmailProviderCache(): void {
  cached = null;
}
