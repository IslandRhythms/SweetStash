module.exports = {
  expo: {
    name: 'SweetStash',
    slug: 'SweetStash',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'sweetstash',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#FFF8F0',
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'SweetStash needs your location to track your trick-or-treat route on the map.',
        NSPhotoLibraryUsageDescription:
          'SweetStash needs access to your photos to add pictures of your candy and houses.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#FFF8F0',
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'READ_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'SweetStash needs your location to track your trick-or-treat route on the map.',
        },
      ],
    ],
    extra: {
      maptilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY || '',
    },
    experiments: {
      typedRoutes: true,
    },
  },
};
