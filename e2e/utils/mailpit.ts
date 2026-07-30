import { request as playwrightRequest } from '@playwright/test';

/**
 * Mailpit helper (docs/e2e/00 §6). Reads verification / password-reset emails
 * from the dev SMTP catcher so email-dependent auth flows are deterministic and
 * never depend on a real mailbox.
 *
 * Mailpit HTTP API: GET /api/v1/messages (list), GET /api/v1/message/{id} (body).
 */

const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitSummary {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
  Created: string;
}

interface MailpitMessage {
  ID: string;
  Text: string;
  HTML: string;
}

/**
 * Poll Mailpit for the most recent message to `recipient` and return the first
 * link matching `linkPattern` (e.g. the verify or reset URL). Retries because
 * mail delivery is asynchronous.
 */
export async function getLinkFromEmail(
  recipient: string,
  linkPattern: RegExp,
  { timeoutMs = 15_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string> {
  const ctx = await playwrightRequest.newContext({ baseURL: MAILPIT_URL });
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const listRes = await ctx.get('/api/v1/messages?limit=50');
      if (listRes.ok()) {
        const { messages = [] } = (await listRes.json()) as { messages?: MailpitSummary[] };
        const match = messages.find((m) =>
          m.To.some((t) => t.Address.toLowerCase() === recipient.toLowerCase()),
        );
        if (match) {
          const msgRes = await ctx.get(`/api/v1/message/${match.ID}`);
          const msg = (await msgRes.json()) as MailpitMessage;
          const link = extractLink(`${msg.Text}\n${msg.HTML}`, linkPattern);
          if (link) {
            return link;
          }
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`No email to ${recipient} matching ${linkPattern} within ${timeoutMs}ms`);
  } finally {
    await ctx.dispose();
  }
}

function extractLink(content: string, pattern: RegExp): string | null {
  // Prefer an explicit URL matching the pattern; fall back to the raw pattern hit.
  const urls = content.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  return urls.find((u) => pattern.test(u)) ?? content.match(pattern)?.[0] ?? null;
}
