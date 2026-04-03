import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';

/**
 * Sends Clerk application invitations so invitees get email + sign-up flow.
 * Redirect URL must be allowlisted in Clerk Dashboard → Paths → redirect URLs.
 * Requires CLERK_SECRET_KEY and ADMIN_PORTAL_ORIGIN (e.g. https://partner.example.com, no trailing slash).
 */
@Injectable()
export class ClerkPartnerInviteService {
  private readonly log = new Logger(ClerkPartnerInviteService.name);

  /**
   * @returns whether Clerk accepted the invitation request (email may still be suppressed by Clerk settings).
   */
  async sendStaffPortalInvitation(params: {
    email: string;
    staffInviteToken: string;
  }): Promise<{ sent: boolean; clerkError?: string }> {
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    const origin = process.env.ADMIN_PORTAL_ORIGIN?.trim();
    if (!secretKey || !origin) {
      this.log.debug(
        'Skipping Clerk invitation: CLERK_SECRET_KEY or ADMIN_PORTAL_ORIGIN not set',
      );
      return { sent: false };
    }

    const base = origin.replace(/\/$/, '');
    const redirectUrl = `${base}/owner/accept-invite?token=${encodeURIComponent(params.staffInviteToken)}`;

    try {
      const clerk = createClerkClient({ secretKey });
      await clerk.invitations.createInvitation({
        emailAddress: params.email,
        redirectUrl,
        notify: true,
        /**
         * Allow invitation row when the email already exists in Clerk — user still gets
         * email / recovery flow; they must land on accept-invite with token after sign-in.
         */
        ignoreExisting: true,
      });
      return { sent: true };
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'errors' in e
          ? JSON.stringify((e as { errors?: unknown }).errors)
          : e instanceof Error
            ? e.message
            : String(e);
      this.log.warn(`Clerk invitation failed for ${params.email}: ${msg}`);
      return { sent: false, clerkError: msg };
    }
  }
}
