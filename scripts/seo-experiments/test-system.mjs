// End-to-end system test for experiment C and the observation pipeline, run on a TEMP copy of the data.
//   SITE_URL=... node --test scripts/seo-experiments/test-system.mjs
// 1. indexkit CLI on a copy of src/data/seo-experiments/indexkit.json (the real 1-URL file is never written)
// 2. fixture Astro build into dist-fixture/ with SEO_REGIONS_EMIT=candidates (the production limit)
// 3. link manifest + test-dist on that build (treatment linked, control absent, index vs noindex carrier)
// 4. observe.mjs + report.mjs on a temp ledger (7/14/28-day JSON/CSV)
// Fixture blog URLs (blog id "ikfixture…") are synthetic and exist only inside this test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repo = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seo-system-"));
const kit = path.join(tmp, "indexkit.json");
const ledger = path.join(tmp, "ledger.json");
const outDir = "dist-fixture";
fs.copyFileSync("src/data/seo-experiments/indexkit.json", kit);
fs.writeFileSync(ledger, JSON.stringify({ schemaVersion: 1, updatedAt: null, events: [] }) + "\n");
const realBefore = fs.readFileSync("src/data/seo-experiments/indexkit.json", "utf8");
const env = { ...process.env, SEO_INDEXKIT_DATA: kit, SEO_OBSERVATION_LEDGER: ledger, SEO_REGIONS_EMIT: "candidates", PRODUCTION_READY: "true",
  SITE_URL: process.env.SITE_URL || "https://xn--h49a29twjdmms77a5sofgdjwa.shop", BASE_PATH: "/" };
