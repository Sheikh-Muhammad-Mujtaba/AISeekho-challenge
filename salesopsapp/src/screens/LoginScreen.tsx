import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { config } from '../config';
import { NeonButton } from '../components/NeonButton';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      // Better Auth / Neon Auth sign in endpoint
      const response = await axios.post(`${config.NEON_AUTH_URL}/sign-in/email`, {
        email,
        password,
      });

      // Assuming Better Auth returns a token in the response or sets a cookie
      // In a purely native environment, we need the token explicitly from the body
      const token = response.data?.token || response.headers['set-cookie']?.[0];
      
      if (!token) {
        throw new Error('No authentication token received');
      }

      await signIn(token, {
        id: response.data?.user?.id || 'id',
        email: response.data?.user?.email || email,
      });
      
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      Alert.alert(
        'Login Failed', 
        error.response?.data?.message || 'Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>SalesOps</Text>
          <Text style={styles.subtitle}>Autonomous Agent Interface</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <NeonButton 
            title="Authenticate" 
            onPress={handleLogin} 
            loading={isLoading}
            style={styles.loginButton}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  headerContainer: {
    marginBottom: theme.spacing.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: theme.colors.text,
    letterSpacing: 2,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.accent,
    marginTop: theme.spacing.sm,
    letterSpacing: 1,
  },
  formContainer: {
    gap: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: 16,
  },
  loginButton: {
    marginTop: theme.spacing.lg,
  }
});
