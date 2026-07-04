import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';

/**
 * Clerk user admin operations (account deletion for store compliance).
 * Requires CLERK_SECRET_KEY.
 */
@Injectable()
export class ClerkUserService {
  private readonly log = new Logger(ClerkUserService.name);

  /**
   * Permanently deletes the Clerk user. Idempotent if the user is already gone.
   */
  async deleteUser(clerkUserId: string): Promise<void> {
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Account deletion is unavailable (CLERK_SECRET_KEY not configured)',
      );
    }

    const id = clerkUserId.trim();
    if (!id) {
      throw new ServiceUnavailableException('Missing Clerk user id');
    }

    try {
      const clerk = createClerkClient({ secretKey });
      await clerk.users.deleteUser(id);
    } catch (e: unknown) {
      if (this.isNotFound(e)) {
        this.log.debug(`Clerk user ${id} already deleted`);
        return;
      }
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === 'object' && 'errors' in e
            ? JSON.stringify((e as { errors?: unknown }).errors)
            : String(e);
      this.log.warn(`Clerk deleteUser failed for ${id}: ${msg}`);
      throw new ServiceUnavailableException(
        'Could not delete authentication account. Try again later.',
      );
    }
  }

  private isNotFound(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const status = (e as { status?: number }).status;
    if (status === 404) return true;
    const errors = (e as { errors?: Array<{ code?: string }> }).errors;
    return Array.isArray(errors) && errors.some((err) => err?.code === 'resource_not_found');
  }
}
