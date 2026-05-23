export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initUsers } = await import("./lib/users");
    await initUsers();

    const { startDurianAutoSync } = await import("./lib/auto-sync-server");
    startDurianAutoSync();
  }
}
