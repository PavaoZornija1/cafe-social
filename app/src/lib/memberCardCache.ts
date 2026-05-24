import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MemberCardDto } from './memberCardApi';

const STORAGE_KEY = 'member_card_cache_v1';

export async function cacheMemberCard(card: MemberCardDto): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(card));
}

export async function loadCachedMemberCard(): Promise<MemberCardDto | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MemberCardDto;
  } catch {
    return null;
  }
}
