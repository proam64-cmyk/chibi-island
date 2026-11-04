# Android packaging

Two targets are supported.

## A. The studio itself (Capacitor)
The packaged app runs in **LOCAL mode**. No server and no API keys are bundled. `prepare-www.mjs` copies only the static app and stops the build if it finds anything that looks like a secret.

```bash
cd prompt-studio/android
npm install                      # @capacitor/core, cli, android, assets (v8.x)
npm run prepare:web              # copies the app into www/
npx cap add android              # once; creates android/ (Gradle project)
npx cap sync android
# optional: icons/splash from resources/icon.png (1024²) and resources/splash.png (2732²)
npm run assets
```

| Output | Command | File |
|---|---|---|
| Debug APK (direct install for testing) | `npm run build:debug` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Signed release APK (sideloading) | `npm run build:release` | `android/app/build/outputs/apk/release/app-release.apk` |
| Android App Bundle (Google Play) | `npm run build:aab` | `android/app/build/outputs/bundle/release/app-release.aab` |

For release signing, create an upload keystore with `keytool -genkeypair …`, paste `signing.gradle.example` into `android/app/build.gradle`, and provide the passwords as environment variables. Never commit the keystore. `ci/android-build.yml` is a reference GitHub Actions workflow; copy it into `.github/workflows/` to use it.

Install for testing: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

**APK vs AAB:** an APK installs directly on a device. An AAB is the format you upload to Google Play; Play generates device-specific APKs from it, and an AAB cannot be installed directly.

Requirements to verify against current official docs: Android Studio with an SDK platform matching `targetSdk`, the JDK required by the Android Gradle Plugin (17+ for recent versions; Android Studio bundles one), and Node.js LTS.

**Neither a browser nor this studio compiles APKs.** Builds run in a configured local or CI Android environment.

## B. Games managed in the studio
Open **Android Packaging** in a project and press **Generate**. The plan adapts to the engine:

* **HTML5 engines** (Canvas, Phaser, Pixi, Three.js, Babylon, PlayCanvas, RPG Maker MZ, Construct): a Capacitor plan covering the web build, init, application ID, icons and splash, orientation, a permissions audit, offline assets, debug APK, signed APK, AAB, device testing, and WebGL checks for 3D games.
* **Godot, Unity, Unreal, Defold, GameMaker**: an engine-native export plan instead of Capacitor.
* Every plan includes touch-control and lifecycle tests, a Play Store readiness checklist and failure recovery steps. ULTRA adds edge-to-edge, WebView or 16 KB page-size notes, size tracking and pre-launch report checks.

The application ID, versionName and versionCode, and the minSdk/targetSdk combination are validated. `com.example.*` IDs are rejected because Google Play refuses them.
