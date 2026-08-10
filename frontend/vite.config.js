import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the production build works when served from a subfolder
  // (e.g. http://localhost/meetup/frontend/dist/) without any Apache config.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
})
