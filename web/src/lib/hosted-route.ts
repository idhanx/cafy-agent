import { isHosted } from "@/lib/hosted.mjs";
import { ensureHostedFresh, flushHosted } from "@/lib/hosted-runtime";

/**
 * Wrap a route handler so a hosted deployment loads the latest data before it
 * runs and saves what it changed once the response has been sent (streams
 * included). Off Vercel it returns the handler untouched — zero overhead locally.
 */
export function hostedSync<A extends unknown[]>(handler: (...args: A) => Response | Promise<Response>): (...args: A) => Promise<Response> {
  if (!isHosted()) return async (...args: A) => handler(...args);
  return async (...args: A) => {
    await ensureHostedFresh();
    try {
      return await handler(...args);
    } finally {
      // Imported on demand: only hosted deployments ever reach this line.
      const { after } = await import("next/server");
      after(() => flushHosted());
    }
  };
}
