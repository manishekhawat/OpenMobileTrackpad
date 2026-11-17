# OpenMobileTrackpad

Turns an Android phone (Android 9+) into a Bluetooth mouse. Nothing to install on the laptop.
iPhone isn't supported: iOS doesn't let apps act as a Bluetooth mouse.

## How it's built
- `App.tsx`, `src/Touchpad.tsx`: the screen and gestures, in TypeScript.
- `modules/hid-mouse/`: a local Expo native module in Kotlin. It registers the phone as a
  Bluetooth HID mouse using Android's `BluetoothHidDevice` API. React Native has no JS API for
  this, so the native module is needed.

Because of the native module, this **won't run in Expo Go**. Use a development build (below).

## Run it
Requirements: Node 20+, Android Studio (for the Android SDK), a real Android phone with
USB debugging on. The emulator has no Bluetooth.

```bash
npm install
npx expo run:android      # builds and installs on the connected phone
```

Or build in the cloud without Android Studio:
```bash
npx eas-cli@latest build --profile development --platform android
```

## Get the APK from GitHub (no Android Studio needed)
Every push to `main` builds an APK with GitHub Actions (`.github/workflows/build-apk.yml`).
Open the **Actions** tab → latest "Build APK" run → download **OpenMobileTrackpad-apk** under Artifacts.
Push a tag like `v1.0.0` to also attach the APK to a GitHub Release.

The APK is signed with a debug key: fine for installing on your own phone, not for the Play Store.

## First-time pairing
1. Remove any old pairing between the phone and laptop (on both devices).
2. Open the app and allow the Bluetooth permissions.
3. Tap **Make visible**.
4. On the laptop: Bluetooth settings → Add device → pick your phone. Confirm the code if asked.
5. If it doesn't connect by itself, tap **Connect** and choose your laptop.

## Gestures
- Drag with one finger: move cursor
- Tap: left click
- Two-finger tap: right click
- Two-finger drag: scroll
- Hold **Left** and drag on the pad: click-and-drag
