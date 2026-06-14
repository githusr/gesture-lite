# Gesture Lite

Static, privacy-friendly **hand gesture recognition that runs entirely in the
browser**. The camera feed, hand detection, and gesture classification all
happen on-device — **no image ever leaves the page**, and there is no backend.

- 📷 Webcam via `getUserMedia`
- ✋ Hand detection with **MediaPipe Hand Landmarker** (GPU-accelerated)
- 🧠 Gesture classification with **onnxruntime-web**, your own ONNX model
- 🧵 Inference runs in a **Web Worker** so the UI never blocks
- 🪄 Temporal smoothing + confidence gating → stable predictions, `no_gesture` fallback
- 📱 Mobile-first, responsive; PC and mobile layouts
- 📦 Builds to a **fully static** bundle (offline-capable, deploy anywhere)

The classifier is **bring-your-own-model**: drop an ONNX file in and describe its
preprocessing in a small JSON config — no code changes required.

---

## Quick start

```bash
pnpm install
pnpm fetch:landmarker   # downloads MediaPipe hand_landmarker.task into public/models
pnpm dev                # http://localhost:5173
```

Open the page, allow camera access, and you'll see live hand tracking. To get
gesture predictions, add your model (next section). `pnpm build` produces a
static `dist/` you can host anywhere.

> Camera access requires a **secure context**: `localhost` works out of the box;
> any other host must be served over **HTTPS**.

## Bring your own model

Place three files in `public/models/`:

| File                | Required | Notes                                                  |
| ------------------- | -------- | ------------------------------------------------------ |
| `gesture.onnx`      | ✅       | Your classifier. Input is a square RGB image (e.g. 224²). |
| `labels.json`       | ✅       | Class names, **index-aligned** to the model output.    |
| `model.config.json` | optional | Preprocessing contract; defaults to ImageNet/224/NCHW. |

`labels.json` is either an array or `{ "labels": [...] }`:

```json
["fist", "open_palm", "pointing", "thumbs_up", "victory", "no_gesture"]
```

`model.config.json` tells the app how to turn a hand crop into your model's input
tensor. Per pixel/channel: `normalized = (pixel_uint8 * scale - mean) / std`,
with `mean`/`std` given in `channelOrder`.

```json
{
  "inputSize": 224,
  "scale": 0.00392156862745098,
  "mean": [0.485, 0.456, 0.406],
  "std": [0.229, 0.224, 0.225],
  "channelOrder": "rgb",
  "layout": "nchw",
  "applySoftmax": true,
  "roiPadding": 0.3
}
```

| Field          | Meaning                                                              |
| -------------- | ------------------------------------------------------------------- |
| `inputSize`    | Square input edge in pixels.                                        |
| `scale`        | Multiplier for the raw 0–255 pixel value (usually `1/255`).         |
| `mean`/`std`   | Per-channel normalisation, in `channelOrder`.                       |
| `channelOrder` | `"rgb"` or `"bgr"`.                                                 |
| `layout`       | `"nchw"` (PyTorch) or `"nhwc"` (TensorFlow).                        |
| `applySoftmax` | `false` if the model already outputs probabilities.                |
| `roiPadding`   | Fraction of padding added around the detected hand box.            |
| `inputName` / `outputName` | Override tensor names (defaults to the model's first). |

See [`public/models/README.md`](public/models/README.md) for common
normalisation presets (0–1, [-1, 1], ImageNet).

## Scripts

| Command                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `pnpm dev`              | Start the Vite dev server.                           |
| `pnpm build`            | Type-check (`tsc -b`) and build to `dist/`.          |
| `pnpm preview`          | Serve the production build locally.                  |
| `pnpm typecheck`        | Type-check only.                                     |
| `pnpm fetch:landmarker` | Download the MediaPipe hand landmarker model.        |

> **No model yet?** Generate a throwaway dummy classifier to smoke-test the
> pipeline end-to-end. It maps the crop's average colour to the example labels,
> so Top-3 visibly reacts to your hand:
>
> ```bash
> pip install onnx numpy                 # one-time, for the generator
> python3 scripts/make-dummy-model.py    # -> public/models/gesture.onnx
> ```

## How it works

```
                main thread                          worker thread
 ┌──────────────────────────────────────┐      ┌────────────────────────┐
 │ <video> ── MediaPipe HandLandmarker   │      │  onnxruntime-web        │
 │              │ landmarks              │      │  InferenceSession       │
 │              ▼                        │      │                         │
 │   computeRoi → padded square box      │      │  RGBA ─▶ normalise ─▶   │
 │              │                        │ RGBA │  CHW/HWC tensor ─▶ run  │
 │   RoiExtractor (canvas crop+resize) ──┼─────▶│  ─▶ softmax ─▶ probs ───┼─┐
 │              ▲ overlay (box+skeleton) │      └────────────────────────┘ │
 │   PredictionSmoother ◀────────────────┼───────────────  probs  ◀────────┘
 │              │ smoothed result        │
 │              ▼                        │
 │   React UI (label, Top-3, FPS)        │
 └──────────────────────────────────────┘
```

- **Detection** runs on the main thread every animation frame (MediaPipe is
  GPU-accelerated and light). The **heavy classification** is offloaded to a
  Web Worker; only a small 224×224 RGBA buffer is transferred (zero-copy).
- The loop is **latest-frame-wins**: a new classification is dispatched only when
  the worker is idle, so frames are dropped under load instead of queuing.
- **Smoothing** averages the last *N* probability vectors and applies a presence
  + confidence gate; when there's no hand or low confidence, it reports
  `no_gesture`.
- The ONNX WASM is single-threaded, so **no COOP/COEP cross-origin isolation
  headers are required** — the build runs on any plain static host.

## Deployment

`pnpm build` emits a self-contained `dist/` (app + ONNX/MediaPipe WASM). Host it
on any static service (GitHub Pages, Netlify, Cloudflare Pages, S3, …) over HTTPS.

The build uses a **relative base** (`base: './'`), so it also works from a
sub-path (e.g. `https://user.github.io/repo/`) with no configuration.

> The onnxruntime-web WASM binary is ~26 MB (~6 MB gzipped). It is cached after
> the first load. Inference runs single-threaded on the WASM backend for maximum
> compatibility (no COOP/COEP headers required).

## Troubleshooting

- **"摄像头权限被拒绝"** — allow camera access in the browser's site settings, or
  serve over HTTPS (required outside `localhost`).
- **"未能加载手势模型"** — `public/models/gesture.onnx` is missing or not a valid
  ONNX file. Hand tracking still works without it.
- **No hand detected** — run `pnpm fetch:landmarker`; ensure `hand_landmarker.task`
  exists in `public/models/`.
- **Predictions look wrong** — your `model.config.json` normalisation likely
  doesn't match training (`layout`, `channelOrder`, `mean`/`std`, `applySoftmax`).

## Tech stack

Vite · React · TypeScript · Tailwind CSS v4 · onnxruntime-web · @mediapipe/tasks-vision · pnpm
