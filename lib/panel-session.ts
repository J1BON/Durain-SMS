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
      "Service catalog needs DURIAN_SESSION_COOKIE on the server. " +
      "On your PC run: npm run panel-login then npm run export-panel-cookie, " +
      "and paste the value into Render environment variables."
    );
  }
  return (
    "Syncing service list from Durian (first load can take 30–60 seconds). " +
    "Cookies expire — if sync fails, refresh DURIAN_SESSION_COOKIE (panel-login + export-panel-cookie). " +
    "Tap “Sync services” or wait a moment and refresh."
  );
}
