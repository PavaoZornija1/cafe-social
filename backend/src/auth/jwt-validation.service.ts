import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

@Injectable()
export class JwtValidationService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience?: string;

  constructor() {
    const issuer = process.env.CLERK_ISSUER;
    const jwksUrl = process.env.CLERK_JWKS_URL;

    if (!issuer || !jwksUrl) {
      throw new Error('CLERK_ISSUER and CLERK_JWKS_URL must be set');
    }

    this.issuer = issuer;
    this.audience = process.env.CLERK_AUDIENCE;
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async validate(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

