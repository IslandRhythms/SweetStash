# SweetStash

A child-friendly Halloween app for tracking your trick-or-treat haul. Log candy and houses, run a session to record your route on the map, and look back at past sessions.

## Features

- **Home** – Greeting and shortcuts to log your haul or start a trick-or-treat session.
- **My Stash** – Log candy (name, quantity, optional photo) and houses (name, notes, optional photo). Optionally link candy to your active session. Mark candy and houses as favorites.
- **Session** – Start a trick-or-treat session, pick or add a costume, and track your route on the map. Add house visits and log candy as you go. End the session to see a summary (route and haul).
- **History** – Browse past sessions (with candy and house counts). Tap a session to view its route and haul summary.
- **Settings** – Switch or add profiles (no account required). Set light, dark, or system theme. Optionally load sample data for development.

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
npm start
```

Or use `npx expo start`. Then scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Seeding (development)

To generate a sample SQLite database with profiles, sessions, candy logs, and houses (written to `scripts/seed/output/sweetstash.db`):

```bash
npm run seed
```

### Build for device

For a development build with native modules (recommended for full map support):

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

## Tech Stack

- **Expo** (React Native) with expo-router
- **expo-sqlite** – Local database
- **expo-file-system** – Image storage
- **expo-image-picker** – Photo selection
- **expo-location** – Route tracking
- **react-native-maps** – Map display
