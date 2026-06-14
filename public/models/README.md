# Model assets

Drop your model files here. **None of these are uploaded anywhere** — they are
fetched by the browser at runtime and used for fully local inference.

| File                   | Required | What it is                                                            |
| ---------------------- | -------- | --------------------------------------------------------------------- |
| `gesture.onnx`         | ✅ yes   | Your static gesture classifier, exported to ONNX.                     |
| `labels.json`          | ✅ yes   | Class names, **index-aligned** to the model output.                   |
| `model.config.json`    | optional | Preprocessing contract (see below). Falls back to ImageNet defaults.  |
| `hand_landmarker.task` | ✅ yes   | MediaPipe Hand Landmarker model. Run `pnpm fetch:landmarker` to get it. |

> `*.onnx` and `*.task` are git-ignored (large binaries). Commit `labels.json`
> and `model.config.json` so the app's contract is version-controlled.

## `labels.json`

Either a plain array or `{ "labels": [...] }`. Order **must** match the model's
output logits. Include `no_gesture` only if your model predicts it — the app
also derives `no_gesture` on its own when no hand is present or confidence is low.

```json
["fist", "open_palm", "pointing", "thumbs_up", "victory", "no_gesture"]
```

## `model.config.json`

Describes how a hand crop becomes the input tensor, so you can swap models
without code changes. Any field may be omitted.

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

Per-pixel preprocessing is: `normalized = (pixel_uint8 * scale - mean) / std`,
with `mean`/`std` given in `channelOrder`. Common setups:

- **ImageNet (torchvision):** the defaults above.
- **Simple 0–1:** `mean: [0,0,0]`, `std: [1,1,1]`.
- **[-1, 1]:** `mean: [0.5,0.5,0.5]`, `std: [0.5,0.5,0.5]`.

Set `applySoftmax` to `false` if your model already outputs probabilities, and
`layout` to `"nhwc"` for TensorFlow-style models. Use `inputName`/`outputName`
to override tensor names if auto-detection (first input/output) is wrong.
