import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ✅ no @tailwindcss/vite plugin
export default defineConfig({
  plugins: [react()],
})
