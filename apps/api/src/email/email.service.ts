import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendOtpEmailInput {
  to: string;
  code: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: 'console' | 'resend';
  private readonly from: string;
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    this.transport = (this.config.get<string>('EMAIL_TRANSPORT') ?? 'console') as
      | 'console'
      | 'resend';
    this.from = this.config.get<string>('MAIL_FROM') ?? 'Yap <onboarding@resend.dev>';
    this.resend =
      this.transport === 'resend' ? new Resend(this.config.get<string>('RESEND_API_KEY')) : null;
  }

  async sendOtp({ to, code }: SendOtpEmailInput): Promise<void> {
    if (this.transport === 'console') {
      this.logger.log(`[OTP] ${to} → ${code}`);
      return;
    }

    if (!this.resend) throw new Error('Resend client not initialized');

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: `Your Yap login code: ${code}`,
      text: `Your one-time code is: ${code}\n\nIt expires in 10 minutes.`,
    });

    if (error) {
      this.logger.error(`Resend send failed: ${error.message}`);
      throw new Error(`Failed to send OTP email: ${error.message}`);
    }
  }
}
