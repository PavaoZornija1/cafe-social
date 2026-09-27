import { GoneException, Injectable } from '@nestjs/common';
import { PartnerOnboardingDto } from './dto/partner-onboarding.dto';

@Injectable()
export class PartnerOnboardingService {
  async bootstrapSelfServeOrgAndVenue(
    _playerId: string,
    _dto: PartnerOnboardingDto,
  ) {
    throw new GoneException(
      'Self-serve venue creation is disabled. Apply at /partners and wait for approval.',
    );
  }
}
