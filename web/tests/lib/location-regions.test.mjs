import test from "node:test";
import assert from "node:assert/strict";
import { expandRegionAliases } from "../../src/lib/core/location-regions.mjs";
import { scannerArgs } from "../../src/lib/core/scan-args.mjs";

test("UK and Ireland shorthands expand to the spellings boards use", () => {
  const uk = expandRegionAliases(["UK"]);
  assert.ok(uk.includes("London") && uk.includes("England") && uk.includes("United Kingdom"));
  const ie = expandRegionAliases(["Ireland"]);
  assert.ok(ie.includes("Dublin") && ie.includes("Republic of Ireland"));
});

test("other entries pass through untouched and without duplicates", () => {
  assert.deepEqual(expandRegionAliases(["Toronto", "toronto"]), ["Toronto"]);
});

test("a location-narrowed scan samples more companies than the default", () => {
  const limit = (a) => Number(a[a.indexOf("--limit") + 1]);
  const base = { ats: ["lever"], json: true, sinceDays: 7, limitPerAts: 150 };
  assert.equal(limit(scannerArgs(base)), 150);
  assert.equal(limit(scannerArgs({ ...base, locationNarrowed: true })), 600);
  assert.equal(limit(scannerArgs({ ...base, limitPerAts: 1200, locationNarrowed: true })), 1200);
});

import { locationInRegions, feedRegions } from "../../src/lib/core/location-regions.mjs";

test("feed keeps UK/Ireland postings and drops the rest, whole-word only", () => {
  const r = feedRegions({});
  assert.ok(locationInRegions("London · United Kingdom · Remote", r));
  assert.ok(locationInRegions("Dublin, IE", r));
  assert.ok(!locationInRegions("New York City · USA · US Remote", r));
  assert.ok(!locationInRegions("Kyiv, Ukraine", r));
  assert.ok(!locationInRegions("", r));
  assert.ok(locationInRegions("", feedRegions({ CAREER_OPS_REGIONS: "" })));
});
