import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PARTNER_ONBOARDING_THROTTLED } from './partner-ops.events';

@Injectable()
@Catch(ThrottlerException)
export class PartnerOnboardingThrottlerFilter implements ExceptionFilter {
  constructor(private readonly events: EventEmitter2) {}

  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const pathSegment =
      typeof req.path === 'string' && req.path.length > 0
        ? req.path
        : typeof req.url === 'string'
          ? req.url
          : '';
    if (pathSegment.includes('onboarding/bootstrap')) {
      this.events.emit(PARTNER_ONBOARDING_THROTTLED, { path: req.originalUrl ?? req.url });
    }
    const res = ctx.getResponse<Response>();
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
    });
  }
}