const cli = (...args) => spawnSync("node", ["scripts/seo-experiments/indexkit.mjs", ...args], { env, encoding: "utf8" });
const ok = (...args) => { const r = cli(...args); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const fixtureUrl = (blog, i) => `https://blog.naver.com/${blog}/22410000000${String(i).padStart(2, "0")}`;
test.after(() => { fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(outDir, { recursive: true, force: true }); });

test("1. CLI: the real single URL stays enrolling; duplicates and non-post URLs are rejected", () => {
  const status = ok("status");
  assert.deepEqual(status.map(s => [s.status, s.unassigned]), [["enrolling", 1]]);
  assert.notEqual(cli("add", "--url=https://blog.naver.com/ntelecom59/224462343217").status, 0, "duplicate (non-mobile form) must be rejected");
  assert.notEqual(cli("add", "--url=https://in.naver.com/ntelecom59/contents/1").status, 0);
  assert.notEqual(cli("publish", "--batch=2026-11-b1", "--date=2026-11-05").status, 0, "enrolling batch cannot be published");
});

test("2. CLI: register, assign (frozen) and publish two carrier arms", () => {
  for (let i = 0; i < 9; i++) ok("add", `--url=${fixtureUrl("ikfixturea", i)}`, "--batch=2026-11-b1", ...(i < 2 ? ["--placements=list,contextual", "--summary=픽스처 요약 문장입니다."] : []));
  ok("new-batch", "--id=2026-11-b2", "--title=비색인 링크 묶음", "--carrier=noindex");
  for (let i = 0; i < 10; i++) ok("add", `--url=${fixtureUrl("ikfixtureb", i)}`, "--batch=2026-11-b2");
  ok("assign", "--batch=2026-11-b1", "--date=2026-11-03");
  ok("assign", "--batch=2026-11-b2", "--date=2026-11-03");
  const groupsBefore = JSON.parse(fs.readFileSync(kit, "utf8")).targets.map(t => t.group);
  ok("assign", "--batch=2026-11-b1", "--date=2026-11-04");
  assert.deepEqual(JSON.parse(fs.readFileSync(kit, "utf8")).targets.map(t => t.group), groupsBefore, "re-assign must not reshuffle");
  const status = ok("status");
  assert.deepEqual(status.map(s => [s.batch, s.status, s.treatment, s.control]), [["2026-11-b1", "ready", 5, 5], ["2026-11-b2", "ready", 5, 5]]);
  ok("publish", "--batch=2026-11-b1", "--date=2026-11-05");
  ok("publish", "--batch=2026-11-b2", "--date=2026-11-05");
  assert.notEqual(cli("add", `--url=${fixtureUrl("ikfixturea", 50)}`, "--batch=2026-11-b1").status, 0, "published batch is frozen");
  assert.equal(fs.readFileSync("src/data/seo-experiments/indexkit.json", "utf8"), realBefore, "real data file must be untouched");
});

test("3. fixture build (production limit SEO_REGIONS_EMIT=candidates) passes dist tests and the link manifest", () => {
  execFileSync("npx", ["astro", "build", "--outDir", outDir], { env, stdio: "ignore" });
  const routes = fs.readdirSync(outDir);
  assert.ok(!routes.includes("regions"), "candidates mode must not emit region pages while there are 0 candidates");
  const dist = spawnSync("node", ["--test", "scripts/seo-experiments/test-dist.mjs"], { env: { ...env, SEO_DIST: outDir }, encoding: "utf8" });
  assert.equal(dist.status, 0, dist.stdout.split("\n").filter(l => /not ok|error|expected|actual/.test(l)).slice(0, 20).join("\n"));
  const run = spawnSync("node", ["scripts/seo-experiments/link-manifest.mjs", `--out=${tmp}`], { env: { ...env, SEO_DIST: outDir }, encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, "indexkit-link-manifest.json"), "utf8"));
  const data = JSON.parse(fs.readFileSync(kit, "utf8"));
  const treatment = data.targets.filter(t => t.group === "treatment");
  const contextual = treatment.filter(t => t.placements.includes("contextual")).length;
  assert.equal(manifest.counts.foundNaverLinks, treatment.length + contextual);
  assert.equal(manifest.counts.controlOrUnassignedLinked, 0);
  const [b1, b2] = manifest.batches;
  assert.equal(b1.carrierRobotsInHtml, "index,follow"); assert.equal(b1.carrierInSitemap, true);
  assert.equal(b2.carrierRobotsInHtml, "noindex,follow"); assert.equal(b2.carrierInSitemap, false);
  assert.deepEqual(b2.carrierDiscoveryPath, ["entry:sitemap.xml", "/indexkit/", "/indexkit/2026-11-b2/"], "noindex carrier is only reachable through the hub");
  for (const p of manifest.placements) {
    assert.ok(p.discoverableFromSite && p.discoveryPath.at(-1) === p.url);
    assert.equal(p.rel, null, "treatment links must be plain links");
    assert.equal(p.linkPublishedAt, "2026-11-05");
  }
  const html = fs.readFileSync(path.join(outDir, "indexkit", "2026-11-b2", "index.html"), "utf8");
  for (const t of data.targets.filter(t => t.group === "control")) assert.ok(!html.includes(t.url));
});

