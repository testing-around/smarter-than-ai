# Sideload the Android APK

This is a **standalone** build of Smarter Than AI (`com.smarterthanai.game`), not Expo Go. Microphone and speech recognition ship inside the APK.

## Install on a phone

1. Download `SmarterThanAI-1.0.4-preview.apk` (versionName **1.0.4**, versionCode **5**, neon brain + buzzer icon) from https://github.com/testing-around/smarter-than-ai/releases/download/v1.0.4-preview/SmarterThanAI-1.0.4-preview.apk (SHA-256 `07ec3c9ad05ab1741c01aa73206952f2229a58cd7b14e2f044aeccf67d9eab97`).
2. Open the file. If Android blocks it, allow **Install unknown apps** / **Install from this source** for Files, Chrome, or Drive — whichever you used to open the APK.
3. Tap **Install**, then **Open**.

You do not need Expo Go. First launch may ask for microphone / speech permissions if you use shout-out; tap answers always work without the mic.

## Rebuild

**Local (this repo, no Expo login):**

```bash
export ANDROID_HOME="$HOME/android-sdk"
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Use `assembleRelease`, not `assembleDebug`. React Native debug APKs skip the JS bundle (`debuggableVariants`) and need Metro. Release embeds the bundle so the APK is sideloadable without a computer.

**EAS (needs `eas login` or `EXPO_TOKEN`):**

```bash
npx eas-cli build -p android --profile preview
```

The `preview` profile in `eas.json` requests an **APK** (`buildType: apk`), not an AAB.
