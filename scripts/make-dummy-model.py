#!/usr/bin/env python3
"""Generate a tiny but *valid and runnable* dummy gesture model for smoke-testing
the inference pipeline without a real classifier.

Graph:  input[1,3,224,224]
          -> GlobalAveragePool  -> [1,3,1,1]
          -> Flatten            -> [1,3]   (mean R,G,B of the ROI)
          -> Gemm (W[3,6], b[6])-> logits[1,6]

The output depends on the crop's average colour, so Top-3 predictions actually
move as the hand/lighting changes — enough to verify the end-to-end chain.

Usage:
    python3 scripts/make-dummy-model.py            # -> public/models/gesture.onnx
    python3 scripts/make-dummy-model.py out.onnx

This is a developer convenience only; the real model is bring-your-own.
"""
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

NUM_CLASSES = 6  # must match public/models/labels.json length
IN_NAME = "input"
OUT_NAME = "logits"

# Fixed weights: map mean (R,G,B) -> 6 class logits. Distinct columns so the
# argmax shifts with colour instead of being constant.
W = np.array(
    [
        [2.0, -1.0, 0.5, 1.0, -0.5, 0.0],   # R -> classes
        [-1.0, 2.0, -0.5, 0.0, 1.0, 0.5],   # G -> classes
        [0.0, -0.5, 2.0, -1.0, 0.5, 1.0],   # B -> classes
    ],
    dtype=np.float32,
)
B = np.zeros((NUM_CLASSES,), dtype=np.float32)


def build() -> onnx.ModelProto:
    inp = helper.make_tensor_value_info(IN_NAME, TensorProto.FLOAT, [1, 3, 224, 224])
    out = helper.make_tensor_value_info(OUT_NAME, TensorProto.FLOAT, [1, NUM_CLASSES])

    w = numpy_helper.from_array(W, name="W")
    b = numpy_helper.from_array(B, name="B")

    nodes = [
        helper.make_node("GlobalAveragePool", [IN_NAME], ["pooled"]),
        helper.make_node("Flatten", ["pooled"], ["feat"], axis=1),
        helper.make_node("Gemm", ["feat", "W", "B"], [OUT_NAME], alpha=1.0, beta=1.0),
    ]
    graph = helper.make_graph(nodes, "dummy_gesture", [inp], [out], initializer=[w, b])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    model.ir_version = 9  # compatible with onnxruntime-web 1.x
    onnx.checker.check_model(model)
    return model


def main() -> None:
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/models/gesture.onnx")
    dest.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(build(), str(dest))
    print(f"wrote {dest} ({dest.stat().st_size} bytes), {NUM_CLASSES} classes")


if __name__ == "__main__":
    main()
