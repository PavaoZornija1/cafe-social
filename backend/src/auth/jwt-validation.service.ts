import { verifyToken } from '@clerk/backend';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { JWTPayload } from 'jose';

/**
 * Verifies Clerk session JWTs using @clerk/backend (same path as Clerk’s own middleware).
 *
 * Do not rely on the public Frontend API `/.well-known/jwks.json` with raw `jose` — those keys
 * can differ from the session signing keys, which produces: "no applicable key found in the JWKS".
 * Use CLERK_SECRET_KEY (or CLERK_JWT_KEY PEM) so Clerk fetches the correct JWKS / key material.
 */
@Injectable()
export class JwtValidationService {
  private readonly log = new Logger(JwtValidationService.name);
  private readonly secretKey?: string;
  private readonly jwtKey?: string;
  private readonly authorizedParties?: string[];

  constructor() {
    this.secretKey = process.env.CLERK_SECRET_KEY?.trim() || undefined;
    this.jwtKey = process.env.CLERK_JWT_KEY?.trim() || undefined;
    const parties = process.env.CLERK_AUTHORIZED_PARTIES?.trim();
    this.authorizedParties = parties
      ? parties.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    if (!this.secretKey && !this.jwtKey) {
      throw new Error(
        'Set CLERK_SECRET_KEY or CLERK_JWT_KEY for Clerk JWT verification (CLERK_ISSUER + CLERK_JWKS_URL alone are not sufficient for current Clerk session tokens)',
      );
    }
  }

  async validate(token: string): Promise<JWTPayload> {
    try {
      const options =
        this.jwtKey !== undefined
          ? { jwtKey: this.jwtKey }
          : { secretKey: this.secretKey as string };

      const extended = {
        ...options,
        ...(this.authorizedParties?.length
          ? { authorizedParties: this.authorizedParties }
          : {}),
      };

      // Package entry point wraps verifyToken with withLegacyReturn: success returns JwtPayload; failure throws.
      const payload = await verifyToken(token, extended);
      if (payload == null || typeof payload !== 'object') {
        throw new Error('No payload from verifyToken');
      }
      return payload as JWTPayload;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV !== 'production') {
        this.log.warn(
          `JWT verification failed (${msg}). Ensure CLERK_SECRET_KEY matches your Clerk app. If you see azp / authorized parties errors, set CLERK_AUTHORIZED_PARTIES to your admin origins (e.g. http://localhost:3000,http://127.0.0.1:3000).`,
        );
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
