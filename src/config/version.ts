// Version injected at build-time by Vite define in vite.config.ts
// Usa la stessa costante globale definita in vite.config.ts
declare const __APP_VERSION__: string;

/**
 * Versione corrente dell'applicazione, letta da package.json a build-time.
 * Viene usata sia per mostrare la versione nell'interfaccia, sia per
 * confrontare la versione corrente con quella più recente disponibile.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/**
 * Endpoint statico da cui leggere la versione più recente dell'app.
 * Su Netlify può essere servito come file statico `/version.json`
 * generato in fase di build/deploy.
 */
export const VERSION_ENDPOINT = '/version.json';

