/* Android Packaging Studio: Capacitor plans for HTML5 projects, engine-native plans otherwise. */
(function (A) {
  'use strict';
  const U = A.util, S = A.schema;
  const D = (A.android = {});

  D.PERMISSIONS = [
    { id: 'INTERNET', label: 'INTERNET (network access; included by Capacitor by default)', risk: 'normal' },
    { id: 'VIBRATE', label: 'VIBRATE (haptics)', risk: 'normal' },
    { id: 'ACCESS_NETWORK_STATE', label: 'ACCESS_NETWORK_STATE (detect offline)', risk: 'normal' },
    { id: 'POST_NOTIFICATIONS', label: 'POST_NOTIFICATIONS (Android 13+ runtime permission)', risk: 'runtime' },
    { id: 'RECORD_AUDIO', label: 'RECORD_AUDIO (microphone — avoid unless essential)', risk: 'dangerous' },
    { id: 'CAMERA', label: 'CAMERA (avoid unless essential)', risk: 'dangerous' },
    { id: 'READ_MEDIA_IMAGES', label: 'READ_MEDIA_IMAGES (prefer the system photo picker instead)', risk: 'dangerous' },
  ];
  D.BUILD_KINDS = [
    { id: 'all', label: 'Debug APK + signed APK + AAB' },
    { id: 'debug-apk', label: 'Debug APK only' },
    { id: 'release-apk', label: 'Signed release APK (direct install)' },
    { id: 'aab', label: 'Android App Bundle (Play Store)' },
  ];

  D.validateAppId = function (id) {
    const errs = [];
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(id || '')) errs.push('Application ID must look like com.studio.game (at least two dot-separated segments, each starting with a letter).');
    if (/[A-Z]/.test(id || '')) errs.push('Use lowercase for the application ID (convention; avoids case issues).');
    if (/(^|\.)(java|kotlin|android)(\.|$)/.test(id || '')) errs.push('Avoid reserved package names (java, kotlin, android).');
    if (/\.example(\.|$)|^com\.example/.test(id || '')) errs.push('com.example.* IDs are rejected by Google Play; choose your own domain.');
    return errs;
  };

  D.defaults = function (project, target) {
    const t = project.profile.title || project.name || 'Game';
    if (target === 'studio') return { appName: 'Anime Game Prompt Studio', appId: 'com.agps.promptstudio', orientation: 'any', webDir: 'www', engine: 'html5-canvas', renderMode: '2D' };
    return { appName: t, appId: 'com.yourstudio.' + U.slug(t).replace(/-/g, '').replace(/^[^a-z]+/, '') || 'game', orientation: project.profile.orientation || 'landscape', webDir: 'dist', engine: project.profile.engine, renderMode: project.profile.renderMode };
  };

  function orientationValue(o) { return o === 'landscape' ? 'sensorLandscape' : o === 'portrait' ? 'sensorPortrait' : 'unspecified'; }

  D.build = function (project, options) {
    const target = (options && options.target) || 'game';
    const def = D.defaults(project, target);
    const o = Object.assign({ tool: 'claude', buildKind: 'all', versionName: '1.0.0', versionCode: 1, minSdk: 24, targetSdk: 36, permissions: ['INTERNET'], ci: false }, def, options || {});
    Object.keys(def).forEach((k) => { if (!U.has(o[k])) o[k] = def[k]; });
    const q = A.compiler.qLevel(o.quality);
    const errs = D.validateAppId(o.appId);
    const vc = parseInt(o.versionCode, 10);
    if (!(vc >= 1 && vc <= 2100000000)) errs.push('versionCode must be a positive integer (≤ 2,100,000,000).');
    if (!/^\d+(\.\d+){0,3}([-+][\w.]+)?$/.test(String(o.versionName))) errs.push('versionName should look like 1.0.0.');
    if (+o.minSdk > +o.targetSdk) errs.push('minSdk cannot be higher than targetSdk.');
    if (errs.length) { const e = new Error(errs.join(' ')); e.validation = errs; throw e; }
    const eng = S.engine(target === 'studio' ? 'html5-canvas' : o.engine);
    const perms = U.list(o.permissions);
    const is3D = (target === 'studio' ? '2D' : o.renderMode) === '3D' || ['threejs', 'babylon', 'playcanvas'].includes(eng.id);
    const kinds = o.buildKind === 'all' ? ['debug-apk', 'release-apk', 'aab'] : [o.buildKind];
    const tool = A.gameplay.codeTool(o.tool);
    const sec = { role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [], questions: [] };

    sec.role.push('Android build & release engineer experienced with ' + (eng.family === 'html5' ? 'Capacitor, Gradle and Android WebView' : eng.label + ' Android export, Gradle and Google Play') + '.');
    sec.mission.push('Package ' + (target === 'studio' ? 'the Anime Game Prompt Studio web app' : '"' + o.appName + '" (' + eng.label + ')') + ' for Android: ' + kinds.map((k) => D.BUILD_KINDS.find((b) => b.id === k).label).join(', ') + '.');
    sec.mission.push('Compilation happens in a configured Android build environment (Android Studio / Android SDK + JDK, locally or in CI). A web browser alone cannot compile an APK or AAB; this document is the plan and the commands.');
    sec.context.push('App name: ' + o.appName + '; application ID: ' + o.appId + '; versionName ' + o.versionName + ', versionCode ' + vc + '.');
    sec.context.push('Engine/technology: ' + eng.label + ' (' + (eng.family === 'html5' ? 'HTML5 → Capacitor wrapper' : 'engine-native Android export; Capacitor is not appropriate') + ').');
    sec.context.push('Orientation: ' + o.orientation + '; minSdk ' + o.minSdk + '; targetSdk ' + o.targetSdk + ' (Google Play raises the required target API level yearly — confirm the current requirement in Play Console before release).');
    if (target === 'studio') sec.context.push('The studio repository already contains prompt-studio/android/ with package.json, capacitor.config.json and scripts/prepare-www.mjs. The packaged app runs in LOCAL mode: no API keys are bundled; AI features require a separately hosted backend.');

    sec.constraints.push('Never put API keys, keystore passwords or signing keys in the web bundle, the APK/AAB, or the repository. Use environment variables / CI secrets.');
    sec.constraints.push('Keep the upload/signing keystore backed up in two safe places; losing it blocks updates for APKs distributed outside Play.');
    sec.constraints.push('Request only permissions the game actually uses: ' + perms.join(', ') + '.');
    sec.constraints.push({ t: 'APK = direct installation/sideloading and testing. AAB = Google Play upload format (Play generates device-specific APKs; it cannot be installed directly).', q: 1 });

    sec.specs.push({ sub: 'Required tooling (verify current versions in official docs)', items: [
      'Android Studio (latest stable) with Android SDK Platform ' + o.targetSdk + ', Build-Tools and Platform-Tools (adb).',
      'JDK version required by the Android Gradle Plugin in use (recent AGP versions require JDK 17+; Android Studio bundles a suitable JDK).',
      eng.family === 'html5' ? 'Node.js LTS and npm (version supported by your Capacitor major version).' : eng.label + ' with its Android export templates/modules installed.',
    ] });

    const I = sec.instructions;
    if (eng.family === 'html5') {
      const webBuild = target === 'studio' ? 'node scripts/prepare-www.mjs' : 'npm run build';
      I.push({ sub: '1. Web build requirements', items: [
        target === 'studio' ? 'From prompt-studio/android/: `' + webBuild + '` copies index.html, css/, js/, icons/ and the manifest into www/ (server/ is excluded).' : 'Produce a static production build (`' + webBuild + '`) into `' + o.webDir + '/` with relative asset paths (e.g. Vite `base: "./"`).',
        'All assets local (no CDN dependencies) so the game works offline.',
        'No service-worker dependency for core functionality inside the WebView; assets are served from the app bundle.',
        { t: 'Keep the web build size reasonable: compress textures/audio; Play has size limits for the base module (use Play Asset Delivery for very large content).', q: 2 },
      ] });
      I.push({ sub: '2. Capacitor initialisation', items: [
        { code: [
          target === 'studio' ? 'cd prompt-studio/android' : '# in the game project root',
          'npm install @capacitor/core @capacitor/cli @capacitor/android',
          target === 'studio' ? '# capacitor.config.json is already present (appId ' + o.appId + ', webDir ' + o.webDir + ')' : 'npx cap init "' + o.appName + '" ' + o.appId + ' --web-dir=' + o.webDir,
          webBuild,
          'npx cap add android',
          'npx cap sync android',
        ].join('\n'), lang: 'bash' },
        'Re-run `' + webBuild + ' && npx cap sync android` after every web change.',
      ] });
      I.push({ sub: '3. Android platform setup & application ID', items: [
        'Confirm applicationId "' + o.appId + '" in android/app/build.gradle and the namespace; set versionCode ' + vc + ' and versionName "' + o.versionName + '" (increase versionCode for every upload).',
        'minSdkVersion ' + o.minSdk + ' / targetSdkVersion ' + o.targetSdk + ' in android/variables.gradle (Capacitor keeps SDK versions there).',
      ] });
      I.push({ sub: '4. Icons and splash screens', items: [
        'Provide a 1024×1024 PNG icon (with safe padding for adaptive icons) and a 2732×2732 splash source.',
        { code: 'npm install -D @capacitor/assets\nnpx capacitor-assets generate --android', lang: 'bash' },
        'Check adaptive icon cropping (circle, squircle) in Android Studio\'s preview.',
      ] });
      I.push({ sub: '5. Orientation & display', items: [
        'In android/app/src/main/AndroidManifest.xml on the main activity: android:screenOrientation="' + orientationValue(o.orientation) + '".',
        'Handle display cut-outs/safe areas in CSS (env(safe-area-inset-*)) and test immersive/fullscreen behaviour.',
        'Disable page zoom/scroll in the game page (viewport meta + touch-action: none on the canvas).',
      ] });
      I.push({ sub: '6. Permissions audit', items: [
        'Open the merged manifest (Android Studio → Merged Manifest tab) and list every permission, including those added by plugins.',
        'Keep: ' + perms.join(', ') + '. Remove anything else with tools:node="remove" if a plugin adds it unnecessarily.',
        perms.some((p) => D.PERMISSIONS.find((x) => x.id === p && x.risk !== 'normal')) ? 'Runtime permissions selected — request them only at the moment of use and handle denial gracefully; declare them in the Play Data safety form.' : 'Only normal permissions selected — no runtime prompts needed.',
      ] });
      I.push({ sub: '7. Offline asset handling', items: [
        'All game assets ship inside the app (www/ is bundled into the APK/AAB).',
        'Persist saves with IndexedDB/localStorage or @capacitor/preferences / @capacitor/filesystem; note that clearing app data deletes them — offer export if saves matter.',
        'Test with airplane mode on from first launch.',
      ] });
    } else {
      // engine-native alternative plans
      const native = {
        godot: ['Install Godot Android export templates (Editor → Manage Export Templates) and configure Android SDK/JDK paths in Editor Settings → Export → Android.', 'Project → Export → Add Android preset: set package/unique_name "' + o.appId + '", version/code ' + vc + ', version/name ' + o.versionName + ', screen orientation, permissions (' + perms.join(', ') + ').', 'Choose the renderer suitable for mobile (Mobile or Compatibility) and test both on low-end devices.', 'Debug APK: export with "Export With Debug" using the debug keystore; release: configure the release keystore in the preset (credentials via environment variables or a local untracked file).', 'AAB: enable Gradle build (Use Gradle Build) and export as AAB.'],
        unity: ['Install the Android Build Support module (SDK/NDK/OpenJDK) via Unity Hub.', 'Player Settings → Android: Package Name "' + o.appId + '", Version ' + o.versionName + ', Bundle Version Code ' + vc + ', Minimum API ' + o.minSdk + ', Target API ' + o.targetSdk + ', Scripting Backend IL2CPP, Target Architectures ARM64.', 'Publishing Settings: create/select the keystore (do not commit passwords).', 'Build Settings → Android: Build (APK) or tick "Build App Bundle (Google Play)" for AAB.', 'Texture compression ASTC; enable Development Build only for profiling builds.'],
        unreal: ['Install Android Studio and run Unreal\'s SetupAndroid script for the matching NDK; configure SDK paths in Project Settings → Android SDK.', 'Project Settings → Android: Android Package Name "' + o.appId + '", Store Version ' + vc + ', Version Display Name ' + o.versionName + ', Minimum/Target SDK, orientation, Distribution signing (keystore).', 'Package Project → Android (ASTC); enable "Generate bundle (AAB)" for Play.', 'Use the Mobile rendering path and profile with Unreal Insights on device.'],
        defold: ['Project → Bundle → Android Application: package "' + o.appId + '", version code ' + vc + ', architectures arm64-v8a (+ armv7 if needed).', 'Provide keystore and password file for release; choose APK or AAB bundle format in the bundle dialog / bob.jar.'],
        gamemaker: ['Install the Android SDK/NDK/JDK paths in Preferences → Platform Settings → Android.', 'Game Options → Android: package name "' + o.appId + '", version ' + o.versionName + ', orientation, permissions.', 'Target: Android → VM (debug) / YYC (release); build APK or AAB from the Create Executable dialog.'],
        other: ['Identify the engine\'s official Android export path before packaging; if it only outputs HTML5, use the Capacitor plan instead (switch engine to an HTML5 option).'],
      };
      I.push({ sub: 'Engine-native Android export (' + eng.label + ')', items: native[eng.family] || native.other });
      I.push({ sub: 'Permissions & offline', items: ['Audit the final merged manifest; keep only: ' + perms.join(', ') + '.', 'All content bundled; verify the game launches in airplane mode.'] });
    }

    I.push({ sub: 'Ultra-detail release checks', q: 3, items: [
      'Edge-to-edge: apps targeting API 35+ are drawn edge-to-edge by default — verify safe-area handling of HUD and touch controls under status/navigation bars.',
      eng.family === 'html5' ? 'WebView: define a minimum supported Android System WebView/Chrome version and show a friendly message on older ones (feature-detect, do not UA-sniff).' : 'Native libraries: verify 16 KB memory page size compatibility required by Google Play for new apps/updates targeting recent API levels (check the engine version release notes).',
      'APK/AAB size: record download and install size per release; investigate any growth over 10%.',
      'Pre-launch report: review the Play Console pre-launch report (crashes, accessibility, screenshots) for every internal-testing upload.',
      'Version policy: versionCode = YYMMDDnn or a strictly increasing integer; never reuse a versionCode.',
    ] });
    // builds
    const B = [];
    if (eng.family === 'html5') {
      if (kinds.includes('debug-apk')) B.push({ sub: 'Debug APK (testing, direct install)', items: [{ code: 'cd android\n./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug\n# output: android/app/build/outputs/apk/debug/app-debug.apk\nadb install -r app/build/outputs/apk/debug/app-debug.apk', lang: 'bash' }] });
      if (kinds.includes('release-apk') || kinds.includes('aab')) B.push({ sub: 'Signing setup (once)', items: [{ code: 'keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000\n# keep upload-keystore.jks OUT of the repository', lang: 'bash' }, 'Reference the keystore from android/app/build.gradle signingConfigs using values read from environment variables or an untracked keystore.properties file.'] });
      if (kinds.includes('release-apk')) B.push({ sub: 'Signed release APK (sideloading / direct distribution)', items: [{ code: 'cd android\n./gradlew assembleRelease\n# output: android/app/build/outputs/apk/release/app-release.apk\n# verify signature:\n$ANDROID_HOME/build-tools/<version>/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk', lang: 'bash' }] });
      if (kinds.includes('aab')) B.push({ sub: 'Android App Bundle (Google Play)', items: [{ code: 'cd android\n./gradlew bundleRelease\n# output: android/app/build/outputs/bundle/release/app-release.aab', lang: 'bash' }, 'Enrol in Play App Signing; you upload the AAB signed with your upload key, Google signs the delivered APKs.', { t: 'Test the AAB locally with bundletool (build-apks --connected-device, then install-apks).', q: 2 }] });
    }
    if (o.ci) B.push({ sub: 'CI build (optional)', items: ['Use a CI runner with JDK + Android SDK (e.g. GitHub Actions with actions/setup-java and the Android SDK preinstalled on ubuntu runners).', 'Store the keystore as a base64 secret and passwords as secrets; decode at build time; never echo them.', target === 'studio' ? 'A reference workflow is provided at prompt-studio/android/ci/android-build.yml.' : 'Upload the APK/AAB as build artifacts.'] });
    B.forEach((b) => I.push(b));

    // testing
    I.push({ sub: 'Installation & device testing', items: [
      'Install the debug APK on at least: one low-end/older device (minSdk ' + o.minSdk + ' range), one current mid-range phone, one tablet if supported.',
      'Touch controls: multi-touch, button sizes ≥ 48 dp, no accidental scroll/zoom, controls not covered by system gesture areas.',
      'Lifecycle: home button → resume, incoming call/notification, screen rotation (locked to ' + o.orientation + '), low-memory kill → save restored.',
      'Back button behaviour (pause menu / confirm exit, not instant quit).',
      'Audio starts after the first tap and pauses in background.',
      is3D ? 'WebGL checks: verify WebGL2 availability (fallback message if missing), context-loss handling (webglcontextlost/restored), texture memory, shader compile time on first load, sustained FPS after 10 minutes (thermal throttling).' : { t: 'Canvas performance: sustained FPS after 10 minutes; check for GC stutter.', q: 1 },
      'Remote debugging: chrome://inspect for WebView (debug builds) and `adb logcat` for crashes.',
    ] });

    sec.outputs.push(kinds.map((k) => ({ 'debug-apk': 'app-debug.apk', 'release-apk': 'app-release.apk (signed)', aab: 'app-release.aab (signed with upload key)' }[k])).join(', '));
    sec.validation.push({ sub: 'Play Store readiness checklist', items: [
      'Unique applicationId (' + o.appId + '); versionCode incremented for each upload.',
      'Target API level meets the current Google Play requirement.',
      'App icon (512×512 for the store listing), feature graphic 1024×500, phone screenshots from real gameplay.',
      'Privacy policy URL (required if any personal data or certain permissions are used).',
      'Data safety form completed accurately; content rating questionnaire done.',
      'Internal testing track first, then closed testing (new personal developer accounts must complete Google\'s closed-testing requirement before production — check current rules).',
      'No debug flags, no test API endpoints, no secrets in the bundle.',
    ] });
    sec.acceptance.push('Debug APK installs and runs offline on a physical device.');
    if (kinds.includes('release-apk')) sec.acceptance.push('Release APK signature verifies with apksigner.');
    if (kinds.includes('aab')) sec.acceptance.push('AAB uploads to the Play Console internal testing track without errors.');
    sec.recovery.push('Gradle fails → check JDK version, Android SDK platform installed, run `./gradlew clean`, read the first error in --stacktrace output.');
    sec.recovery.push('White screen on launch → wrong webDir or absolute asset paths; check chrome://inspect console.');
    sec.recovery.push('Keystore errors → confirm alias, passwords and path from environment; never commit them to fix the build.');
    sec.recovery.push('Use the Testing & Debugging category ("Android build / runtime failure") with the exact logs for deeper investigation.');
    sec.deliverables.push('Build artefacts listed above, plus a RELEASE_NOTES.md with versionName/versionCode and test results.');

    return {
      title: 'Android packaging — ' + o.appName + ' (' + (eng.family === 'html5' ? 'Capacitor' : eng.label + ' export') + ')',
      toolLabel: o.tool === 'manual' ? 'Manual checklist' : tool.label,
      stageLabel: 'Android packaging & release', toolTokenLimit: tool.tokenLimit, sections: sec,
      meta: { category: 'android', tool: o.tool, taskType: 'android-packaging', complexity: 50, routine: false, characterIds: [], usesCapacitor: eng.family === 'html5' },
    };
  };
})(globalThis.AGPS = globalThis.AGPS || {});
