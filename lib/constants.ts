import Constants from 'expo-constants';

export const MAPTILER_API_KEY =
  Constants.expoConfig?.extra?.maptilerKey ??
  process.env.EXPO_PUBLIC_MAPTILER_KEY ??
  '';
