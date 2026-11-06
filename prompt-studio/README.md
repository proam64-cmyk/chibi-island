# Anime Game Prompt Studio

A game-development **prompt production environment** for solo anime game developers. It turns a game concept (or an existing game) into detailed, tool-specific production prompts for image generators, Meshy 3D, coding assistants (Claude, Codex, Gemini) and Android release, while keeping characters on-model and protecting work that already exists.

- **Offline-first.** Every prompt is compiled locally in the browser. No account, subscription or API key is needed.
- **Persistent.** Projects, characters, assets and prompt history are stored in IndexedDB, with autosave and JSON import/export.
- **Optional AI backend.** A small Node server can call the Claude API with a key kept **on the server only**. It supports ECONOMY, INTELLIGENT and MAXIMUM QUALITY routing, shows a cost estimate, and asks you to confirm before each paid request.
- **Interface in English or Spanish.** Generated technical prompts are always in English.

> This folder is self-contained and separate from the Chibi Island game in the repository root. It does not change the game's build, tests or dependencies.

---

## Quick start

### Option A: no installation
Open `prompt-studio/index.html` in Chrome, Edge or Firefox. Everything works in LOCAL mode. Some browsers block IndexedDB for `file://` pages; if that happens the studio warns you and keeps data in memory, so export your project before closing the tab.

### Option B: local server (recommended, needed for AI features)
```bash
cd prompt-studio
npm start                       # serves http://127.0.0.1:8787/  (AI disabled, LOCAL mode)
```
To enable AI-assisted generation:
```bash
cd prompt-studio/server && npm install        # installs @anthropic-ai/sdk (once)
cd ..
ANTHROPIC_API_KEY=sk-ant-...  npm start       # key lives only in the server process
```
Then open **AI Models**, choose ECONOMY, INTELLIGENT or MAXIMUM QUALITY, and press **Check connection**.

Requirements: Node.js 18 or newer for the server and tests. The app itself is plain HTML, CSS and JavaScript with no build step.

### Tests
```bash
cd prompt-studio
npm test           # 110 unit, integration and server tests (Node, no network, no key)
npm run test:e2e   # 19 browser end-to-end checks (needs Playwright + Chromium installed)
```
The same unit suite also runs inside the app: **QA & Diagnostics → Run automated tests**. It uses an isolated in-memory store.

---

## What it does

| Area | What you get |
|---|---|
| **Projects** | *Create new game* or *Improve existing game*; samples; duplicate; JSON import/export (single project or all projects); autosave. |
| **Game Profile** | Title, story, genre and subgenres, 2D/2.5D/3D, platforms, engine, FPS, orientation, combat, abilities, world, progression, art, animation, saves, controls, difficulty and audio, with validation. **Stages & audio**: list every stage, level or screen and assign its music and ambience from the audio files in the Asset Registry; the gameplay *Audio integration* prompt then includes a per-stage audio map with asset IDs and file names. |
| **Existing Project** | Source manifest (you can read **file paths only** from a folder), working systems, requested changes, known bugs, art references, constraints and version control. |
| **Characters** | A permanent continuity spec: ID, age category, proportions, face, hair, eyes, costume, weapons, palette (validated hex), allowed transformations, art style, linked reference assets and forbidden changes. A *continuity lock* built from this spec is reused in every prompt. |
| **Asset Registry** | Asset ID, name, role, source tool, version, format, target game, dependencies, approval status, character link, workflow stage and an optional public URL. File import records metadata and a small image preview. Contents are **not analysed** unless you explicitly run AI image analysis. |
| **Asset Workflow** | Per-character pipeline: concept → master sheet → 2D asset → 3D reference → Meshy generation → refinement → game integration. Each stage shows its status and has a one-click prompt. |
| **Workbenches** | Game Planning · Anime Image Prompts · Meshy 3D Studio · Gameplay Engineering · Existing Game Safety · Testing & Debugging · Android Packaging. |
| **Prompt actions** | Generate · Expand · Refine · Correct · Compare versions · Copy · Export (.md/.txt/.json) · Send to AI model · Save version · Save as template · split into coordinated phases. |
| **Library** | Built-in and user templates with `{{placeholders}}`. Prompt history (up to 300 versions per project) with restore, compare, copy and download. |
| **AI Models** | Mode selection, an editable model catalog with prices, server connection status and a routing preview. |
| **QA & Diagnostics** | In-browser test run, a manual checklist and environment information. |

