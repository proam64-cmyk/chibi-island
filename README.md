# Chibi Island: Crystal Shores

Versión actual: **v0.6.0 — Alana + Rina (NPC) — Rei con 12 animaciones, estadio, villas de Harbor Bay** · Línea base aprobada: v0.1.1 · Pendiente de aprobación.

## Cómo ejecutarlo

Requisitos: Node.js 22 o superior y Google Chrome.

```bash
npm install          # una sola vez
npm run dev          # abre la URL que muestra (normalmente http://localhost:5173)
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta los tests unitarios (85) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run validate:shaders` | Valida el GLSL (océano, viento, toon con rim, contorno con esqueleto) con glslangValidator |
| `npm run build` | Build de producción en `dist/` |
| `npm run build:preview` | Un solo archivo HTML autocontenido en `dist-preview/` para compartir una prueba |

## Controles

WASD / flechas: mover · Shift: correr · Espacio: saltar · **H**: ayuda · **G**: bailar · **B**: voltereta · **P**: lanzar · **K**: golpes · **Q**: giro · **J**: salto feliz · **M**: caminar con estilo · Arrastrar (ratón o un dedo): girar cámara · Rueda o pellizco: zoom · **1–9 y 0**: viajar a una zona (ver `docs/ISLAND_MASTER_PLAN.md`) · **T**: marcadores de distrito · **R**: reiniciar el medidor de recorrido · **C**: ver la cápsula de colisión · **F3**: diagnóstico · **L**: idioma (ES / EN / JA).

## Estructura

```
src/
  config/      styleTokens.ts (STYLE_BIBLE en código), worldScale.ts, performanceProfiles.ts
  core/        EventBus, GameLoop, System
  render/      Renderer, Lighting, Sky, materials/ToonMaterial (toon + rim + contorno)
  assets/      AssetManifest, AssetLoader (progreso real, errores legibles), glbImages
  input/       InputManager (teclado, ratón, táctil)
  camera/      ThirdPersonCamera + cameraMath (lógica pura, testeada)
  world/       terrain/ (terreno de prueba 512 × 512 m), ocean/ (océano provisional)
  characters/  PlayerController (cápsula de debug 1,40 m), ReiStatic (validación de escala)
  debug/       DiagnosticsPanel (F3)
  ui/          LoadingScreen
  i18n/        es.json, en.json, ja.json
assets/        modelos optimizados que usa el juego (Vite les pone huella para la caché)
docs/          STYLE_BIBLE, ROADMAP, ASSET_REGISTRY, TEST_REPORT, VERSION_HISTORY, CHANGELOG…
tools/         inspect_glb.py, optimize-prop.mjs
tests/unit/    tests de Vitest
```

Los originales de Meshy no van en este repositorio: guárdalos en una carpeta `assets-src/` aparte y no los modifiques nunca.

## Publicación
El juego completo se publica en GitHub Pages en cada subida a `main` (tests → build → deploy). Guía: [`docs/HOSTING_GITHUB_PAGES.md`](docs/HOSTING_GITHUB_PAGES.md).
