// hosted.mjs — is this process a hosted deployment (Vercel) rather than someone's
// own computer? Everything that must behave differently there asks this one place.
export function isHosted(env = process.env) {
  if (env.CAFY_HOSTED === "0") return false;
  return env.CAFY_HOSTED === "1" || Boolean(env.VERCEL);
}
