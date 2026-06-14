// Downloads the MediaPipe Hand Landmarker model into public/models/.
// Usage: pnpm fetch:landmarker
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dest = join(root, 'public', 'models', 'hand_landmarker.task')

console.log(`Downloading hand_landmarker.task …`)
const res = await fetch(URL)
if (!res.ok) {
  console.error(`Failed: HTTP ${res.status} ${res.statusText}`)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
await mkdir(dirname(dest), { recursive: true })
await writeFile(dest, buf)
console.log(`Saved ${(buf.length / 1024 / 1024).toFixed(1)} MB -> public/models/hand_landmarker.task`)
