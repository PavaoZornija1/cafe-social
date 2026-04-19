import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESEND_API = 'https://api.resend.com/emails';

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>('RESEND_API_KEY')?.trim());
  }

  /**
   * Transactional email via Resend. No-op when `RESEND_API_KEY` is unset.
   * Set `RESEND_FROM_EMAIL` to a verified domain sender (e.g. `Cafe Social <hello@yourdomain.com>`).
   */
  async send(params: {
    to: string;
    subject: string;
    html: string;
    tags?: { name: string; value: string }[];
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!apiKey) {
      this.log.debug('RESEND_API_KEY unset; skipping email');
      return;
    }

    const from =
      this.config.get<string>('RESEND_FROM_EMAIL')?.trim() ||
      'Cafe Social <onboarding@resend.dev>';

    try {
      const res = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          ...(params.tags?.length ? { tags: params.tags } : {}),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        this.log.warn(`Resend HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
    } catch (e) {
      this.log.warn(`Resend failed: ${(e as Error).message}`);
    }
  }

  async notifyFriendRequest(params: {
    toEmail: string;
    actorUsername: string;
    appUrl?: string;
  }): Promise<void> {
    if (!this.isConfigured()) return;
    const open = params.appUrl ?? 'cafesocial://redeem';
    const html = `
      <p><strong>${escapeHtml(params.actorUsername)}</strong> wants to connect with you on Cafe Social.</p>
      <p>Open the app to accept or decline: <a href="${escapeHtml(open)}">Open Cafe Social</a></p>
    `;
    await this.send({
      to: params.toEmail,
      subject: `${params.actorUsername} sent you a friend request`,
      html,
      tags: [
        { name: 'category', value: 'friend_request' },
      ],
    });
  }

  async notifyPartyInvite(params: {
    toEmail: string;
    actorUsername: string;
    partyName?: string | null;
    appUrl?: string;
  }): Promise<void> {
    if (!this.isConfigured()) return;
    const label = params.partyName?.trim() || 'a party';
    const open = params.appUrl ?? 'cafesocial://redeem';
    const html = `
      <p><strong>${escapeHtml(params.actorUsername)}</strong> invited you to <strong>${escapeHtml(label)}</strong> on Cafe Social.</p>
      <p>Open the app to respond: <a href="${escapeHtml(open)}">Open Cafe Social</a></p>
    `;
    await this.send({
      to: params.toEmail,
      subject: `Party invite from ${params.actorUsername}`,
      html,
      tags: [{ name: 'category', value: 'party_invite' }],
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
