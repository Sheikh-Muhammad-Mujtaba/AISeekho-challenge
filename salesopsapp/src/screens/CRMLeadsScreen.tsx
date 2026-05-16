/**
 * CRMLeadsScreen.tsx
 *
 * Displays ERPNext leads with "Hot" highlights and pending follow-ups.
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Users, ArrowLeft, Building2, Phone, Calendar } from '../constants/icons';
import { useNavigation } from '@react-navigation/native';

const mockLeads = [
  { id: '1', name: 'Tech Innovators', contact: '+92 300 1234567', status: 'Hot', intent: 'Requested Demo', followUp: 'Today 3:00 PM' },
  { id: '2', name: 'Global Logistics', contact: '+92 321 7654321', status: 'Warm', intent: 'Pricing Query', followUp: 'Tomorrow' },
  { id: '3', name: 'Alpha Retail', contact: '+92 333 9998887', status: 'Cold', intent: 'No response', followUp: 'Next Week' },
];

export const CRMLeadsScreen = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();

  const renderLead = ({ item }: { item: typeof mockLeads[0] }) => {
    const isHot = item.status === 'Hot';
    
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: isHot ? colors.primary : colors.border, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isHot ? colors.primaryMuted : colors.surfaceHighlight }]}>
            <Text style={{ color: isHot ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{item.status}</Text>
          </View>
        </View>
        
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <Phone size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.contact}</Text>
        </View>
        
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <Building2 size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Intent: {item.intent}</Text>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.borderLight, paddingTop: spacing.sm, marginTop: spacing.sm }]}>
          <View style={styles.row}>
            <Calendar size={14} color={isHot ? colors.warning : colors.textMuted} />
            <Text style={[styles.followUp, { color: isHot ? colors.warning : colors.textMuted }]}>Follow up: {item.followUp}</Text>
          </View>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.actionBtnText}>View Details</Text>
          </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>ERPNext Leads</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={mockLeads}
        keyExtractor={item => item.id}
        renderItem={renderLead}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  card: { borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 14 },
  footer: { borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  followUp: { fontSize: 13, fontWeight: '600' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
