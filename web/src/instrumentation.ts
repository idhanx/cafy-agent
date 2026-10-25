// Runs once when a server instance starts. On a hosted deployment it points the
// core at the hosted data folder and loads the client's data from Blob storage
// before the first request is served.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isHosted } = await import("@/lib/hosted.mjs");
  if (!isHosted()) return;
  const { configureHosted, ensureHostedFresh } = await import("@/lib/hosted-runtime");
  configureHosted();
  try {
    await ensureHostedFresh();
  } catch (e) {
    console.error("[cafy] could not load data from Blob storage:", e instanceof Error ? e.message : e);
  }
}
