# Building the iOS and Android apps

The web app, iOS app, and Android app all run the exact same code (`App.tsx`
etc.) — Capacitor just wraps the built web bundle (`dist/`) in a native
shell. Neither native platform could be built or tested from the sandbox
that wrote this code (no Xcode/macOS for iOS; the Android SDK download host
is blocked by that sandbox's network policy), so both need a real machine.
Everything below is what's already done vs. what's left.

## Current plan: no store accounts, no cost, yet

Chosen for now, to avoid the $99/year Apple + $25 Google fees before there's
revenue to justify them:

- **Android**: a real native app (with the Voice Tutor), distributed as a
  direct APK download from the website — no Google Play Console needed at
  all for this, that fee is only for a Play Store *listing*. See
  "Android — direct download" below.
- **iOS**: the existing PWA (Safari → Share → *Add to Home Screen*) — this
  already works today, nothing new to build. Apple doesn't allow a real
  native app to be installed from a website without a paid Developer
  account, full stop, so there's no equivalent free path to a native iOS
  app. The trade-off: the Voice Tutor stays unavailable on iOS until that
  changes (it needs native speech recognition, not something the PWA path
  can provide). The full iOS build steps are still below, for whenever
  that's worth $99/year.

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

## Android — direct download (current plan, no Play Console account)

```sh
npm install
npm run build
npx cap sync android
npx cap open android      # opens the android/ folder in Android Studio
```

In Android Studio: **Build > Generate Signed Bundle / APK > APK** (not
"Android App Bundle" — that format is for Play Store uploads only, a direct
download needs a plain `.apk`). The first time, click "Create new..." to
make a signing keystore — save that keystore file and its passwords
somewhere safe outside this repo; the *same* keystore has to sign every
future release of this app, on Android or Play Store, forever. Losing it
means starting over as a brand-new app for anyone who already installed it.

Then, to actually publish it:

```sh
mkdir -p app
cp android/app/release/app-release.apk app/tiga-ai.apk   # path may vary slightly by Android Studio version
```

Edit `version.json`, set `"apkReady": true`, commit and push `app/tiga-ai.apk`
and `version.json` together. The website will then show an in-app "Get the
full Android app" banner (Android visitors only) linking straight to that
file — Android lets users install it after a one-time "allow installs from
this source" prompt, no Play Store involved.

**Every future update needs this repeated** (rebuild, re-export the signed
APK, overwrite `app/tiga-ai.apk`, push) *in addition to* `npm run release`
— the OTA mechanism below updates the JS/UI inside an already-installed
app, but the very first install always has to come from this APK file.

If you outgrow direct distribution later, the *only* extra thing a real
Play Store listing needs is a Google Play Console account ($25 one-time)
and uploading a Bundle instead — nothing about the app itself needs to
change.

## iOS (later — needs a paid Apple Developer account)

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
