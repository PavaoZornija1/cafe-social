import {
  CanActivate,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isReceiptSubmissionsEnabled } from '../lib/receipt-submissions-enabled';

@Injectable()
export class ReceiptSubmissionsEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (!isReceiptSubmissionsEnabled(this.config)) {
      throw new NotFoundException();
    }
    return true;
  }
}
