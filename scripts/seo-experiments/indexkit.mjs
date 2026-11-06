// IndexKit (experiment C) management CLI. The data file is the only place targets live.
//   node scripts/seo-experiments/indexkit.mjs status
//   node scripts/seo-experiments/indexkit.mjs add --url=<naver blog URL> [--batch=ID] [--label=..] [--summary=..] [--placements=list,contextual]
//   node scripts/seo-experiments/indexkit.mjs new-batch --id=2026-12-b2 --title=.. --carrier=index|noindex [--intro=..]
//   node scripts/seo-experiments/indexkit.mjs assign --batch=ID [--date=YYYY-MM-DD]
//   node scripts/seo-experiments/indexkit.mjs publish --batch=ID --date=YYYY-MM-DD   (only after the batch is deployed)
// SEO_INDEXKIT_DATA overrides the data file (used by tests and fixtures).
import fs from "node:fs";
import path from "node:path";
import { experimentConfig } from "../../src/lib/seo-experiments/common.js";
import { assignBatch, buildIndexKitModel, indexKitDataFile, normalizeNaverBlogUrl, validateIndexKitData, PLACEMENTS, CARRIERS } from "../../src/lib/seo-experiments/indexkit.js";

const [command] = process.argv.slice(2);
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const file = path.resolve(indexKitDataFile());
const settings = experimentConfig().experiments.C;
const load = () => JSON.parse(fs.readFileSync(file, "utf8"));
const save = data => {
  validateIndexKitData(data);
  fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(file + ".tmp", file);
};
const today = () => new Date().toISOString().slice(0, 10);
const fail = message => { console.error(message); process.exit(1); };
const status = data => {
  const model = buildIndexKitModel({ data });
  return model.batches.map(b => ({ batch: b.id, carrierRobots: b.carrierRobots, status: b.status, publishedAt: b.publishedAt,
    treatment: b.treatment.length, control: b.control.length, unassigned: b.unassigned.length, minPerGroup: settings.minTargetsPerGroup }));
};

const data = load();
if (command === "status") {
  console.log(JSON.stringify(status(data), null, 2));
} else if (command === "add") {
  const url = normalizeNaverBlogUrl(arg("url") || fail("--url is required"));
  const existing = data.targets.find(t => t.url === url);
  if (existing) fail(`already registered as ${existing.id} (${url})`);
  const batchId = arg("batch") || data.batches.at(-1)?.id;
  const batch = data.batches.find(b => b.id === batchId) || fail("unknown batch " + batchId);
  if (batch.publishedAt) fail(`batch ${batch.id} is already published; create a new batch so windows stay comparable`);
  const placements = (arg("placements") || "list").split(",").map(s => s.trim()).filter(Boolean);
  if (placements.some(p => !PLACEMENTS.includes(p))) fail("placements must be from " + PLACEMENTS.join(","));
  const next = Math.max(0, ...data.targets.map(t => Number(t.id.slice(3)))) + 1;
  const target = { id: "ik-" + String(next).padStart(4, "0"), url, batch: batch.id, addedAt: today(), label: arg("label") || null,
    summary: arg("summary") || null, group: null, assignment: null, placements };
  data.targets.push(target);
  save(data);
  console.log(JSON.stringify({ added: target, batches: status(data) }, null, 2));
} else if (command === "new-batch") {
  const carrier = arg("carrier") || "index";
  if (!CARRIERS.includes(carrier)) fail("--carrier must be index or noindex");
  data.batches.push({ id: arg("id") || fail("--id required"), title: arg("title") || fail("--title required"),
    intro: arg("intro") || "네이버 블로그에 게시된 앤텔레콤 개통 안내 원문으로 이동하는 링크 목록입니다.", carrierRobots: carrier, createdAt: today(), publishedAt: null });
  save(data);
  console.log(JSON.stringify(status(data), null, 2));
} else if (command === "assign") {
  const batch = data.batches.find(b => b.id === arg("batch")) || fail("--batch=ID required");
  if (batch.publishedAt) fail("published batches are frozen");
  const members = data.targets.filter(t => t.batch === batch.id);
  const before = members.filter(t => t.group).length;
  assignBatch(members, settings.assignmentSeed + ":" + batch.id, arg("date") || today());
  save(data);
  console.log(JSON.stringify({ newlyAssigned: members.length - before, batches: status(data) }, null, 2));
} else if (command === "publish") {
  const batch = data.batches.find(b => b.id === arg("batch")) || fail("--batch=ID required");
  const date = arg("date") || fail("--date=YYYY-MM-DD (the day the deployed HTML went live) is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date must be YYYY-MM-DD");
  const current = status(data).find(s => s.batch === batch.id);
  if (current.status !== "ready") fail(`batch ${batch.id} is ${current.status}; it needs >= ${settings.minTargetsPerGroup} treatment and control targets, all assigned`);
  batch.publishedAt = date;
  save(data);
  console.log(JSON.stringify(status(data), null, 2));
} else {
  fail("commands: status | add | new-batch | assign | publish");
}
