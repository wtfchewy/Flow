/** Platform detection — checks for Tauri webview runtime */

export type Platform = 'tauri' | 'web';

export function detectPlatform(): Platform {
  return (window as any).__TAURI_INTERNALS__ ? 'tauri' : 'web';
}

export const platform: Platform = detectPlatform();
export const isTauri = platform === 'tauri';
