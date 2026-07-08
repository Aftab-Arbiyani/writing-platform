import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { mailConfig } from '../config/mail.config';
import {
  passwordResetEmail,
  verificationEmail,
  type EmailContent,
} from './templates/auth-email.templates';

/**
 * Sends transactional auth email via SMTP (`SMTP_URL` — Mailpit in dev). Callers
 * invoke these **after** the DB transaction commits and do not await the result
 * on the request path (fire-and-forget): a mail outage must never fail
 * registration or leak — for forgot-password especially, the caller behaves
 * identically whether or not an email is sent (no account enumeration).
 *
 * TODO(aftab): move to the `emails` BullMQ queue when the notifications module
 * (E9) ships — email is async-by-design there (docs 02 queue catalogue). Direct
 * send keeps E1 free of the notifications module's queue infrastructure.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(mailConfig.KEY) private readonly config: ConfigType<typeof mailConfig>) {
    this.transporter = createTransport(this.config.smtpUrl);
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    await this.send(to, verificationEmail(this.config.appUrl, rawToken));
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    await this.send(to, passwordResetEmail(this.config.appUrl, rawToken));
  }

  private async send(to: string, content: EmailContent): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    } catch (error) {
      // Never throw to the caller — log and move on (see class doc).
      const message = error instanceof Error ? error.message : 'unknown mail error';
      this.logger.error(`Failed to send "${content.subject}": ${message}`);
    }
  }
}
