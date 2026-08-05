import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE_FILE=1 produces one self-contained index.html (all JS/CSS/images
// inlined) — used for the shareable demo page. Normal builds are untouched.
const single = !!process.env.SINGLE_FILE

export default defineConfig({
  plugins: single ? [react(), viteSingleFile()] : [react()],
  build: single ? { assetsInlineLimit: 100_000_000 } : {},
})
