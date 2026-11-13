// Append Google/Naver observations to the common ledger (validated, deduplicated, atomic write).
//   node scripts/seo-experiments/observe.mjs --input=events.json
//   node scripts/seo-experiments/observe.mjs --template --experiment=C --engine=google > todo.json
// Ledger path can be overridden with SEO_OBSERVATION_LEDGER (tests use a temp file).
import fs from "node:fs";
import path from "node:path";
import { validateEvent, STAGES } from "../../src/lib/seo-experiments/observations.js";
import { buildObservationUnits } from "../../src/lib/seo-experiments/units.js";

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const flag = name => process.argv.includes(`--${name}`);
const ledgerPath = path.resolve(process.env.SEO_OBSERVATION_LEDGER || "seo-lab/observations/ledger.json");
const units = buildObservationUnits();

if (flag("template")) {
  const experiment = arg("experiment"), engine = arg("engine") || "google";
  const rows = [...units.values()].filter(u => !experiment || u.experiment === experiment)
    .map(u => ({ unit: u.unit, experiment: u.experiment, arm: u.arm, engine,
      stage: u.external ? "indexed" : "crawled", result: null, observedAt: null,
      method: u.external ? "exact_url_search" : engine === "google" ? "gsc_url_inspection" : "searchadvisor_report",
      source: null, note: u.external ? "discovered/crawled are unobservable for third-party URLs" : null }));
  console.log(JSON.stringify({ stages: STAGES, events: rows }, null, 2));
  process.exit(0);
}
const input = arg("input");
if (!input) { console.error("Usage: observe.mjs --input=events.json | --template [--experiment=A|C] [--engine=google|naver]"); process.exit(2); }
const raw = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const incoming = Array.isArray(raw) ? raw : raw.events;
if (!Array.isArray(incoming) || !incoming.length) throw new Error("input needs a non-empty events array");
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const known = new Set(ledger.events.map(e => e.id));
const errors = [];
let added = 0, duplicates = 0;
const accepted = [];
incoming.forEach((event, index) => {
  try {
    const valid = validateEvent(event, units);
    if (known.has(valid.id)) { duplicates++; return; }
    known.add(valid.id); accepted.push(valid); added++;
  } catch (error) { errors.push(`#${index} ${event?.unit || "?"}: ${error.message}`); }
});
if (errors.length) { console.error("Rejected; ledger unchanged:\n" + errors.join("\n")); process.exit(1); }
const next = { schemaVersion: 1, updatedAt: new Date().toISOString(), events: [...ledger.events, ...accepted] };
fs.writeFileSync(ledgerPath + ".tmp", JSON.stringify(next, null, 2) + "\n");
fs.renameSync(ledgerPath + ".tmp", ledgerPath);
console.log(JSON.stringify({ added, duplicates, totalEvents: next.events.length, ledger: path.relative(process.cwd(), ledgerPath) }, null, 2));
