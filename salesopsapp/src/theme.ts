/**
 * theme.ts — Dark & Light theme palettes + shared design tokens.
 */

export type ThemeMode = 'dark' | 'light';

const darkColors = {
  background: '#05050A',
  surface: 'rgba(255, 255, 255, 0.04)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.08)',
  surfaceElevated: 'rgba(255, 255, 255, 0.06)',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4338CA',
  primaryMuted: 'rgba(99, 102, 241, 0.12)',
  accent: '#06B6D4',
  accentMuted: 'rgba(6, 182, 212, 0.12)',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.04)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.12)',
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.12)',
  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  card: 'rgba(255, 255, 255, 0.03)',
  tabBar: 'rgba(5, 5, 10, 0.95)',
  statusBar: 'light-content' as const,
};

const lightColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceHighlight: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4338CA',
  primaryMuted: 'rgba(99, 102, 241, 0.08)',
  accent: '#0891B2',
  accentMuted: 'rgba(8, 145, 178, 0.08)',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.08)',
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.08)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.08)',
  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.3)',
  card: '#FFFFFF',
  tabBar: 'rgba(255, 255, 255, 0.95)',
  statusBar: 'dark-content' as const,
};

export type ThemeColors = Omit<typeof darkColors, 'statusBar'> & {
  statusBar: 'light-content' | 'dark-content';
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  round: 9999,
};

export const typography = {
  fontFamily: 'System',
};

/** Get colors for a given theme mode */
export const getColors = (mode: ThemeMode): ThemeColors =>
  mode === 'dark' ? darkColors : lightColors;

/** Default export for backward compat — always dark */
export const theme = {
  colors: darkColors,
  spacing,
  borderRadius,
  typography,
};
