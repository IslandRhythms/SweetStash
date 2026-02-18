module.exports = {
  expo: {
    name: 'SweetStash',
    slug: 'SweetStash',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/app-icon.png',
    scheme: 'sweetstash',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/app-icon.png',
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
        foregroundImage: './assets/images/app-icon.png',
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
      [
        "@sentry/react-native/expo",
        {
          "url": "https://sentry.io/",
          "project": "react-native",
          "organization": "me-oa5"
        }
      ],
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
    experiments: {
      typedRoutes: true,
    },
  },
};
