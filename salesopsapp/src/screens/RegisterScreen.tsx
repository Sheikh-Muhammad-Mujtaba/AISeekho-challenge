/**
 * RegisterScreen.tsx — Sign up via Redux dispatch.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { signUp, clearError } from '../store/slices/authSlice';
import { useTheme } from '../hooks/useTheme';
import { NeonButton } from '../components/NeonButton';
import { AuthInput } from '../components/AuthInput';
import type { AuthStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen = ({ navigation }: Props) => {
  const dispatch = useAppDispatch();
  const { error: globalError } = useAppSelector((s) => s.auth);
  const { colors, spacing, borderRadius } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const validate = (): boolean => {
    let valid = true;
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmError('');

    if (!name.trim()) { setNameError('Full name is required.'); valid = false; }
    else if (name.trim().length < 2) { setNameError('Name must be at least 2 characters.'); valid = false; }

    if (!email.trim()) { setEmailError('Email is required.'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailError('Enter a valid email address.'); valid = false; }

    if (!password) { setPasswordError('Password is required.'); valid = false; }
    else if (password.length < 8) { setPasswordError('Password must be at least 8 characters.'); valid = false; }

    if (!confirmPassword) { setConfirmError('Please confirm your password.'); valid = false; }
    else if (password !== confirmPassword) { setConfirmError('Passwords do not match.'); valid = false; }

    return valid;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    await dispatch(signUp({ name: name.trim(), email: email.trim(), password }));
    setIsSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { padding: spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { marginBottom: spacing.xxl }]}>
          <Text style={[styles.logo, { color: colors.text, textShadowColor: colors.primary }]}>SalesOps</Text>
          <Text style={[styles.subtitle, { color: colors.accent, marginTop: spacing.sm }]}>Autonomous Agent Interface</Text>
        </View>

        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.xl, padding: spacing.xl, gap: spacing.md }]}>
          <View>
            <Text style={[styles.formTitle, { color: colors.text }]}>Create account</Text>
            <Text style={[styles.formSubtitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Start your SalesOps journey</Text>
          </View>

          {!!globalError && (
            <View style={[styles.errorBanner, { backgroundColor: colors.errorMuted, borderColor: colors.error, borderRadius: borderRadius.sm, padding: spacing.md }]}>
              <Text style={[styles.errorBannerText, { color: colors.error }]}>{globalError}</Text>
            </View>
          )}

          <AuthInput label="Full Name" placeholder="Jane Smith" autoCapitalize="words" value={name} onChangeText={setName} error={nameError} />
          <AuthInput label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} error={emailError} />
          <AuthInput label="Password" placeholder="Min 8 characters" isPassword value={password} onChangeText={setPassword} error={passwordError} />
          <AuthInput label="Confirm Password" placeholder="Re-enter your password" isPassword value={confirmPassword} onChangeText={setConfirmPassword} error={confirmError} />

          <NeonButton title="Create Account" onPress={handleRegister} loading={isSubmitting} style={{ marginTop: spacing.sm }} />

          <View style={[styles.linkRow, { marginTop: spacing.sm }]}>
            <Text style={[styles.linkLabel, { color: colors.textMuted }]}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.link, { color: colors.primary }]}> Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center' },
  logo: { fontSize: 44, fontWeight: 'bold', letterSpacing: 2, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
  subtitle: { fontSize: 14, letterSpacing: 1.2 },
  form: { borderWidth: 1 },
  formTitle: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  formSubtitle: { fontSize: 14 },
  errorBanner: { borderWidth: 1 },
  errorBannerText: { fontSize: 14 },
  linkRow: { flexDirection: 'row', justifyContent: 'center' },
  linkLabel: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: '600' },
});