test("4. observe + report: engine/stage ledger and 7/14/28-day comparison by arm", () => {
  const data = JSON.parse(fs.readFileSync(kit, "utf8"));
  const pick = (group, batch) => data.targets.find(t => t.group === group && t.batch === batch).url;
  const tA = pick("treatment", "2026-11-b1"), tB = pick("treatment", "2026-11-b2"), c = pick("control", "2026-11-b1");
  const carrier = "https://xn--h49a29twjdmms77a5sofgdjwa.shop/indexkit/2026-11-b1/";
  const events = [
    { unit: tA, engine: "google", stage: "discovered", result: "unobservable", observedAt: "2026-11-08T01:00:00Z", method: "exact_url_search", source: "manual check sheet row 1" },
    { unit: tA, engine: "google", stage: "indexed", result: "yes", observedAt: "2026-11-15T01:00:00Z", method: "exact_url_search", source: "manual check sheet row 2" },
    { unit: tB, engine: "google", stage: "indexed", result: "unobservable", observedAt: "2026-11-15T01:00:00Z", method: "site_operator", source: "manual check sheet row 3", note: "No result found; cannot infer non-indexing of third-party URL" },
    { unit: c, engine: "google", stage: "indexed", result: "unobservable", observedAt: "2026-11-15T01:00:00Z", method: "exact_url_search", source: "manual check sheet row 4", note: "No result found; cannot infer non-indexing of third-party URL" },
    { unit: c, engine: "naver", stage: "indexed", result: "yes", observedAt: "2026-11-06T01:00:00Z", method: "manual_serp", source: "naver serp capture 1", note: "query: 앤텔레콤 개통" },
    { unit: carrier, engine: "google", stage: "crawled", result: "yes", observedAt: "2026-11-07T01:00:00Z", method: "server_log", source: "access.log googlebot line" }
  ];
  fs.writeFileSync(path.join(tmp, "events.json"), JSON.stringify({ events }));
  const add = spawnSync("node", ["scripts/seo-experiments/observe.mjs", `--input=${path.join(tmp, "events.json")}`], { env, encoding: "utf8" });
  assert.equal(add.status, 0, add.stderr);
  assert.equal(JSON.parse(add.stdout).added, 6);
  const again = spawnSync("node", ["scripts/seo-experiments/observe.mjs", `--input=${path.join(tmp, "events.json")}`], { env, encoding: "utf8" });
  assert.equal(JSON.parse(again.stdout).duplicates, 6);
  fs.writeFileSync(path.join(tmp, "bad.json"), JSON.stringify([{ ...events[0], stage: "crawled", result: "yes" }]));
  const bad = spawnSync("node", ["scripts/seo-experiments/observe.mjs", `--input=${path.join(tmp, "bad.json")}`], { env, encoding: "utf8" });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /unobservable/);
  assert.equal(JSON.parse(fs.readFileSync(ledger, "utf8")).events.length, 6, "rejected batch must not change the ledger");

  const out = path.join(tmp, "report");
  const rep = spawnSync("node", ["scripts/seo-experiments/report.mjs", "--today=2026-12-10", `--out=${out}`], { env, encoding: "utf8" });
  assert.equal(rep.status, 0, rep.stderr);
  for (const f of ["results-units.json", "results-units.csv", "results-summary.json", "results-summary.csv"]) assert.ok(fs.existsSync(path.join(out, f)), f);
  const summary = JSON.parse(fs.readFileSync(path.join(out, "results-summary.json"), "utf8")).summary;
  const row = (arm, engine, w) => summary.find(s => s.experiment === "C" && s.arm === arm && s.engine === engine && s.windowDays === w);
  assert.equal(row("treatment:index-carrier", "google", 7).indexedYes, 0);
  assert.equal(row("treatment:index-carrier", "google", 14).indexedYes, 1);
  assert.equal(row("treatment:index-carrier", "google", 14).indexedUnobserved, 4, "unchecked units stay unobserved, not 'no'");
  assert.equal(row("treatment:index-carrier", "google", 7).discoveredUnobservable, 1);
  assert.equal(row("treatment:index-carrier", "google", 7).discoveredYesRateAmongObserved, null);
  assert.equal(row("treatment:noindex-carrier", "google", 14).indexedUnobservable, 1);
  assert.equal(row("control", "naver", 7).indexedYes, 1);
  assert.equal(row("control", "google", 28).units, 10);
  assert.equal(summary.find(s => s.arm === "carrier:index" && s.engine === "google" && s.windowDays === 7 && s.crawledYes === 1)?.crawledYes, 1);
  const csv = fs.readFileSync(path.join(out, "results-units.csv"), "utf8").split("\n")[0];
  for (const col of ["experiment", "unit", "arm", "engine", "windowDays", "windowStatus", "discovered", "crawled", "indexed", "served", "impressions", "clicks", "indexedFirstYesDay"]) assert.ok(csv.split(",").includes(col), col);
});
