import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const inputPath = process.argv.find(arg => arg.startsWith("--input="))?.slice("--input=".length);
if (!inputPath) throw new Error("Usage: node scripts/record-regional-observation.mjs --input=/path/to/events.json");
const ledgerPath = path.join(root, "seo-lab/regions/index-flow-observations.json");
const registryPath = path.join(root, "seo-lab-regions-preview/url-registry.json");
if (!fs.existsSync(registryPath)) throw new Error("Run pnpm run regions:generate before importing URL observations.");
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
if (!Array.isArray(input.events) || input.events.length === 0) throw new Error("Input must contain a non-empty events array.");
const knownUrls = new Set(registry.pages.map(page => page.url));
const types = new Set(["submission", "crawl", "googleIndex", "searchPerformance"]);
const next = [...ledger.events];
for (const event of input.events) {
  if (!knownUrls.has(event.url)) throw new Error("Observation URL is not in the generated registry: " + event.url);
  if (!types.has(event.type)) throw new Error("Unsupported observation type: " + event.type);
  if (!Number.isFinite(Date.parse(event.observedAt)) || !/^https:\/\//i.test(String(event.source || ""))) throw new Error("Observation needs an ISO timestamp and traceable HTTPS source.");
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) throw new Error("Observation data must be an object.");
  if (event.type === "googleIndex" && !["indexed", "not_indexed", "canonicalized_elsewhere", "unobserved"].includes(event.data.status)) throw new Error("Invalid Google index status.");
  if (event.type === "crawl" && !["crawled", "not_crawled", "error", "unobserved"].includes(event.data.status)) throw new Error("Invalid crawl status.");
  if (event.type === "submission" && !["submitted", "accepted", "rejected", "not_submitted"].includes(event.data.status)) throw new Error("Invalid submission status.");
  if (event.type === "searchPerformance" && (!["impressions", "clicks"].every(key => Number.isFinite(event.data[key]) && event.data[key] >= 0)
    || !/^\d{4}-\d{2}-\d{2}$/.test(event.data.rangeStart || "") || !/^\d{4}-\d{2}-\d{2}$/.test(event.data.rangeEnd || ""))) throw new Error("Search performance needs non-negative impressions/clicks and a date range.");
  const id = crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex");
  if (!next.some(item => item.id === id)) next.push({ id, ...event });
}
const updated = { schemaVersion: 1, updatedAt: new Date().toISOString(), events: next };
const temporary = ledgerPath + ".tmp";
fs.writeFileSync(temporary, JSON.stringify(updated, null, 2) + "\n");
fs.renameSync(temporary, ledgerPath);
console.log(JSON.stringify({ imported: input.events.length, uniqueEvents: next.length, ledger: "seo-lab/regions/index-flow-observations.json" }, null, 2));
