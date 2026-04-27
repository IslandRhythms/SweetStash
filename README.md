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

## TestFlight (iOS beta)

SweetStash is built with [Expo Application Services (EAS)](https://docs.expo.dev/eas/). TestFlight is Apple’s beta channel: you upload an App Store–style iOS build to App Store Connect, then invite testers from the TestFlight tab.

### Prerequisites

- **Apple Developer Program** membership (paid). You need access to [App Store Connect](https://appstoreconnect.apple.com/) and the [Apple Developer](https://developer.apple.com/) portal.
- **Expo account** (sign up at [expo.dev](https://expo.dev)). This repo is already linked to an EAS project via `app.config.js` (`extra.eas.projectId`).
- **Local tools**: Node.js, dependencies installed (`npm install`), and the EAS CLI (`npm install -g eas-cli` or use `npx eas-cli` below).

### One-time Apple and App Store Connect setup

1. In **Apple Developer → Identifiers**, ensure an App ID exists for the bundle identifier **`com.sweetstash.www`** (must match `app.config.js` → `ios.bundleIdentifier`).
2. In **App Store Connect → Apps**, create a new app with that **bundle ID**, name **SweetStash**, and the same primary language you plan to use for the store listing.
3. Accept agreements and fill in the minimum **App Privacy** details App Store Connect asks for; TestFlight internal testing still needs a coherent app record.

### MapTiler key on EAS builds (optional)

If you want MapTiler tiles in release builds, define the same variable EAS injects at build time:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_MAPTILER_KEY --value your_key_here --type string
```

Or configure it under **Environment variables** for your project on [expo.dev](https://expo.dev). Without it, the app falls back to the default map provider as described in [MapTiler API Key](#maptiler-api-key-for-maps) above.

### Build an iOS binary for TestFlight

From the project root, log in and start a **production** build (this matches `eas.json` → `build.production`, including `autoIncrement` for iOS build numbers):

```bash
eas login
eas build --platform ios --profile production
```

EAS will prompt for or create signing credentials the first time. When the build finishes, you get an `.ipa` on the Expo dashboard.

**Note:** The npm script `build:test:ios` uses the `preview` profile, which is set up for **internal** distribution (not App Store / TestFlight). For TestFlight, use `--profile production` as shown.

### Upload to App Store Connect

**Option A — EAS Submit (recommended)**

```bash
eas submit --platform ios --latest
```

Follow the prompts for Apple ID (and app-specific password) or an App Store Connect API key. EAS uploads the most recent successful production iOS build.

**Option B — Transporter**

Download the `.ipa` from the build page on [expo.dev](https://expo.dev), open Apple’s **Transporter** app on a Mac, and deliver the `.ipa` to App Store Connect.

### Enable testing in TestFlight

1. In App Store Connect, open your app → **TestFlight**.
2. Wait until Apple finishes **processing** the build (often minutes; sometimes longer for the first build).
3. **Internal testing**: add users with an App Store Connect role on your team; they can install as soon as processing completes (no beta review).
4. **External testing**: create a group, add testers’ emails, and submit the build for **Beta App Review** the first time you use external testers.

Bump **`version`** in `app.config.js` when you ship meaningful releases; the production profile’s **`autoIncrement`** in `eas.json` handles iOS build numbers for you.

## Tech Stack

- **Expo** (React Native) with expo-router
- **expo-sqlite** – Local database
- **expo-file-system** – Image storage
- **expo-image-picker** – Photo selection
- **expo-location** – Route tracking
- **react-native-maps** – Map display
