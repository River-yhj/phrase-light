import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 프록시를 쓰지 않으므로 백엔드 CORS(CLIENT_ORIGIN=http://localhost:5173)와 포트가 정확히 맞아야 한다.
    // 5173이 사용 중일 때 다른 포트로 조용히 넘어가면 CORS로 막히므로, 넘어가지 말고 바로 실패하게 한다.
    port: 5173,
    strictPort: true,
  },
})
