# Building the iOS and Android apps

The web app, iOS app, and Android app all run the exact same code (`App.tsx`
etc.) — Capacitor just wraps the built web bundle (`dist/`) in a native
shell. Neither native platform could be built or tested from the sandbox
that wrote this code (no Xcode/macOS for iOS; the Android SDK download host
is blocked by that sandbox's network policy), so both need a real machine.
Everything below is what's already done vs. what's left.

## Already done

- `capacitor.config.ts` — appId `com.tigaalpha.tigaai`, bundled `webDir`
  (not a remote URL — see the OTA section below for why).
- `android/` and `ios/` native projects generated and committed, with:
  - Mic/camera/speech permissions declared (`AndroidManifest.xml`,
    `Info.plist`).
  - App icon + splash screen generated from `public/icon.svg`.
  - The `com.tigaalpha.tigaai://` deep-link scheme registered on both
    platforms (needed for native Google/Facebook sign-in).
- AI Voice Tutor restored and gated to native-only (`isNative` check in
  `App.tsx`), using a native speech-recognition plugin instead of the
  browser API that doesn't work in an embedded WebView.
- OTA update mechanism wired (`native-updater.ts`) so ordinary
  code/content changes reach both apps via `npm run release`, without a
  new store submission every time.

## Prerequisites

- **Android**: [Android Studio](https://developer.android.com/studio)
  (includes the SDK) or the command-line SDK tools, on any OS. A [Google
  Play Console](https://play.google.com/console) account ($25 one-time) to
  publish.
- **iOS**: a **Mac** with [Xcode](https://apps.apple.com/app/xcode/id497799835)
  installed. An [Apple Developer Program](https://developer.apple.com/programs/)
  account ($99/year) to run on a real device or publish.
- Node.js (same version used to develop this app) and this repo cloned.

## Android

```sh
npm install
npm run build
npx cap sync android
npx cap open android      # opens the android/ folder in Android Studio
```

In Android Studio: let Gradle sync, connect a device or start an emulator,
then Run. For a signed release build, use Android Studio's **Build > Generate
Signed Bundle/APK** flow (you'll need to create a signing keystore — keep it
somewhere safe, losing it means you can never update the app on Google Play
again under the same listing).

## iOS

```sh
npm install
npm run build
npx cap sync ios
npx cap open ios          # opens ios/App/App.xcworkspace in Xcode
```

One extra step the sandbox couldn't run: `@capacitor-community/speech-recognition`
doesn't ship a `Package.swift`, so `cap sync` warned it isn't fully
Swift-Package-Manager compatible. If Xcode can't resolve it via SPM, install
[CocoaPods](https://cocoapods.org/) and run `pod install` inside `ios/App`
instead — Capacitor supports both, this project just hasn't needed Pods
until this plugin.

In Xcode: select your Team under **Signing & Capabilities** (this is where
your $99/year Apple Developer account gets used), pick a device or
simulator, then Run. Note the simulator's on-screen mic won't produce real
speech-recognition results — test that specific feature on a real device.

## Releasing an update

Every push to `main` already updates the website instantly, same as before.
To push that same change into the native apps without a new store
submission:

```sh
npm run release     # builds, zips dist/ to updates/dist-<version>.zip,
                     # writes updates/manifest.json, syncs both native projects
```

Then commit and push as usual (`App.tsx`, `updates/`, and the native
project folders if `cap sync` changed anything). The next time either app
is opened, it checks `updates/manifest.json` and downloads the new bundle
if the version differs.

**Before running this**, bump the version in *two* places so they match:
`package.json`'s `"version"` and `APP_VER` near the top of `App.tsx`. If
they don't match, the app will think every launch needs an update and
re-download the same bundle repeatedly.

**A new store submission (not just `npm run release`) is only needed for:**
native permission changes, adding/changing a native plugin, the app icon,
or the bundle ID/app name. Everything else — UI, features, copy, the AI
prompts, pricing, translations — ships through the OTA update above.

## Things worth testing on a real device before shipping

- **Thai and Chinese speech recognition quality** on both platforms — the
  native plugin uses the OS's own recognizer (Apple's `SFSpeechRecognizer`,
  Android's `SpeechRecognizer`), and on-device language support/quality
  varies by OS version in ways that can't be verified without real
  hardware.
- **The AI Voice Tutor's turn-taking feel** — `native-stt.ts` reports every
  recognized phrase as "interim" (the native plugin doesn't distinguish
  final from partial results the way the browser API does), relying on the
  existing silence-timer logic in `vmSpawnEar()` to decide when you've
  finished talking. It's designed to work this way, but is worth a real
  listen.
- **Google/Facebook sign-in end-to-end** — opens a system browser tab and
  returns via the custom URL scheme; confirm the redirect actually lands
  back in the app on both platforms, and that `com.tigaalpha.tigaai://auth-callback`
  is added to the Supabase Auth dashboard's allowed redirect URLs (it isn't
  yet — that's a dashboard setting, not something in this repo).
- **First-launch permission flow** — the mic/camera primer screen, then the
  real OS permission dialogs, for both the Voice Tutor and the camera-based
  Hand-Posture Coach.
