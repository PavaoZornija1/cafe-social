import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtValidationService } from './jwt-validation.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtValidationService: JwtValidationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    const claims = await this.jwtValidationService.validate(token);

    request.user = {
      externalId: claims.sub,
      email: claims.email,
      claims,
    };

    return true;
  }
}

