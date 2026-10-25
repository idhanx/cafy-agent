// Region shorthands the Explorer location chips accept. The scanner matches a
// location by plain substring, so a bare "UK" misses "London, England" and
// "Dublin" misses "Republic of Ireland" — a UK/Ireland search then reads as
// "no matches". Expanding the shorthand to the spellings ATS boards actually
// use keeps the user's chips untouched (expansion happens only in the ephemeral
// portals file).
const UK = [
  "United Kingdom", "UK", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland",
  "London", "Manchester", "Birmingham", "Edinburgh", "Glasgow", "Bristol", "Leeds", "Cambridge",
  "Oxford", "Cardiff", "Belfast", "Liverpool", "Sheffield", "Nottingham", "Newcastle", "Reading",
];
const IE = [
  "Ireland", "Republic of Ireland", "Dublin", "Cork", "Galway", "Limerick", "Waterford",
];

const GROUPS = [
  { triggers: ["uk", "u.k.", "united kingdom", "great britain", "gb", "britain"], expand: UK },
  { triggers: ["ireland", "republic of ireland", "ie", "eire"], expand: IE },
];

export function expandRegionAliases(list) {
  const out = [];
  const seen = new Set();
  const push = (v) => {
    const k = String(v).trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(String(v).trim());
    }
  };
  for (const item of list || []) {
    push(item);
    const key = String(item).trim().toLowerCase();
    for (const g of GROUPS) if (g.triggers.includes(key)) g.expand.forEach(push);
  }
  return out;
}

const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word match of a posting location against region shorthands (expanded),
 *  so "UK" never matches "Ukraine". An empty `regions` list matches everything;
 *  a posting with no location matches nothing when regions are set. */
export function locationInRegions(location, regions) {
  if (!regions || regions.length === 0) return true;
  const loc = String(location || "").toLowerCase();
  if (!loc) return false;
  return expandRegionAliases(regions).some((r) => new RegExp(`(^|[^a-z])${esc(r.toLowerCase())}([^a-z]|$)`).test(loc));
}

/** Regions the Home "fresh matches" feed is limited to. Default UK + Ireland;
 *  CAREER_OPS_REGIONS="" turns the limit off, or lists other regions. */
export function feedRegions(env = process.env) {
  const raw = env.CAREER_OPS_REGIONS;
  if (raw === undefined) return ["UK", "Ireland"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
