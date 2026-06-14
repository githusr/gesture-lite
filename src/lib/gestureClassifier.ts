import type {
  ExecutionProvider,
  ModelConfig,
  RGBAImage,
  WorkerRequest,
  WorkerResponse,
} from './types'

/**
 * Main-thread facade over {@link inference.worker}. Presents a small async API
 * (`init` / `classify`) and hides the postMessage request/response plumbing.
 *
 * The caller is expected to keep at most one `classify` in flight at a time
 * (latest-frame-wins); pending requests are tracked by id regardless.
 */
export class GestureClassifier {
  private worker: Worker
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (probs: Float32Array) => void; reject: (err: Error) => void }
  >()
  private readyResolve?: () => void
  private readyReject?: (err: Error) => void

  constructor() {
    this.worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handleMessage(e.data)
    this.worker.onerror = (e) => {
      const err = new Error(e.message || 'inference worker crashed')
      this.readyReject?.(err)
      for (const { reject } of this.pending.values()) reject(err)
      this.pending.clear()
    }
  }

  /** Load the model + preprocessing config. Resolves once the session is ready. */
  init(
    modelUrl: string,
    config: ModelConfig,
    executionProviders: ExecutionProvider[],
  ): Promise<void> {
    const req: WorkerRequest = { type: 'init', modelUrl, config, executionProviders }
    return new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
      this.worker.postMessage(req)
    })
  }

  /** Run one classification. The image buffer is transferred (zero-copy). */
  classify(image: RGBAImage): Promise<Float32Array> {
    const id = this.nextId++
    const req: WorkerRequest = { type: 'infer', id, image }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage(req, [image.data.buffer as ArrayBuffer])
    })
  }

  dispose(): void {
    try {
      this.worker.postMessage({ type: 'dispose' } satisfies WorkerRequest)
    } catch {
      /* worker may already be gone */
    }
    this.worker.terminate()
    this.pending.clear()
  }

  private handleMessage(msg: WorkerResponse): void {
    switch (msg.type) {
      case 'ready':
        this.readyResolve?.()
        break
      case 'result': {
        const entry = this.pending.get(msg.id)
        if (entry) {
          this.pending.delete(msg.id)
          entry.resolve(new Float32Array(msg.probs))
        }
        break
      }
      case 'error': {
        const err = new Error(msg.message)
        if (msg.phase === 'init') {
          this.readyReject?.(err)
        } else if (msg.id !== undefined) {
          const entry = this.pending.get(msg.id)
          if (entry) {
            this.pending.delete(msg.id)
            entry.reject(err)
          }
        }
        break
      }
    }
  }
}
