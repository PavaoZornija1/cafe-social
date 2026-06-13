import { apiGet } from './api';

export type SocialInboxFriendRequest = {
  id: string;
  requestedById: string;
  playerLow: { id: string; username: string };
  playerHigh: { id: string; username: string };
};

export type SocialInboxPartyInvite = {
  id: string;
  partyId: string;
  partyName: string | null;
  memberCount: number;
  maxMembers: number;
  invitedBy: { id: string; username: string };
  createdAt: string;
};

export type SocialInboxPayload = {
  friendRequestsIncoming: SocialInboxFriendRequest[];
  friendRequestsOutgoing: { id: string; target: { id: string; username: string } }[];
  partyInvitesIncoming: SocialInboxPartyInvite[];
};

export function countSocialInboxPending(inbox: SocialInboxPayload | null | undefined): number {
  if (!inbox) return 0;
  return inbox.friendRequestsIncoming.length + inbox.partyInvitesIncoming.length;
}

export function fetchSocialInbox(token: string): Promise<SocialInboxPayload> {
  return apiGet<SocialInboxPayload>('/social/inbox', token);
}