### Prompt structure
Every compiled prompt follows the same section order: assigned expert role → mission → relevant project context → approved visual references → non-negotiable constraints → technical specifications → detailed implementation instructions → asset output requirements → validation checklist → acceptance tests → failure recovery → final deliverables, plus open questions where needed. Image and Meshy prompts start with a **copy-ready block** in the target tool's own syntax.

Quality modes:
- **STANDARD** is compact.
- **PROFESSIONAL** adds edge cases, failure scenarios, rendering and lighting detail, and provider notes.
- **ULTRA DETAILED** adds data contracts, debug hooks, determinism, texel density, compression, risk registers, device matrices, impact matrices and release checks.

**Expand** at ULTRA adds an assumption register, a risk table and a self-review pass.

### Provider adapters (images)
| Tool | Output format |
|---|---|
| ChatGPT Image | Natural-language prose. Snaps to the supported sizes (1024² / 1024×1536 / 1536×1024) and tells you to crop otherwise. Negatives go in an *Avoid:* sentence. Approved masters are attached in the chat. |
| Gemini image | Prose, aspect ratio stated in words, several reference images attached together. |
| Midjourney | A single line with `--ar`, `--niji 6` or `--v 7`, `--stylize`, `--no …`, `--tile` for tilesets, `--sref`, and `--cref/--cw` (V6/Niji) or `--oref/--ow` (V7). Reference parameters are added only when an **approved** asset has a public https URL. |
| Leonardo AI | Separate *Prompt* and *Negative prompt* fields, trimmed to 1,000 characters, plus pixel dimensions. |
| Custom | You configure the style (tags or prose), how negatives are given, the aspect syntax, the length limit and a reference note in **Settings**. |

---

## Honesty and safety rules built into the engine
- No prompt claims that a reference image or source file was seen unless an AI analysis is stored on that asset.
- When no master reference exists, the prompt says so and treats the output as a candidate.
- Existing-project prompts always include preservation requirements, an audit, a backup checkpoint, a minimal plan, regression tests and rollback steps. **Correct** rewrites "rewrite the entire game"-style instructions.
- Characters in the teen or child age categories always get an age-appropriate, non-sexualised constraint.
- Android plans say that compilation needs a configured Android build environment; a browser cannot build an APK or AAB.
- The prompt checker flags key-shaped secrets, Midjourney syntax in other tools, unfilled placeholders, false model claims and missing continuity locks. **Correct** auto-fixes most of these.
- API keys are stripped from IndexedDB writes and exports, never reach the browser, and are blocked from the Android bundle by `prepare-www.mjs`.

## Folder layout
```
prompt-studio/
  index.html, manifest.webmanifest, sw.js, icons/   app shell (PWA, offline cache)
  css/studio.css                                     theme + responsive layout
  js/core/      util, schema (data model/validation/import/export), storage (IndexedDB), i18n
  js/engine/    context, compiler, image, meshy, gameplay, existing, android, router, categories
  js/data/      presets (Anime War Arcade, KODAMA), templates
  js/ui/app.js  views, actions, autosave, AI flow
  schemas/      JSON Schemas: project, character, asset
  server/       optional backend (Node http + @anthropic-ai/sdk)
  android/      Capacitor packaging for the studio itself
  tests/        harness + specs (shared by Node and the in-app QA), server tests, e2e
  docs/         ARCHITECTURE.md, ANDROID.md, TESTING.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the backend design, [docs/ANDROID.md](docs/ANDROID.md) for packaging, and [docs/TESTING.md](docs/TESTING.md) for test results and known limitations.
