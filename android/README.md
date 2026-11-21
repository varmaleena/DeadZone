# Deadzone Android (Field SDK + demo app)

- `:deadzone-field` – library that watches real connectivity loss, captures the current screen and judges it with on-device Gemini Nano through Firebase AI Logic (`ONLY_ON_DEVICE`), then queues a field event in Firestore.
- `:app` – demo app (package `com.deadzone.freshcart`) used to pair with a workspace and exercise the SDK.

> Status: build files and the Gradle wrapper are in place, but the project has **not yet been compiled on a machine with the Android SDK**, and on-device inference has not been verified on a physical phone. Expect to fix compile errors on first build.

## Requirements

- Android Studio (latest stable) with Android SDK 35 and JDK 17+.
- A physical phone that supports Gemini Nano through ML Kit GenAI (check the supported-device list in the Firebase AI Logic hybrid docs). Phones without Nano record events as `pending`.
- Firebase project with Firestore, Anonymous Auth, App Check and Firebase AI Logic (Gemini Developer API) enabled.

## Setup

1. In the Firebase console, register an Android app with package `com.deadzone.freshcart`, download `google-services.json` and place it at `android/app/google-services.json` (git-ignored, never commit it).
2. Open the `android/` folder in Android Studio and let Gradle sync (it uses the wrapper in `gradle/wrapper`, Gradle 8.11.1).
3. Or build from a terminal:

   ```
   cd android
   ./gradlew :app:assembleDebug        # macOS/Linux
   gradlew.bat :app:assembleDebug      # Windows
   ```

4. Run the debug build, then copy the App Check debug token from Logcat and register it in Firebase console → App Check → Apps → Manage debug tokens.

## Using the demo

1. In the web console (Settings), copy the workspace ID and six-digit pairing code.
2. In the app, enter both and tap **Pair and arm field capture**.
3. Turn on airplane mode. After the settle delay the SDK captures the screen, judges it on-device and queues a field event.
4. Turn airplane mode off; the event syncs and appears on the console's **Field** page.

Library and plugin versions live in `gradle/libs.versions.toml`. API shapes follow <https://firebase.google.com/docs/ai-logic/hybrid/android/get-started>.
