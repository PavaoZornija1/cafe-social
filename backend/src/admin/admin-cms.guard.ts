import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminCmsAccessService, AdminCmsScope } from './admin-cms-access.service';

type RequestWithScope = { user?: unknown; adminCmsScope?: AdminCmsScope };

@Injectable()
export class AdminCmsGuard implements CanActivate {
  constructor(private readonly access: AdminCmsAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithScope>();
    req.adminCmsScope = await this.access.resolveScope(req);
    return true;
  }
}

export function getAdminCmsScope(req: RequestWithScope): AdminCmsScope {
  const s = req.adminCmsScope;
  if (!s) {
    throw new Error('AdminCmsGuard must run before reading adminCmsScope');
  }
  return s;
}
