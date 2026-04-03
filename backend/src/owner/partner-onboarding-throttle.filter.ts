import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerException } from '@nestjs/throttler';
import { PARTNER_ONBOARDING_THROTTLED } from './partner-ops.events';

@Injectable()
@Catch(ThrottlerException)
export class PartnerOnboardingThrottlerFilter implements ExceptionFilter {
  constructor(private readonly events: EventEmitter2) {}

  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ url?: string }>();
    const path =
      typeof req?.url === 'string'
        ? req.url
        : typeof req?.path === 'string'
          ? req.path
          : '';
    if (path.includes('onboarding/bootstrap')) {
      this.events.emit(PARTNER_ONBOARDING_THROTTLED, { path: req.url });
    }
    const res = ctx.getResponse<{ status: (n: number) => void; json: (b: unknown) => void }>();
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
    });
  }
}
