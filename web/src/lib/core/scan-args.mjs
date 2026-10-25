// A location-narrowed search (UK, Ireland…) keeps only a few percent of boards,
// so the default random 150-company sample usually holds none of them. Sample
// wider whenever a location allow-list is set.
export const LOCATION_NARROW_MIN_LIMIT = 600;

export function effectiveLimit(limitPerAts, locationNarrowed) {
  const base = Math.max(1, limitPerAts || 150);
  return locationNarrowed ? Math.max(base, LOCATION_NARROW_MIN_LIMIT) : base;
}

/**
 * Flags for one scan-ats-full.mjs child, after the script path. Explore always
 * caps each source, so it always asks for a shuffled sample: the uncapped order
 * is alphabetical, and its first few hundred companies are the same every run.
 *
 * @param {{ ats: string[], json: boolean, sinceDays: number, limitPerAts: number, locationNarrowed?: boolean }} options
 * @returns {string[]}
 */
export function scannerArgs({ ats, json, sinceDays, limitPerAts, locationNarrowed = false }) {
  const args = [
    "--dry-run",
    "--since",
    String(Math.max(1, sinceDays || 7)),
    "--ats",
    ats.join(","),
    "--limit",
    String(effectiveLimit(limitPerAts, locationNarrowed)),
    "--shuffle",
  ];
  if (json) args.push("--json");
  return args;
}
