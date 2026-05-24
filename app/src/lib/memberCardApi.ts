import { apiGet } from './api';

export type MemberCardDto = {
  playerId: string;
  username: string;
  memberQrToken: string;
  qrPayload: string;
  deepLinkCafeSocial: string;
  deepLinkLoyaltySocial: string;
};

export function fetchMyMemberCard(token: string): Promise<MemberCardDto> {
  return apiGet<MemberCardDto>('/players/me/member-card', token);
}
