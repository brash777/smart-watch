/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Product name shown in the app and in the installed PWA. */
  readonly VITE_APP_NAME: string;
  /** Base URL of the API for the browser: /api (through the Vite proxy) or an absolute URL. */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
