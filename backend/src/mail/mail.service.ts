import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { MailConfig } from '../config/configuration';

/**
 * Outbound email. DECISION: the transport is chosen at runtime from config so
 * local development needs zero external services. When SMTP_HOST is set we send
 * via nodemailer; otherwise we fall back to a "dev" transport that just logs the
 * message (the verification code lands in `npm run backend:logs`). This keeps the
 * verification flow fully exercisable offline while staying production-ready.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly cfg: MailConfig;
  private transporter: Transporter | null = null;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<MailConfig>('mail');
  }

  async onModuleInit(): Promise<void> {
    if (!this.cfg.smtpHost) {
      this.logger.warn(
        'SMTP not configured — emails will be logged to the console (dev mode).',
      );
      return;
    }
    // Imported lazily so the dependency is only loaded when SMTP is actually used.
    const nodemailer = await import('nodemailer');
    this.transporter = nodemailer.createTransport({
      host: this.cfg.smtpHost,
      port: this.cfg.smtpPort,
      secure: this.cfg.smtpSecure,
      auth: this.cfg.smtpUser
        ? { user: this.cfg.smtpUser, pass: this.cfg.smtpPass }
        : undefined,
    });
    this.logger.log(`SMTP transport ready (${this.cfg.smtpHost}).`);
  }

  /** Send an email-verification code to the given address. */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    const subject = 'Код подтверждения EPTA';
    const text = `Ваш код подтверждения: ${code}\nКод действует ограниченное время. Если вы не регистрировались в EPTA — просто проигнорируйте это письмо.`;

    if (!this.transporter) {
      // Dev transport: never log full PII-laden bodies in prod, but in dev the
      // code MUST be visible so the flow is testable without a real inbox.
      this.logger.log(`[DEV MAIL] To: ${to} | Код подтверждения: ${code}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.cfg.from,
      to,
      subject,
      text,
    });
  }
}
