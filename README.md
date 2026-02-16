# SweetStash

A child-friendly Halloween candy tracking app for kids. Track your trick-or-treat haul, log houses, and see your route on the map!

## Features

- **Profiles** – No login required. Create local profiles for each trick-or-treater.
- **Log candy** – Add candy with name, quantity, and optional photo anytime.
- **Log houses** – Record houses with notes and optional photos.
- **Sessions** – Start a trick-or-treat session to track your route on the map (OpenStreetMap tiles via MapTiler).
- **Summary** – View your route and haul after each session.
- **History** – See past sessions and standalone candy/house logs.
- **Costumes** – Associate a costume with each session.

## Setup

### MapTiler API Key (for maps)

The app uses MapTiler for OpenStreetMap-style tiles. Get a free API key:

1. Sign up at [MapTiler Cloud](https://cloud.maptiler.com/)
2. Create an API key from your account dashboard
3. Create a `.env` file in the project root:

```
EXPO_PUBLIC_MAPTILER_KEY=your_api_key_here
```

The app will work without a key, but maps will fall back to the default provider (Apple/Google).

### Run the app

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Build for device

For a development build with native modules (recommended for full map support):

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

## Tech Stack

- Expo (React Native)
- expo-sqlite – Local database
- expo-file-system – Image storage
- expo-image-picker – Photo selection
- expo-location – Route tracking
- react-native-maps – Map display
