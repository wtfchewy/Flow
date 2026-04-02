/**
 * Platform detection utilities.
 *
 * On Tauri mobile builds the user-agent contains "Tauri/Mobile" and the
 * viewport behaves like a phone.  We also fall back to standard UA sniffing
 * for touch-only devices so the responsive layout works in plain browsers too.
 */

const ua = navigator.userAgent || '';

export const isTauriMobile =
  ua.includes('Tauri') && (ua.includes('Android') || ua.includes('iPhone') || ua.includes('iPad'));

export const isMobile =
  isTauriMobile ||
  /Android|iPhone|iPad|iPod/i.test(ua) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 768);

export const isIOS =
  /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = /Android/i.test(ua);

export const isMac =
  navigator.platform?.toUpperCase().includes('MAC') || isIOS;
