# Sideload the Android APK

This is a **standalone** build of Smarter Than AI (`com.smarterthanai.game`), not Expo Go. Microphone and speech recognition ship inside the APK.

## Install on a phone

1. Download `SmarterThanAI-1.0.6-preview.apk` (versionName **1.0.6**, versionCode **7**, early tap-in + voice abort fix from main) from https://github.com/testing-around/smarter-than-ai/releases/download/v1.0.6-preview/SmarterThanAI-1.0.6-preview.apk (SHA-256 `587679e7b4c4a3889acf5d53aed8a7ca90d39f8950c3ad325c99cae68bf01f1c`, 70409017 bytes). Previous: `SmarterThanAI-1.0.5-preview.apk` (1.0.5 / 6).
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
