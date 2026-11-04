# Architecture

## Client (offline core)
Plain ES2020 scripts loaded in order by `index.html`. Each file attaches one module to the global `AGPS` namespace. There is no bundler, so the app runs from `file://`, from any static host, inside Capacitor, and inside Node's `vm` for tests.

```
util ─ schema ─ storage ─ i18n
          │
       context ── compiler ── image / meshy / gameplay / existing / android
                       │                       │
                    router (+ai client)    categories (workbench registry)
                       └──────── ui/app.js ────────┘
```

* **schema.js**: factories, normalisation of untrusted input, validation (characters, assets, projects), `exportProject` / `importProject` and `stripSecrets`.
* **storage.js**: IndexedDB stores `projects`, `templates` and `settings`, with an automatic in-memory fallback. Every project write runs through `stripSecrets`.
* **context.js**: the project summary, open questions, character locks, honest reference statements, and the minor-safety and clean-art rules.
* **compiler.js**: generators return a *spec* (`sections` of items tagged with a minimum quality level). The compiler filters items by quality, renders Markdown, splits prompts into phases, and implements Expand, Refine, the lint rules and Correct.
* **image / meshy / gameplay / existing / android**: one domain generator each. `categories.js` declares each workbench's option fields; the UI renders them generically.
* **router.js**: model catalog, complexity scoring, mode routing, cost estimates and the fetch client for the optional server.

## Optional AI backend (`server/server.js`)
Design goals: keys stay on the server, nothing is paid for without confirmation, and the app degrades gracefully.

| Concern | Implementation |
|---|---|
| Credentials | Read from the process environment (`ANTHROPIC_API_KEY`, or SDK-resolved credentials with `AGPS_ASSUME_CREDENTIALS=1`). Never accepted from requests, never logged, never returned. |
| Exposure | Binds to `127.0.0.1` by default. `AGPS_ACCESS_TOKEN` adds a passphrase header, compared in constant time. Cross-origin calls are rejected unless listed in `AGPS_ALLOWED_ORIGINS`. Prints a warning when listening publicly without a token. |
| Abuse limits | Model allowlist (`AGPS_MODELS`), per-IP rate limit, 8 MB body limit, prompt-size limit and a `max_tokens` ceiling. |
| Static files | Only `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `icons/` and the test specs are served. `server/`, `android/`, dotfiles and `node_modules` return 404. Path-traversal checks; `nosniff`, `no-referrer` and `DENY` headers. |
| API calls | Official `@anthropic-ai/sdk`, streaming with `finalMessage()`, `thinking: {type: "adaptive"}`, and `output_config.effort` mapped from the quality mode (low/medium/high). Claude Opus 5.5 and Sonnet 5.5 requests opt into server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`; turn off with `AGPS_REFUSAL_FALLBACK=0`). |
| Honest reporting | The response returns the model the API **reported** (`message.model`), usage, the stop reason and a fallback flag. A refusal returns HTTP 422 with no text. The UI labels AI versions with the served model and never claims a call that did not happen. |
| Errors | Typed SDK errors map to readable HTTP errors: auth → 502, rate limit → 429, bad request or not found → 400, connection → 503. |

Endpoints: `GET /api/status`, `POST /api/generate` `{model, system, prompt, instruction, note, quality}`, and `POST /api/analyze-image` `{model, mediaType, imageBase64, characterSpec}`.

### Model routing
| Mode | Behaviour |
|---|---|
| LOCAL | No model. The compiled prompt is copied into any tool by hand. |
| ECONOMY | The cheapest model enabled on the server. |
| INTELLIGENT | Complexity score (generator base + task type + input size + quality) → economy (<35), balanced (<70) or premium tier. |
| MAXIMUM QUALITY | Claude Opus 5.5 (`claude-opus-5-5`) for architecture, multi-system gameplay, debugging, continuity analysis, asset pipelines, long specs and Android failures. Routine tasks (formatting, copying, templates, metadata) go to the balanced tier to avoid unnecessary escalation. |

If the server is unreachable, has no credentials, or enables none of the catalog models, routing falls back to LOCAL and explains why. Before every paid request a modal shows the selected model, the reasoning and an estimated cost based on the editable catalog prices; you can change the model there.

A prompt cannot change the model used on claude.ai or other chat sites. The studio says this on the AI Models page.
