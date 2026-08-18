/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
