import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.config.get<string>('ADMIN_API_KEY')?.trim();
    if (!key) {
      throw new UnauthorizedException('Admin API is not configured (set ADMIN_API_KEY)');
    }
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const headerRaw = req.headers['x-admin-key'] ?? req.headers['X-Admin-Key'];
    const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const authRaw = req.headers['authorization'] ?? req.headers['Authorization'];
    const auth = Array.isArray(authRaw) ? authRaw[0] : authRaw;
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
    const provided = (header ?? bearer)?.trim();
    if (!provided || provided !== key) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
