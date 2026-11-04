# Testing & known limitations

## How to run
```bash
cd prompt-studio
npm test            # Node: unit + integration + server + schema-sync tests
npm run test:e2e    # Playwright/Chromium end-to-end (skips if Playwright is not installed)
```
In the app: **QA & Diagnostics → Run automated tests** runs the same unit and integration specs in the browser against an isolated in-memory store. The page also has a manual checklist.

## Latest results
`npm test`: **96 passed, 0 failed**

| Suite | Tests | Covers |
|---|---|---|
| Utilities | 3 | diff, template rendering, list/slug/hex helpers |
| Schema & validation | 6 | defaults, invalid fields (name, ID, palette, FPS, URLs, links), duplicate IDs, garbage normalisation, minors |
| Export & import | 5 | round trip, secret stripping, readable errors (invalid JSON, wrong shape, newer schema), ID collisions |
| Storage | 1 | put/get/list/delete, copy isolation, secrets never persisted, default settings |
| Preset profiles | 4 | both presets valid and flagged as samples, four pilots, existing mode, no character/system mixing |
| Templates | 3 | filling, `[MISSING: …]` detection, template-from-text |
| Prompt generation | 3 | every workbench × quality × preset with no checker errors, quality ordering, empty projects |
| Image provider adapters | 9 | Midjourney/ChatGPT/Gemini/Leonardo/custom syntax, `--tile`, parallax layers, required character, clean art |
| Character continuity & references | 6 | continuity lock in every provider, missing/unanalysed/analysed references, Midjourney URLs, minors |
| Meshy 3D Studio | 6 | polygon budgets, all 10 steps + checklists, 600-character prompt limit, multi-view references, custom targets, static props |
| Gameplay engineering | 4 | requirement categories, intercept code, genre defaults, preservation constraints, per-tool framing |
| Existing project safety | 4 | full package, no-manifest honesty, audit-only, non-git backups |
| Android packaging | 6 | Capacitor commands, Godot/Unity native plans, WebGL checks, studio target, ID/version validation |
| Compiler actions | 6 | phase splitting, expand, refine, correct (destructive/secret/false-analysis/MJ syntax/APK claims), model-claim lint, `--ar` fix |
| Model routing | 12 | LOCAL, backend-unavailable fallback, ECONOMY, INTELLIGENT tiers, MAX → Opus 5.5, routine non-escalation, missing Opus, manual selection, cost, system prompt, unreachable status |
| Server (optional backend) | 14 | static serving, traversal blocking, no-credential behaviour, key never returned, request parameters (adaptive thinking, effort, refusal fallback), allowlist, CORS, image validation, rate limit, passphrase, refusal → 422, upstream error mapping |
| JSON Schemas | 4 | schema enums in sync with the runtime, export format |

`npm run test:e2e`: **18 passed, 0 failed**. The app loads with no page errors. The run covers: loading a preset; generating a Midjourney master sheet; Correct redacting a secret; compare; the LOCAL fallback explanation for AI; three coordinated phases; the Android plan; persistence after reload (IndexedDB); history restore; palette validation; file import without analysis claims plus the analysis-unavailable dialog; JSON export and re-import; the in-app QA suite passing in Chromium; the Spanish UI; mobile at 360 px (8 views, no horizontal overflow, working menu, touch targets ≥ 34 px); and the AI flow against the server with a mocked Claude client (MAXIMUM QUALITY → Opus 5.5, nothing sent before confirmation, served model labelled).

`android/scripts/prepare-www.mjs` was run: it copies 25 files and its secret scan passes. It correctly failed while test fixtures still contained key-shaped literals; those fixtures are now built at runtime.

## Known limitations
* **No real API call was made during testing.** No API key was available, so the server's Claude integration was tested with a mock that mirrors the SDK interface (`messages.stream(...).finalMessage()`). The installed SDK is `@anthropic-ai/sdk` 1.5.0. Do a first real request with a small prompt and check the reported model and usage.
* **No APK or AAB was compiled here.** There is no Android SDK or JDK in this environment. The Capacitor configuration, scripts, signing example and CI workflow follow the documented Capacitor 8 / Gradle flow but have not been run end to end.
* **Third-party tool syntax changes.** Midjourney parameters (`--oref` and `--cref`, Niji/V versions), the Leonardo field limits, the Meshy 600-character prompt limit and setting names, ChatGPT image sizes, and Google Play requirements (target API level, closed testing, 16 KB pages) reflect current knowledge. Prompts mark these items "verify". Provider behaviour can be adjusted in Settings (custom providers) and in the model catalog.
* **Generation is rule-based in LOCAL mode.** Prompt quality depends on how complete the profile and character specs are. Empty fields become explicit open questions rather than invented details.
* **Image generators and sprite sheets.** Prompts state that generators do not produce exact frame grids or real transparency; manual slicing or keying is expected.
* **Asset files are not stored.** The registry keeps metadata and, for images, a downscaled preview (768 px JPEG), which is what AI analysis sees. Meshes and audio are not inspected.
* **`file://` usage.** Some browsers disable IndexedDB or service workers for local files. The app then keeps data in memory and warns you to export. Run `npm start` for full persistence and offline caching.
* **Translation coverage.** The interface (navigation, forms, buttons, dialogs) is translated to Spanish. Some dynamic engine messages (validation details, routing reasons, checker messages) stay in English, as do all generated prompts by design.
* **Single user, single device.** There is no cloud sync. Move data between devices with JSON export and import.
