/**
 * HomeScreen.tsx — Post-login landing, uses Redux for user state.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../store/hooks';
import { useTheme } from '../hooks/useTheme';
import { 
  MessageSquare, 
  Search,
  Users,
  Activity,
  Terminal,
  ChevronRight,
  TrendingUp,
} from '../constants/icons';
import type { BottomTabParamList } from '../navigation/BottomTabs';
import type { AppStackParamList } from '../navigation/index';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'HomeTab'>,
  NativeStackScreenProps<AppStackParamList>
>;

const MetricCard = ({ title, value, trend, positive }: { title: string; value: string; trend: string; positive: boolean }) => {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md }]}>
      <Text style={[styles.metricTitle, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <View style={styles.trendRow}>
        {positive ? <TrendingUp size={14} color={colors.success} /> : <Activity size={14} color={colors.warning} />}
        <Text style={[styles.trendText, { color: positive ? colors.success : colors.warning }]}>{trend}</Text>
      </View>
    </View>
  );
};

const QuickCard = ({ icon, label, desc, onPress }: { icon: React.ReactNode; label: string; desc: string; onPress: () => void }) => {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <TouchableOpacity 
      style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.md }]} 
      onPress={onPress} 
      activeOpacity={0.8}
    >
      <View style={[styles.cardIcon, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md }]}>
        {icon}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{desc}</Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

export const HomeScreen = ({ navigation }: Props) => {
  const user = useAppSelector((s) => s.auth.user);
  const { colors, spacing, borderRadius } = useTheme();
  
  const displayName = user?.name ?? user?.email?.split('@')[0] ?? 'Agent';
  const initials = displayName.split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        
        <View style={[styles.topBar, { paddingTop: spacing.lg, marginBottom: spacing.md }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>Good to see you,</Text>
            <Text style={[styles.name, { color: colors.text }]}>{displayName} 👋</Text>
          </View>
          <TouchableOpacity style={[styles.avatar, { backgroundColor: colors.primary, borderRadius: borderRadius.round }]} onPress={() => navigation.navigate('ProfileTab')}>
            <Text style={[styles.avatarText, { color: '#FFF' }]}>{initials}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: colors.successMuted, borderColor: colors.successMuted, borderRadius: borderRadius.round, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xl }]}>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.statusText, { color: colors.success }]}>Agent online — ready to assist</Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard title="New Leads" value="14" trend="+3 today" positive={true} />
          <MetricCard title="Pending Tasks" value="5" trend="Action needed" positive={false} />
        </View>

        <View style={[styles.section, { gap: spacing.md, marginTop: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, marginBottom: spacing.xs }]}>Agent Workflows</Text>
          
          <QuickCard 
            icon={<MessageSquare size={24} color={colors.primary} />} 
            label="Open Chat" 
            desc="Talk to your SalesOps AI agent" 
            onPress={() => navigation.navigate('ChatTab')} 
          />
          <QuickCard 
            icon={<Search size={24} color={colors.primary} />} 
            label="Discover Leads" 
            desc="Find new leads via Google Places" 
            onPress={() => navigation.navigate('Discovery')} 
          />
          <QuickCard 
            icon={<Users size={24} color={colors.primary} />} 
            label="ERPNext CRM" 
            desc="Analyze hot leads & opportunities" 
            onPress={() => navigation.navigate('CRMLeads')} 
          />
        </View>

        <View style={[styles.section, { gap: spacing.md, marginTop: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted, marginBottom: spacing.xs }]}>Insights & Audits</Text>
          
          <QuickCard 
            icon={<Activity size={24} color={colors.warning} />} 
            label="Outcome Dashboard" 
            desc="Before/After workflow metrics" 
            onPress={() => navigation.navigate('OutcomeDashboard')} 
          />
          <QuickCard 
            icon={<Terminal size={24} color={colors.accent} />} 
            label="Antigravity Trace" 
            desc="View agent thought process" 
            onPress={() => navigation.navigate('TraceLogs')} 
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: '700' },
  avatar: { width: 46, height: 46, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  avatarText: { fontWeight: '700', fontSize: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, alignSelf: 'flex-start' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  metricsGrid: { flexDirection: 'row', gap: 16 },
  metricCard: { flex: 1, borderWidth: 1 },
  metricTitle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  metricValue: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 12, fontWeight: '500' },
  section: {},
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  quickCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  cardIcon: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 13, marginTop: 2 },
});
