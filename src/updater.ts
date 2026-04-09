import { isTauri } from './platform';

/**
 * Check for app updates via the Tauri updater plugin.
 * Returns the update object if an update is available, or null.
 */
export async function checkForUpdate() {
  if (!isTauri()) return null;

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    console.log('[updater] checking for updates...');
    const update = await check();
    console.log('[updater] result:', update);
    return update;
  } catch (e) {
    console.error('[updater] error:', e);
    return null;
  }
}
