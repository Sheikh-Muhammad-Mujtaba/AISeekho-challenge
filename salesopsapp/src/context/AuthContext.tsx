import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Keychain from 'react-native-keychain';
import axios from 'axios';
import { config } from '../config';

type User = {
  id: string;
  email: string;
  name?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, userData: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved token on app start
    const loadSavedCredentials = async () => {
      try {
        const credentials = await Keychain.getGenericPassword();
        if (credentials) {
          setToken(credentials.password);
          // Assuming username field stores a stringified user object or email
          // We'll just fetch user details if necessary or rely on token parsing.
          // For simplicity, we just set the token. 
          // Ideally you'd have a /me endpoint to validate the token.
          
          try {
            // Very simple validation check 
            // In a real app we'd fetch the user profile here
            setUser({ id: 'loaded-id', email: credentials.username });
          } catch (e) {
            await Keychain.resetGenericPassword();
          }
        }
      } catch (error) {
        console.error('Keychain load error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedCredentials();
  }, []);

  // Configure axios interceptor for API calls
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token && config.url?.startsWith(config.baseURL || '')) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  const signIn = async (newToken: string, userData: User) => {
    try {
      await Keychain.setGenericPassword(userData.email || 'user', newToken);
      setToken(newToken);
      setUser(userData);
    } catch (error) {
      console.error('Failed to save credentials', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await Keychain.resetGenericPassword();
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Failed to clear credentials', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
