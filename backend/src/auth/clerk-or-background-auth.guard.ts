import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtValidationService } from './jwt-validation.service';
import { BackgroundTokenService } from './background-token.service';

/**
 * Accepts a Clerk session JWT **or** a long-lived background geofence token.
 * Used only for endpoints that must work while the app is killed.
 */
@Injectable()
export class ClerkOrBackgroundAuthGuard implements CanActivate {
  constructor(
    private readonly jwtValidation: JwtValidationService,
    private readonly backgroundTokens: BackgroundTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    if (token.startsWith('bg_')) {
      const player = await this.backgroundTokens.resolvePlayer(token);
      if (!player) {
        throw new UnauthorizedException('Invalid or expired background token');
      }
      request.user = {
        email: player.email,
        externalId: player.id,
        backgroundAuth: true,
      };
      return true;
    }

    const claims = await this.jwtValidation.validate(token);
    request.user = {
      externalId: claims.sub,
      email: claims.email,
      claims,
    };
    return true;
  }
}
