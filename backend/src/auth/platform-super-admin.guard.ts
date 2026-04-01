import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUserEmail } from './user-email.util';

/** Requires a valid Clerk JWT and `Player.platformRole === SUPER_ADMIN`. */
@Injectable()
export class PlatformSuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: unknown }>();
    const email = normalizeUserEmail(req.user);
    if (!email) {
      throw new UnauthorizedException('Missing user email');
    }

    const player = await this.prisma.player.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { platformRole: true },
    });

    if (player?.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
