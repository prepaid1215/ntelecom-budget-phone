// Evidence record for experiment A: why each landing is (not) an index candidate, with rendered-HTML overlap.
// The 40-char title / 600-char body / 3-link thresholds are THIS PROJECT'S internal audit rules,
// not Google or Naver indexing requirements.  Run after a build.  Writes reports/seo-experiments/a-landing-review.{json,md}
import fs from "node:fs";
import { readJson, visibleLength } from "../../src/lib/seo-experiments/common.js";
import { buildExperimentRegistry } from "../../src/lib/seo-experiments/registry.js";
import { distRoot, htmlRoutes, overlapText, RENDERED_OVERLAP_LIMIT, sharedTrigramRatio, trigramSet } from "./dist-lib.mjs";

const routes = htmlRoutes(distRoot());
const read = r => fs.readFileSync(routes.get(r), "utf8");
const settings = readJson("src/data/seo-experiments/config.json").experiments.A;
const grams = trigramSet, overlap = sharedTrigramRatio;
const generated = readJson("src/data/generated-pages.json");
const pool = [...generated.filter(p => p.effectiveIndex === "index" && p.path !== "/").map(p => p.path), "/", "/선불폰/", "/알뜰폰/"];
const { landings } = buildExperimentRegistry();
const shingles = new Map([...pool, ...landings.pages.map(p => p.path)].map(p => [p, grams(overlapText(read(p)))]));
const passesOtherGates = o => !o.gateReasons.some(r => !r.startsWith("rendered_overlap_with:"));
const rows = landings.pages.map((p, index) => {
  // Compare with every existing indexable page, and with A pages EARLIER in data order that pass the other
  // gates: when two landings overlap, only the later one is demoted (same rule as the regional generator).
  const others = [...pool, ...landings.pages.slice(0, index).filter(passesOtherGates).map(o => o.path)];
  const best = others.map(o => ({ path: o, ratio: overlap(shingles.get(p.path), shingles.get(o)) })).sort((a, b) => b.ratio - a.ratio)[0];
  return { path: p.path, keyword: p.keyword, template: p.template, slugPattern: p.slugPattern, indexCandidate: p.indexCandidate, gateReasons: p.gateReasons,
    intentOwner: p.intentOwner, titleChars: [...p.title].length, descriptionChars: [...p.description].length, bodyChars: visibleLength(p.bodyText),
    internalLinks: p.links.length + p.related.length, planRows: p.planRows.map(r => r.id), factSources: [...new Set(p.sections.flatMap(s => s.factSources))],
    renderedMaxOverlap: { with: best.path, sharedTrigramRatio: Number(best.ratio.toFixed(3)) } };
});
const result = { generatedAt: new Date().toISOString(), internalThresholds: { titleMaxChars: 40, descriptionMaxChars: 80, minBodyCharacters: settings.minBodyCharacters,
  minInternalLinks: settings.minInternalLinks, maxSharedTrigramRatio: 0.30, note: "Internal project rules for this experiment, not search engine indexing requirements." }, landings: rows };
fs.mkdirSync("reports/seo-experiments", { recursive: true });
fs.writeFileSync("reports/seo-experiments/a-landing-review.json", JSON.stringify(result, null, 2) + "\n");
const md = ["| 경로 | 후보 | 사유 | 제목 | 본문 | 링크 | 최대 중복(렌더링) |", "|---|---|---|---|---|---|---|",
  ...rows.map(r => `| ${r.path} | ${r.indexCandidate ? "index" : "noindex"} | ${r.gateReasons.join("<br>") || "-"} | ${r.titleChars} | ${r.bodyChars} | ${r.internalLinks} | ${r.renderedMaxOverlap.sharedTrigramRatio} (${r.renderedMaxOverlap.with}) |`)].join("\n");
fs.writeFileSync("reports/seo-experiments/a-landing-review.md", md + "\n");
console.log(md);
// --write-demotions pins every landing (that passes all other gates) whose rendered overlap exceeds the limit.
if (process.argv.includes("--write-demotions")) {
  const file = "src/data/seo-experiments/a-rendered-overlap.json";
  const review = JSON.parse(fs.readFileSync(file, "utf8"));
  review.reviewedAt = new Date().toISOString().slice(0, 10);
  review.demoted = rows.filter(r => !r.gateReasons.some(x => !x.startsWith("rendered_overlap_with:")) && r.renderedMaxOverlap.sharedTrigramRatio > RENDERED_OVERLAP_LIMIT)
    .map(r => ({ path: r.path, with: r.renderedMaxOverlap.with, ratio: r.renderedMaxOverlap.sharedTrigramRatio }));
  fs.writeFileSync(file, JSON.stringify(review, null, 2) + "\n");
  console.log("pinned demotions:", JSON.stringify(review.demoted));
}
