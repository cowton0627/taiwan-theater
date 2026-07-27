import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相對路徑：GitHub Pages 部署在 /<repo>/ 子路徑下也能正確載入資源
  base: './',
})
