/**
 * TraceLogsScreen.tsx
 *
 * Antigravity Trace Viewer showing the agent's thought process and API interactions.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ArrowLeft, Terminal, CheckCircle, AlertCircle, Clock } from '../constants/icons';
import { useNavigation } from '@react-navigation/native';
import { agentApi } from '../services/agentApi';

export const TraceLogsScreen = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const result = await agentApi.getTraceLogs('mock_run_123');
      setLogs(result.logs);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const renderLog = ({ item, index }: { item: any, index: number }) => {
    const isLast = index === logs.length - 1;
    const isSuccess = item.status === 'success';

    return (
      <View style={styles.logContainer}>
        {/* Timeline Line */}
        {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
        
        {/* Timeline Dot */}
        <View style={[styles.timelineDot, { backgroundColor: colors.background }]}>
          {isSuccess ? <CheckCircle size={20} color={colors.success} /> : <AlertCircle size={20} color={colors.error} />}
        </View>

        {/* Content Card */}
        <View style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md }]}>
          <View style={styles.logHeader}>
            <Text style={[styles.agentName, { color: colors.primary }]}>{item.agent}</Text>
            <View style={styles.row}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
          </View>
          <View style={[styles.actionBadge, { backgroundColor: colors.surfaceHighlight, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginVertical: 6 }]}>
            <Terminal size={12} color={colors.textSecondary} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{item.action}</Text>
          </View>
          <Text style={[styles.detailsText, { color: colors.text }]}>{item.details}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingVertical: spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Antigravity Trace</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={renderLog}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
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
  logContainer: { flexDirection: 'row', marginBottom: 20, position: 'relative' },
  timelineLine: { position: 'absolute', left: 9, top: 24, bottom: -20, width: 2, zIndex: 0 },
  timelineDot: { zIndex: 1, marginTop: 4, marginRight: 12 },
  logCard: { flex: 1, borderWidth: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  agentName: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12 },
  actionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontFamily: 'monospace' },
  detailsText: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
