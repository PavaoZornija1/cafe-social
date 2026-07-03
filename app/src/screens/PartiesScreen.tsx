import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '../components/ScreenHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import { apiGet, apiPost } from '../lib/api';
import { triggerFeedback } from '../lib/feedback';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Parties'>;

type PartyMember = {
  playerId: string;
  player: { id: string; username: string };
};

type PartyListItem = {
  id: string;
  name: string | null;
  creatorId: string;
  leaderId: string;
  maxMembers: number;
  members: PartyMember[];
};

function memberPreview(members: PartyMember[], max = 3): string {
  const names = members.map((m) => m.player.username).filter(Boolean);
  if (names.length === 0) return '';
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} +${rest}`;
  return shown.join(', ');
}

export default function PartiesScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setParties([]);
        return;
      }
      const list = await apiGet<PartyListItem[]>('/parties/mine', token);
      setParties(list);
    } catch (e) {
      setParties([]);
      setLoadError((e as Error).message || t('parties.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const createParty = async () => {
    setCreateError(null);
    const token = await getTokenRef.current();
    if (!token) {
      setCreateError(t('redeem.signInFirst'));
      return;
    }
    setCreating(true);
    try {
      const name = newName.trim() || undefined;
      const created = await apiPost<PartyListItem>(
        '/parties',
        name ? { name } : {},
        token,
      );
      setNewName('');
      triggerFeedback('lobbyStart');
      navigation.navigate('PartyDetail', { partyId: created.id });
    } catch (e) {
      setCreateError((e as Error).message || t('parties.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('parties.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="people-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('parties.heroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('parties.heroTitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAccent} />
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="add-circle-outline" size={22} color={colors.textInverse} />
            </View>
            <Text style={styles.cardTitle}>{t('parties.createCardTitle')}</Text>
          </View>
          <Text style={styles.cardHint}>{t('parties.createHint')}</Text>

          <Text style={styles.inputLabel}>{t('parties.nameLabel')}</Text>
          <TextInput
            value={newName}
            onChangeText={(v) => {
              setCreateError(null);
              setNewName(v);
            }}
            placeholder={t('parties.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, createError ? styles.inputError : null]}
            editable={!creating}
            returnKeyType="done"
            onSubmitEditing={() => void createParty()}
          />

          {createError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{createError}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              creating && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            disabled={creating}
            onPress={() => void createParty()}
            accessibilityRole="button"
            accessibilityLabel={t('parties.create')}
          >
            {creating ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Text style={styles.createBtnText}>{t('parties.create')}</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
              </>
            )}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('RedeemInvite', {})}
          accessibilityRole="button"
        >
          <Ionicons name="link-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>{t('parties.haveInvite')}</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('parties.yourParties')}</Text>
          {!loading && parties.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{parties.length}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.listLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('parties.loadFailed')}</Text>
            <Text style={styles.emptyBody}>{loadError}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={() => void load()}
            >
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : parties.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-circle-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('parties.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('parties.empty')}</Text>
          </View>
        ) : (
          parties.map((item) => {
            const preview = memberPreview(item.members);
            const leader = item.members.find((m) => m.playerId === item.leaderId);
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.partyCard, pressed && styles.pressed]}
                onPress={() => navigation.navigate('PartyDetail', { partyId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={t('parties.openParty', {
                  name: item.name?.trim() || t('parties.unnamed'),
                })}
              >
                <View style={styles.partyIconWrap}>
                  <Ionicons name="people" size={20} color={colors.textInverse} />
                </View>
                <View style={styles.partyCopy}>
                  <Text style={styles.partyTitle} numberOfLines={1}>
                    {item.name?.trim() || t('parties.unnamed')}
                  </Text>
                  <Text style={styles.partyMeta}>
                    {t('parties.memberCount', {
                      current: item.members.length,
                      max: item.maxMembers,
                    })}
                  </Text>
                  {preview ? (
                    <Text style={styles.partyMembers} numberOfLines={1}>
                      {preview}
                    </Text>
                  ) : null}
                  {leader ? (
                    <View style={styles.leaderChip}>
                      <Ionicons name="star" size={10} color={colors.honeyDark} />
                      <Text style={styles.leaderChipText}>
                        {t('parties.leaderTag')}: {leader.player.username}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
      marginBottom: spacing.lg,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      marginBottom: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: colors.primary,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    cardHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    inputLabel: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontWeight: '800',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    input: {
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    inputError: {
      borderColor: colors.error,
      backgroundColor: colors.errorMuted,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    errorText: {
      flex: 1,
      color: colors.error,
      fontWeight: '700',
      fontSize: 13,
      lineHeight: 18,
    },
    createBtn: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minHeight: 48,
    },
    createBtnText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 16,
    },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.88 },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    secondaryBtnText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    countPill: {
      minWidth: 26,
      height: 26,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillText: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '900',
    },
    listLoading: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
    },
    retryBtnText: {
      color: colors.primaryDark,
      fontWeight: '800',
      fontSize: 14,
    },
    partyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    partyIconWrap: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    partyCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    partyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    partyMeta: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    partyMembers: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    leaderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 4,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.honeyMuted,
    },
    leaderChipText: {
      color: colors.honeyDark,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
  });
}
