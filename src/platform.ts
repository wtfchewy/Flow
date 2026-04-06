/**
 * Platform detection for Peak.
 * Determines whether the app is running inside Tauri or a standard browser.
 */

export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export function isMacOS(): boolean {
  return navigator.platform.toUpperCase().includes('MAC');
}

/**
 * Adds platform classes to <html> so CSS can differentiate.
 * Call once at startup.
 */
export function applyPlatformClasses() {
  const html = document.documentElement;
  if (!isTauri()) {
    html.classList.add('peak-browser');
  } else {
    html.classList.add('peak-desktop');
  }
}
