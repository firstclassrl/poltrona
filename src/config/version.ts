// Version injected at build-time by Vite define in vite.config.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
