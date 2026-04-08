import { isTauri } from './platform';

/**
 * Check for app updates via the Tauri updater plugin.
 * Returns the update object if an update is available, or null.
 */
export async function checkForUpdate() {
  if (!isTauri()) return null;

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    return update;
  } catch {
    return null;
  }
}
