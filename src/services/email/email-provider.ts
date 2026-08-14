import { logger } from "@/lib/logger";
import { getServerEnv } from "@/lib/env";

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
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
  ) {}

  async sendEmail(input: EmailInput): Promise<EmailSendResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          tags: input.tags?.map((name) => ({ name })),
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
        error: error instanceof Error ? error.message : "send failed",
      };
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
  cached = new ResendEmailProvider(env.RESEND_API_KEY, from);
  return cached;
}

export function resetEmailProviderCache(): void {
  cached = null;
}
