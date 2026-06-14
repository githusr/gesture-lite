import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build can be deployed under any sub-path
  // (e.g. GitHub Pages project sites) without rewriting asset URLs.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Ship the MediaPipe vision WASM inside the build so the app is fully
    // self-contained and works offline (no CDN dependency). onnxruntime-web's
    // WASM is emitted automatically by Vite via import.meta.url, so it needs no
    // explicit copy.
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@mediapipe/tasks-vision/wasm/*',
          dest: 'wasm/mediapipe',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  // onnxruntime-web ships its own WASM glue; let it load at runtime instead of
  // being pre-bundled by esbuild (which mangles the worker/wasm resolution).
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  build: { target: 'esnext' },
})
