import * as ort from 'onnxruntime-web'
import { imageDataToTensor, softmax } from '../lib/preprocess'
import type { ModelConfig, WorkerRequest, WorkerResponse } from '../lib/types'

// ---------------------------------------------------------------------------
// Dedicated worker: owns the onnxruntime-web session and runs the heavy
// normalise + matmul work off the UI thread. It receives raw RGBA crops and
// returns a probability vector.
//
// `self` is typed as `Worker` (DOM lib) to get the correct postMessage(message,
// transfer) signature without pulling in the conflicting WebWorker lib.
// ---------------------------------------------------------------------------

const ctx = self as unknown as Worker

function post(msg: WorkerResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer)
}

let session: ort.InferenceSession | null = null
let config: ModelConfig | null = null
let inputName = ''
let outputName = ''

async function init(msg: Extract<WorkerRequest, { type: 'init' }>): Promise<void> {
  config = msg.config

  // The WASM binary is emitted by Vite as a hashed asset and resolved via
  // import.meta.url, so no wasmPaths configuration is needed. Single-threaded
  // avoids requiring COOP/COEP cross-origin isolation, so the static build runs
  // on any plain host (GitHub Pages, S3, ...).
  ort.env.wasm.numThreads = 1

  session = await ort.InferenceSession.create(msg.modelUrl, {
    executionProviders: msg.executionProviders,
    graphOptimizationLevel: 'all',
  })

  inputName = config.inputName ?? session.inputNames[0]
  outputName = config.outputName ?? session.outputNames[0]
  post({ type: 'ready', inputName, outputName })
}

async function infer(msg: Extract<WorkerRequest, { type: 'infer' }>): Promise<void> {
  if (!session || !config) throw new Error('inference session is not initialized')

  const data = imageDataToTensor(msg.image, config)
  const size = config.inputSize
  const dims = config.layout === 'nchw' ? [1, 3, size, size] : [1, size, size, 3]
  const input = new ort.Tensor('float32', data, dims)

  const outputs = await session.run({ [inputName]: input })
  const raw = outputs[outputName].data as Float32Array
  const probs = config.applySoftmax ? softmax(raw) : Float32Array.from(raw)

  const buffer = probs.buffer as ArrayBuffer
  post({ type: 'result', id: msg.id, probs: buffer }, [buffer])
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  try {
    switch (msg.type) {
      case 'init':
        await init(msg)
        break
      case 'infer':
        await infer(msg)
        break
      case 'dispose':
        await session?.release()
        session = null
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    post({
      type: 'error',
      phase: msg.type === 'init' ? 'init' : 'infer',
      message,
      id: msg.type === 'infer' ? msg.id : undefined,
    })
  }
}
