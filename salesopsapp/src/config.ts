import Config from 'react-native-config';

export const config = {
  // Use .env value, fallback to emulator default if missing
  API_URL: Config.API_URL || 'https://ai-seekho-challenge.vercel.app/api',
  // Neon Auth Base URL
  NEON_AUTH_URL: Config.NEON_AUTH_URL || 'https://ep-steep-base-ap3934ra.neonauth.c-7.us-east-1.aws.neon.tech/neondb/auth',
};
