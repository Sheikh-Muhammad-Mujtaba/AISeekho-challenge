/**
 * OutcomeDashboardScreen.tsx
 *
 * Before/After Dashboard showing the impact of the agent's work.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ArrowLeft, TrendingUp, Shield, Calendar as CalendarIcon, Target } from '../constants/icons';
import { useNavigation } from '@react-navigation/native';
import { agentApi } from '../services/agentApi';

export const OutcomeDashboardScreen = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const result = await agentApi.getOutcomeMetrics('mock_run_123');
      setMetrics(result.metrics);
    };
    fetchMetrics();
  }, []);

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md }]}>
      <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingVertical: spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Outcome Report</Text>
        <View style={{ width: 24 }} />
      </View>

      {!metrics ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          
          <View style={[styles.summaryBox, { backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg }]}>
            <Text style={styles.summaryTitle}>Agent Run Completed</Text>
            <Text style={styles.summarySub}>Your SalesOps agent successfully executed the planned workflow.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Impact Metrics</Text>
          
          <View style={styles.grid}>
            <StatCard icon={Target} title="New Leads Sourced" value={metrics.leadsFound} color={colors.primaryLight} />
            <StatCard icon={Shield} title="Duplicates Prevented" value={metrics.duplicatesPrevented} color={colors.success} />
          </View>
          <View style={[styles.grid, { marginTop: spacing.md }]}>
            <StatCard icon={CalendarIcon} title="Meetings Scheduled" value={metrics.meetingsScheduled} color={colors.warning} />
            <StatCard icon={TrendingUp} title="ToDos Created" value={metrics.todosCreated} color={colors.accent} />
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryBox: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  summaryTitle: { color: '#FFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  summarySub: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  grid: { flexDirection: 'row', gap: 16 },
  statCard: { flex: 1, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  statTitle: { fontSize: 13, fontWeight: '500' },
});
