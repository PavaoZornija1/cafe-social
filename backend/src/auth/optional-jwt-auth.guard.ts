import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtValidationService } from './jwt-validation.service';

/** Public routes may personalize for a verified viewer; an invalid supplied token still fails. */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  constructor(validation: JwtValidationService) {
    super(validation);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!context.switchToHttp().getRequest().headers.authorization) return true;
    return super.canActivate(context);
  }
}
