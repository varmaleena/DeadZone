# Deadzone Field SDK

Catches real dead zones on Android: when the device loses validated connectivity, the SDK waits for the screen to settle, captures the bound Activity, judges the screen with on-device Gemini Nano through Firebase AI Logic (`ONLY_ON_DEVICE`), and queues a field event in Firestore. Events that couldn't be judged on-device stay `pending` and are judged in the cloud after reconnecting.

## Usage

```kotlin
// Once, after Firebase and App Check are initialised (see the demo's DeadzoneApp):
DeadzoneField.pair(workspaceId, pairingCode)          // 8-character code from the console

val field = DeadzoneField(applicationContext, workspaceId) { message -> log(message) }
field.bind(activity, "checkout")                       // call when the visible screen changes
field.start()                                          // stop() when done; start() can be called again
```

## What it writes

`workspaces/{id}/fieldEvents/{eventId}`: `deviceId`, `deviceModel`, `osVersion`, `appVersion`, `screen`, `summary` (visible text, max 1 KB), `thumb` (JPEG, max 120 KB), `verdict`, `judgedBy` (`on_device`, `cloud` or `pending`), `createdAt`, `syncedAt`.

`workspaces/{id}/devices/{deviceId}`: platform, model and on-device model status, used by the console's Coverage page.

## Notes

- Field events can contain text visible on screen. Use fictional data in demos and never capture screens with personal data.
- The cloud model name is `DeadzoneField.CLOUD_MODEL`; keep it in sync with Remote Config `dz_cloud_model`.
- Not yet compiled or verified on a physical device; see `android/README.md`.
