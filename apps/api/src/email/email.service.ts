import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendOtpEmailInput {
  to: string;
  code: string;
}

export interface SendAccessApprovedInput {
  to: string;
  displayName?: string | null;
}

export interface SendAccessRequestedInput {
  requesterEmail: string;
  displayName?: string | null;
}

export interface SendAddedToGroupInput {
  to: string;
  displayName?: string | null;
  groupName?: string | null;
  addedByName?: string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: 'console' | 'resend';
  private readonly from: string;
  private readonly resend: Resend | null;
  private readonly adminEmail: string;
  private readonly webOrigin: string;

  constructor(private readonly config: ConfigService) {
    this.transport = (this.config.get<string>('EMAIL_TRANSPORT') ?? 'console') as
      | 'console'
      | 'resend';
    this.from = this.config.get<string>('MAIL_FROM') ?? 'Yap <onboarding@resend.dev>';
    this.resend =
      this.transport === 'resend' ? new Resend(this.config.get<string>('RESEND_API_KEY')) : null;
    this.adminEmail = this.config.get<string>('ADMIN_EMAIL') ?? 'admin@example.com';
    this.webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  async sendOtp({ to, code }: SendOtpEmailInput): Promise<void> {
    await this.send(to, `Your Yap login code: ${code}`, `Your one-time code is: ${code}\n\nIt expires in 10 minutes.`);
  }

  // Tells an approved person they can now sign in.
  async sendAccessApproved({ to, displayName }: SendAccessApprovedInput): Promise<void> {
    const hi = displayName ? `Hi ${displayName},` : 'Hi,';
    await this.send(
      to,
      `You're in — welcome to Yap`,
      `${hi}\n\nYour access to Yap has been approved. Sign in here:\n${this.webOrigin}\n\nSee you inside!`,
    );
  }

  // Notifies the admin that someone requested access.
  async sendAccessRequested({ requesterEmail, displayName }: SendAccessRequestedInput): Promise<void> {
    const who = displayName ? `${displayName} (${requesterEmail})` : requesterEmail;
    await this.send(
      this.adminEmail,
      `New Yap access request: ${requesterEmail}`,
      `${who} requested access to Yap.\n\nApprove or deny it from the admin panel:\n${this.webOrigin}`,
    );
  }

  async sendAddedToGroup({ to, displayName, groupName, addedByName }: SendAddedToGroupInput): Promise<void> {
    const hi = displayName ? `Hi ${displayName},` : 'Hi,';
    const actor = addedByName ?? 'Someone';
    const groupLabel = groupName ? `“${groupName}”` : 'a group';
    await this.send(
      to,
      `You were added to ${groupName ?? 'a group'} on Yap`,
      `${hi}\n\n${actor} added you to ${groupLabel} on Yap. Open it here:\n${this.webOrigin}`,
    );
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    if (this.transport === 'console') {
      this.logger.log(`[EMAIL] to=${to} :: ${subject}\n${text}`);
      return;
    }

    if (!this.resend) throw new Error('Resend client not initialized');

    const { error } = await this.resend.emails.send({ from: this.from, to, subject, text });

    if (error) {
      this.logger.error(`Resend send failed: ${error.message}`);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
