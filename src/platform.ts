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
 * Detects mobile devices via user agent and screen size.
 * Returns true for phones and small tablets.
 */
export function isMobile(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return true;
  }
  // iPad with iOS 13+ reports as desktop Safari, check touch + screen size
  if (/iPad/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
  // Fallback: small viewport
  return window.innerWidth <= 768 && 'ontouchstart' in window;
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
  if (isMobile()) {
    html.classList.add('peak-mobile');
  }
}
