/**
 * AccountScreen.tsx — Profile and Settings.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { signOut } from '../store/slices/authSlice';
import { toggleTheme } from '../store/slices/themeSlice';
import { useTheme } from '../hooks/useTheme';
import { User, Mail, Fingerprint, LogOut, Moon, Sun, Shield, Settings, ChevronRight, Server } from '../constants/icons';
import { useNavigation } from '@react-navigation/native';

const InfoRow = ({ icon: IconComponent, label, value, colors }: any) => (
  <View style={styles.infoRow}>
    <View style={[styles.iconContainer, { backgroundColor: colors.surfaceHighlight }]}>
      <IconComponent size={18} color={colors.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value ?? '—'}</Text>
    </View>
  </View>
);

const SettingRow = ({ icon: IconComponent, label, rightElement, onPress, colors }: any) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
    <View style={[styles.iconContainer, { backgroundColor: colors.surfaceHighlight }]}>
      <IconComponent size={18} color={colors.textSecondary} />
    </View>
    <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
    <View style={styles.settingRight}>
      {rightElement || <ChevronRight size={18} color={colors.textMuted} />}
    </View>
  </TouchableOpacity>
);

export const AccountScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const user = useAppSelector((s) => s.auth.user);
  const { mode } = useAppSelector((s) => s.theme);
  const { colors, spacing, borderRadius } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = user?.name ?? user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          await dispatch(signOut());
        },
      },
    ]);
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { padding: spacing.xl }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        <View style={[styles.avatarBlock, { paddingBottom: spacing.xl }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.emailText, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>

        <View style={[styles.section, { paddingHorizontal: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT DETAILS</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md }]}>
            <InfoRow icon={User} label="Name" value={user?.name} colors={colors} />
            <InfoRow icon={Mail} label="Email" value={user?.email} colors={colors} />
            <InfoRow icon={Fingerprint} label="User ID" value={user?.id} colors={colors} />
          </View>
        </View>

        <View style={[styles.section, { paddingHorizontal: spacing.xl, marginTop: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            <SettingRow 
              icon={mode === 'dark' ? Moon : Sun} 
              label="Dark Mode" 
              colors={colors}
              rightElement={
                <Switch 
                  value={mode === 'dark'} 
                  onValueChange={handleThemeToggle} 
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFF"
                />
              } 
            />
            <SettingRow icon={Server} label="Simulation Console" colors={colors} onPress={() => navigation.navigate('SimulationConsole')} />
            <SettingRow icon={Shield} label="Security" colors={colors} onPress={() => {}} />
            <SettingRow icon={Settings} label="App Settings" colors={colors} onPress={() => {}} />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: colors.errorMuted, borderColor: colors.errorMuted, borderRadius: borderRadius.md, padding: spacing.md }]} 
            onPress={handleSignOut} 
            disabled={isLoggingOut} 
            activeOpacity={0.8}
          >
            {isLoggingOut ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <LogOut size={20} color={colors.error} />
                <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  avatarBlock: { alignItems: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, marginBottom: 16 },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: '700' },
  displayName: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  emailText: { fontSize: 15 },
  section: {},
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '500' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.1)' },
  settingLabel: { fontSize: 16, fontWeight: '500', flex: 1, marginLeft: 16 },
  settingRight: {},
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
