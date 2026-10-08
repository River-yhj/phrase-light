/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 백엔드 주소 (예: http://localhost:4000) — client/.env */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
