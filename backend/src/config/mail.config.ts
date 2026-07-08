import { registerAs } from '@nestjs/config';

/**
 * Outbound mail config (Mailpit in dev via `SMTP_URL`, real SMTP in prod).
 * `appUrl` is the frontend origin used to build verification/reset links.
 */
export const mailConfig = registerAs('mail', () => ({
  smtpUrl: process.env.SMTP_URL ?? 'smtp://localhost:1025',
  from: process.env.MAIL_FROM ?? 'Qalam <no-reply@qalam.example>',
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
}));
