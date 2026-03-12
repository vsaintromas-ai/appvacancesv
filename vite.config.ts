import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/appvacancesv/',
  server: {
    port: 5151,
    open: true,
  },
})
