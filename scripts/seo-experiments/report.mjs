// 7/14/28-day comparison of the observation ledger, per unit and per experiment arm × engine.
//   node scripts/seo-experiments/report.mjs [--today=YYYY-MM-DD] [--out=reports/seo-experiments]
// Outputs results-units.{json,csv} and results-summary.{json,csv}. Unobserved = empty, never 0.
import fs from "node:fs";
import path from "node:path";
import { experimentConfig, readJson } from "../../src/lib/seo-experiments/common.js";
import { evaluateUnit, legacyRegionalEvents, summarizeRows, toCsv } from "../../src/lib/seo-experiments/observations.js";
import { buildObservationUnits } from "../../src/lib/seo-experiments/units.js";

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const today = arg("today") || new Date().toISOString().slice(0, 10);
const out = path.resolve(arg("out") || "reports/seo-experiments");
const config = experimentConfig();
const units = buildObservationUnits();
const ledger = JSON.parse(fs.readFileSync(path.resolve(process.env.SEO_OBSERVATION_LEDGER || "seo-lab/observations/ledger.json"), "utf8"));
const events = [...ledger.events, ...legacyRegionalEvents(readJson("seo-lab/regions/index-flow-observations.json"), units)];
const withEvents = new Set(events.map(e => e.unit));
// B has 7,664 URLs; per-unit rows are kept for index candidates and any URL that has observations.
const tracked = [...units.values()].filter(u => u.experiment !== "B" || u.arm === "index-candidate" || withEvents.has(u.unit));
const rows = tracked.flatMap(unit => evaluateUnit(unit, events, {
  windows: config.observationWindowsDays, engines: config.engines, today,
  excludeIndexedAtBaseline: unit.kind === "target" && config.experiments.C.excludeTargetsIndexedAtBaseline
}));
const summary = summarizeRows(rows);
const meta = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), today, windowsDays: config.observationWindowsDays, engines: config.engines,
  ledgerEvents: events.length,
  units: Object.fromEntries(["A", "B", "C"].map(k => [k, { registered: [...units.values()].filter(u => u.experiment === k).length, tracked: tracked.filter(u => u.experiment === k).length,
    started: tracked.filter(u => u.experiment === k && u.startDate).length }])),
  rules: [
    "Stages are independent; a later stage is never inferred from an earlier one.",
    "unobservable and unobserved are not successes; yesRateAmongObserved uses yes/(yes+no) only.",
    "Windows start at the experiment launch date (A/B) or the batch publishedAt (C, shared by treatment and control).",
    "C targets indexed before their start date are excluded when excludeTargetsIndexedAtBaseline is true."
  ]
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "results-units.json"), JSON.stringify({ ...meta, rows }, null, 2) + "\n");
fs.writeFileSync(path.join(out, "results-units.csv"), toCsv(rows));
fs.writeFileSync(path.join(out, "results-summary.json"), JSON.stringify({ ...meta, summary }, null, 2) + "\n");
fs.writeFileSync(path.join(out, "results-summary.csv"), toCsv(summary));
console.log(JSON.stringify({ ...meta, rows: rows.length, summaryRows: summary.length, out: path.relative(process.cwd(), out) }, null, 2));
