// Separates pre-existing audit findings from new ones.
// Compares audit-results/issues.json (scripts/audit-existing-500.mjs) with seo-lab/baseline/audit-existing-500-issues.json.
import fs from "node:fs";
const key = i => [i.level, i.category, i.route, i.detail].join("|");
const base = JSON.parse(fs.readFileSync("seo-lab/baseline/audit-existing-500-issues.json", "utf8"));
const now = JSON.parse(fs.readFileSync("audit-results/issues.json", "utf8"));
const baseKeys = new Set(base.map(key)), nowKeys = new Set(now.map(key));
const count = list => list.reduce((acc, i) => (acc[i.level + ":" + i.category] = (acc[i.level + ":" + i.category] || 0) + 1, acc), {});
const preExisting = now.filter(i => baseKeys.has(key(i)));
const added = now.filter(i => !baseKeys.has(key(i)));
const resolved = base.filter(i => !nowKeys.has(key(i)));
const result = { baseline: { total: base.length, byCategory: count(base) }, current: { total: now.length, byCategory: count(now) },
  preExisting: { total: preExisting.length, byCategory: count(preExisting) }, new: { total: added.length, errors: added.filter(i => i.level === "error").length, byCategory: count(added), sample: added.slice(0, 20) },
  resolved: { total: resolved.length, byCategory: count(resolved) } };
fs.mkdirSync("reports/seo-experiments", { recursive: true });
fs.writeFileSync("reports/seo-experiments/audit-diff.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (added.length) process.exit(1);
