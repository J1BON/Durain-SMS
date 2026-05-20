import {
  cookieHeaderFromEnv,
  readCachedPanelCookies,
} from "./durian-panel";

export async function hasPanelSession(): Promise<boolean> {
  if (cookieHeaderFromEnv()) return true;
  const cached = await readCachedPanelCookies();
  return Boolean(cached && Object.keys(cached).length > 0);
}

export function getPanelSetupHint(hasSession: boolean): string {
  if (!hasSession) {
    return (
      "Service catalog needs a panel session: open /panel-refresh in this app after you sign in (works on your phone), or set DURIAN_SESSION_COOKIE on the server. " +
      "From a PC you can run npm run panel-login then npm run export-panel-cookie and paste into Render."
    );
  }
  return (
    "Syncing service list from Durian (first load can take 30–60 seconds). " +
    "Cookies expire — use /panel-refresh (any device) or panel-login + export-panel-cookie. " +
    "On Render, DURIAN_USE_DISK_PANEL_COOKIE=1 prefers the session saved by /panel-refresh over a stale env cookie. " +
    "Tap “Sync services” or wait a moment and refresh."
  );
}
