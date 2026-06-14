# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **frontend-only**, statically-deployable web app that does hand gesture
recognition in the browser: webcam → MediaPipe hand detection → ROI crop →
onnxruntime-web classification → smoothed result. No backend, no image upload.
The gesture model is **user-supplied** (bring-your-own ONNX).

## Commands

```bash
pnpm install
pnpm dev                # dev server (http://localhost:5173)
pnpm build              # tsc -b && vite build  → dist/
pnpm preview            # serve the built dist/
pnpm typecheck          # tsc -b (no emit)
pnpm fetch:landmarker   # download public/models/hand_landmarker.task
```

There is no test suite and no ESLint config; `pnpm typecheck` (strict TS) is the
gate. Always run it after changes.

## Architecture (the parts that span files)

**Pipeline orchestration lives in `src/hooks/useGesturePipeline.ts`** — read this
first; it wires everything together and holds the `requestAnimationFrame` loop.
The design deliberately splits work across two threads and three effects:

- **Main thread:** camera + MediaPipe `HandLandmarker.detectForVideo` (GPU,
  cheap) + canvas ROI crop/resize (`RoiExtractor`) + overlay drawing + the React
  UI. Runs every frame.
- **Worker (`src/workers/inference.worker.ts`):** owns the onnxruntime-web
  `InferenceSession`; receives a transferred RGBA crop, normalises it to a tensor
  (`imageDataToTensor`), runs the model, returns a probability vector.
  `src/lib/gestureClassifier.ts` is the main-thread RPC facade over it.
- The loop is **latest-frame-wins**: it dispatches a new classification only when
  the worker is idle (`busyRef`), dropping frames under load.

The hook uses **three effects on purpose** so concerns don't reload each other:
model/worker (dep: `executionProvider`), camera+landmarker+loop (deps:
`facingMode`, `detectionConfidence`), and a live-settings sync effect that
mutates refs the loop reads (thresholds, smoothing window, show-landmarks).

**`no_gesture` is derived, not predicted.** `src/lib/smoothing.ts`
(`PredictionSmoother`) keeps a window of recent probability vectors (or `null`
for "no hand") and collapses to `no_gesture` when either presence ratio or top
confidence is below threshold. It does **not** require the model to have a
`no_gesture` class.

**The model is described by data, not code.** `public/models/model.config.json`
(typed as `ModelConfig` in `src/lib/types.ts`, defaults in `src/lib/config.ts`)
controls `inputSize`, `scale`, `mean`/`std`, `channelOrder`, `layout`
(nchw/nhwc), `applySoftmax`, `roiPadding`. Preprocessing math is centralised in
`src/lib/preprocess.ts`. When changing model behaviour, prefer extending the
config + preprocess over hardcoding. **Never hardcode class names** — they come
from `public/models/labels.json`.

## Non-obvious things to preserve

- **UI copy is centralised** in `src/lib/i18n.tsx` (zh/en, auto-detected from
  `navigator.language`, switchable in the header, persisted). Components read
  strings via `useI18n().t` — never hardcode user-facing text; add new keys to the
  `Messages` interface + both `zh`/`en` tables. The pipeline surfaces camera/model
  failures as **codes** (`CameraErrorCode`/`ModelErrorCode`), translated at render
  so switching language updates errors live. Gesture **labels are not translated**
  (they come from the user's `labels.json`); only the synthetic `no_gesture` is.
- **ONNX WASM loading:** the worker imports `onnxruntime-web` and does **not**
  set `ort.env.wasm.wasmPaths`. Vite emits the `.wasm` as a hashed asset and ORT
  resolves it via `import.meta.url`. Don't add a `wasmPaths` / static-copy for
  ORT — it just duplicates a ~26 MB binary. `numThreads = 1` is intentional: it
  avoids needing COOP/COEP headers, keeping the build host-anywhere.
- **MediaPipe WASM** *is* copied, via `vite-plugin-static-copy` with
  `rename: { stripBase: true }` (v4's flatten) into `dist/wasm/mediapipe/`. It is
  loaded by path (`FilesetResolver`), not by the bundler.
- **Asset URLs:** everything user/runtime-loaded goes through `paths.*` in
  `src/lib/config.ts`, which resolves against `document.baseURI`. Combined with
  `base: './'` in `vite.config.ts`, this keeps sub-path deploys (GitHub Pages)
  working. Use `paths.*` for new runtime assets.
- **Worker typing:** the worker types `self` as `Worker` (`self as unknown as
  Worker`) to get the correct `postMessage(msg, transfer)` signature without
  pulling in the `WebWorker` lib (which conflicts with `DOM`). The tsconfig lib
  is `DOM` only — don't add `WebWorker`.
- **`Float32Array.buffer` is `ArrayBufferLike`** under TS 6; cast to `ArrayBuffer`
  at `postMessage` transfer sites.
- **pnpm:** `pnpm-workspace.yaml` sets `allowBuilds: { protobufjs: false }` to
  keep `pnpm install` clean/non-interactive (protobufjs comes via onnxruntime-web
  and its build script isn't needed). pnpm 11 reads settings from
  `pnpm-workspace.yaml`, not the `pnpm` field in `package.json`.

## Model assets are user-supplied

`public/models/{gesture.onnx,hand_landmarker.task}` are **git-ignored** large
binaries and won't exist on a fresh clone. The app handles their absence
gracefully (camera + tracking still run; a friendly banner shows for a missing
gesture model). `labels.json` and `model.config.json` are committed examples —
keep them valid.
