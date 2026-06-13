import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from './type';

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/** Screen inside a bottom tab with access to the root stack navigator. */
export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Screens mounted on the root stack and/or inside tabs (shared components). */
export type AppNavigationProps = CompositeScreenProps<
  NativeStackScreenProps<RootStackParamList>,
  BottomTabScreenProps<MainTabParamList>
>;
