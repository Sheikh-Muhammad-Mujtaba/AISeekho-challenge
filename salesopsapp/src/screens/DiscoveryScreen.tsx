/**
 * DiscoveryScreen.tsx
 *
 * Shows Lead Discovery & Place Candidates from Google Places API (Mocked).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { MapPin, Search, Star, Filter, ArrowLeft, Shield } from '../constants/icons';
import { useNavigation } from '@react-navigation/native';

const mockCandidates = [
  { id: '1', name: 'Laser Clinic Gulberg', address: 'Main Blvd Gulberg, Lahore', rating: 4.8, score: 95, isDuplicate: false, status: 'Hot' },
  { id: '2', name: 'Aesthetic Care', address: 'MM Alam Rd, Lahore', rating: 4.5, score: 80, isDuplicate: false, status: 'Warm' },
  { id: '3', name: 'Skin Health Center', address: 'Gulberg III, Lahore', rating: 4.2, score: 0, isDuplicate: true, status: 'Duplicate' },
];

export const DiscoveryScreen = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const renderCandidate = ({ item }: { item: typeof mockCandidates[0] }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.name, { color: colors.text, flex: 1 }]}>{item.name}</Text>
        <View style={[styles.scoreBadge, { backgroundColor: item.isDuplicate ? colors.errorMuted : colors.successMuted, borderColor: item.isDuplicate ? colors.error : colors.success }]}>
          <Text style={{ color: item.isDuplicate ? colors.error : colors.success, fontSize: 12, fontWeight: '600' }}>{item.status}</Text>
        </View>
      </View>
      
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <MapPin size={14} color={colors.textMuted} />
        <Text style={[styles.address, { color: colors.textSecondary }]}>{item.address}</Text>
      </View>
      
      <View style={[styles.row, { marginTop: spacing.xs }]}>
        <Star size={14} color={colors.warning} />
        <Text style={[styles.rating, { color: colors.textSecondary }]}>{item.rating} Rating</Text>
        <Text style={[styles.score, { color: colors.primary, marginLeft: spacing.md }]}>Agent Score: {item.score}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingVertical: spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Lead Discovery</Text>
        <TouchableOpacity>
          <Filter size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchInfo, { backgroundColor: colors.primaryMuted, marginHorizontal: spacing.xl, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg }]}>
        <View style={styles.row}>
          <Search size={18} color={colors.primary} />
          <Text style={[styles.searchQuery, { color: colors.primary }]}>"Clinics in Gulberg Lahore"</Text>
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Shield size={14} color={colors.success} />
          <Text style={[styles.searchSub, { color: colors.success }]}>Agent deduped against ERPNext</Text>
        </View>
      </View>

      <FlatList
        data={mockCandidates}
        keyExtractor={item => item.id}
        renderItem={renderCandidate}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
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
  searchInfo: { borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchQuery: { fontSize: 15, fontWeight: '600' },
  searchSub: { fontSize: 13, fontWeight: '500' },
  card: { borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700' },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  address: { fontSize: 14 },
  rating: { fontSize: 14, fontWeight: '500' },
  score: { fontSize: 14, fontWeight: '600' },
});
