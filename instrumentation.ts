export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDurianAutoSync } = await import("./lib/auto-sync-server");
    startDurianAutoSync();
  }
}
