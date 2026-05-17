import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, Rect,
} from 'react-native-svg';
import { useAppSelector } from '../store/hooks';
import { useTheme } from '../hooks/useTheme';
import { MetricCard } from '../components/MetricCard';
import { PlaybookCard } from '../components/PlaybookCard';
import {
  Bell, Bot, Search, Zap, Building2, Mail, Sparkles,
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

export const HomeScreen = ({ navigation }: Props) => {
  const user = useAppSelector((st) => st.auth.user);
  const { colors, spacing, borderRadius, mode } = useTheme();

  const displayName = user?.name ?? user?.email?.split('@')[0] ?? 'Amad Asif';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}>

        <View style={[s.headerRow, { marginTop: 16, marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={[s.avatar, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('ProfileTab')}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </TouchableOpacity>
            <View>
              <Text style={[s.greetTxt, { color: colors.textSecondary }]}>
                {getGreeting()}
              </Text>
              <Text style={[s.nameTxt, { color: colors.text }]}>
                {displayName} 👋
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { navigation.navigate('NotificationsTab') }}
            style={[
              s.bellWrap,
              {
                backgroundColor: mode === 'dark' ? colors.surface : colors.surfaceHighlight,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}>
            <Bell size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[
          s.statusPill,
        ]}>
          <View style={[s.statusDot, { backgroundColor: colors.success }]} />
          <View>
            <Text style={[s.statusMain, { color: colors.text }]}>AI Agent Online</Text>
            <Text style={[s.statusSub, { color: colors.success }]}>Ready to run</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.ctaCard, { borderRadius: borderRadius.xl, overflow: 'hidden', marginBottom: 24 }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ChatTab')}>
          <View style={StyleSheet.absoluteFill}>
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="ctaBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#4B32C3" />
                  <Stop offset="35%" stopColor="#6D5CFF" />
                  <Stop offset="65%" stopColor="#885CF6" />
                  <Stop offset="100%" stopColor="#36CFFF" />
                </LinearGradient>
                <RadialGradient id="ctaGlow" cx="70%" cy="30%" r="60%">
                  <Stop offset="0%" stopColor="#36CFFF" stopOpacity="0.35" />
                  <Stop offset="100%" stopColor="#36CFFF" stopOpacity="0" />
                </RadialGradient>
                <RadialGradient id="ctaGlow2" cx="30%" cy="80%" r="50%">
                  <Stop offset="0%" stopColor="#2BE4B8" stopOpacity="0.2" />
                  <Stop offset="100%" stopColor="#2BE4B8" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaBg)" />
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaGlow)" />
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaGlow2)" />
            </Svg>
          </View>

          <View style={s.ctaBody}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.ctaTitle}>Run Sales Agent</Text>
              <Text style={s.ctaSub}>
                Find new leads, check CRM{'\n'}and create follow-ups
              </Text>
            </View>
            <View style={s.ctaRobot}>
              <Bot size={26} color="rgba(255,255,255,0.95)" />
            </View>
          </View>
        </TouchableOpacity>
        <View style={[s.row2, { marginBottom: 10 }]}>
          <MetricCard
            title="New Leads"
            value="24"
            trendValue="↑ 32%"
            trendLabel="vs last 7 days"
            positive
          />
          <MetricCard
            title="Hot Leads"
            value="8"
            trendValue="↑ 25%"
            trendLabel="vs last 7 days"
            positive
          />
        </View>
        <View style={[s.row2, { marginBottom: 28 }]}>
          <MetricCard
            title="Follow-ups Due"
            value="6"
            badgeText="Due today"
            badgeColor={colors.warning}
          />
          <MetricCard
            title="Revenue Potential"
            value="$128K"
            trendValue="↑ 18%"
            trendLabel="This month"
            positive
          />
        </View>

        <View style={[s.sectionHdr, { marginBottom: 14 }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>AI Sales Playbooks</Text>
          <TouchableOpacity>
            <Text style={[s.viewAll, { color: colors.primary }]}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 10 }}>
          <PlaybookCard
            icon={<Search size={20} color={colors.primary} />}
            iconBg={colors.primary}
            title="Discover Leads"
            desc="Find prospects via Google Places"
            rightIcon={<Sparkles size={16} color={colors.primary} />}
            onPress={() => navigation.navigate('Discovery')}
          />
          <PlaybookCard
            icon={<Zap size={20} color={colors.accent} />}
            iconBg={colors.accent}
            title="Qualify & Score"
            desc="Score and prioritize best prospects"
            onPress={() => navigation.navigate('CRMLeads')}
          />
          <PlaybookCard
            icon={<Building2 size={20} color={colors.accentGreen} />}
            iconBg={colors.accentGreen}
            title="CRM Intelligence"
            desc="Analyze deals and account health"
            onPress={() => navigation.navigate('CRMLeads')}
          />
          <PlaybookCard
            icon={<Mail size={20} color={colors.success} />}
            iconBg={colors.success}
            title="Outreach Assistant"
            desc="Craft emails and set follow-ups"
            onPress={() => navigation.navigate('ChatTab')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarTxt: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  greetTxt: { fontSize: 13, fontWeight: '400' },
  nameTxt: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  bellWrap: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    alignSelf: 'flex-start', borderWidth: 1, paddingBottom: 15,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusMain: { fontSize: 14, fontWeight: '600' },
  statusSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  ctaCard: {
    height: 140,
    shadowColor: '#6D5CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaBody: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 22, flex: 1,
  },
  ctaTitle: {
    color: '#FFF', fontSize: 22, fontWeight: '800',
    marginBottom: 6, letterSpacing: -0.3,
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19,
  },
  ctaRobot: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  row2: { flexDirection: 'row', gap: 10 },
  lightShadow: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHdr: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  viewAll: { fontSize: 14, fontWeight: '600' },

});
