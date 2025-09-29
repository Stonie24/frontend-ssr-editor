/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // lägg till fler VITE_ variabler här om du vill
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
