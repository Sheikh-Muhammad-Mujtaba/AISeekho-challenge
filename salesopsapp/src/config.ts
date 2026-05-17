import RNConfig from 'react-native-config';

const Config = RNConfig as {
  API_URL?: string;
  NEON_AUTH_URL?: string;
  GOOGLE_WEB_CLIENT_ID?: string;
};
console.log('Config:', Config);
export const config = {
  API_URL: Config.API_URL || '',
  NEON_AUTH_URL: Config.NEON_AUTH_URL || '',
  GOOGLE_WEB_CLIENT_ID: Config.GOOGLE_WEB_CLIENT_ID || '',
};
