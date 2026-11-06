import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const run = (script, ...args) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(script + " failed:\n" + result.stdout + "\n" + result.stderr);
  return result.stdout;
};
const ledgerPath = "seo-lab/regions/index-flow-observations.json";
const originalLedger = fs.readFileSync(ledgerPath);
const tempInput = path.join(os.tmpdir(), "regional-index-flow-fixture-" + process.pid + ".json");
try {
  run("scripts/generate-regional-pages.mjs");
  const examples = JSON.parse(fs.readFileSync("seo-lab-regional-content-preview/catalog-examples.json", "utf8"));
  const registry = JSON.parse(fs.readFileSync("seo-lab-regions-preview/url-registry.json", "utf8"));
  const audit = JSON.parse(run("scripts/audit-regional-pages.mjs"));
  if (examples.examples.length !== 2) throw new Error("Expected two search-intent-specific catalog examples.");
  const prepaid = examples.examples.find(item => item.pageType === "prepaid");
  const mvno = examples.examples.find(item => item.pageType === "mvno");
  if (!prepaid || !mvno || prepaid.searchIntent === mvno.searchIntent) throw new Error("Prepaid and MVNO content intents were not separated.");
  if (!prepaid.body.includes("39,600원") || !prepaid.body.includes("45,900원") || !prepaid.sources.some(url => url.includes("n-telecom.co.kr"))) throw new Error("Prepaid example is missing catalog-backed prices or source.");
  if (!mvno.body.includes("21,100원") || !mvno.body.includes("23,800원") || !mvno.sources.some(url => url.includes("n-telecom.co.kr"))) throw new Error("MVNO example is missing catalog-backed prices or source.");
  if (examples.publishable !== false || examples.examples.some(item => item.status !== "catalog-example-only")) throw new Error("National catalog samples must remain review-only.");
  if (registry.pages.some(page => page.editorialIndexCandidate)) throw new Error("A regional page was approved without a verified local utility fact.");
  if (!audit.passed || audit.editorialIndexCandidates !== 0) throw new Error("Regional audit failed or reported a candidate without local evidence.");

  const observedUrl = registry.pages[0].url;
  fs.writeFileSync(tempInput, JSON.stringify({ events: [{ url: observedUrl, type: "googleIndex", observedAt: new Date().toISOString(), source: "https://search.google.com/search-console", data: { status: "indexed", checkedAt: new Date().toISOString(), canonicalSelected: observedUrl } }] }));
  run("scripts/record-regional-observation.mjs", "--input=" + tempInput);
  run("scripts/generate-regional-pages.mjs");
  const preservedFlow = JSON.parse(fs.readFileSync("seo-lab-regions-preview/index-flow.json", "utf8"));
  const observedRecord = preservedFlow.records.find(record => record.url === observedUrl);
  if (observedRecord?.googleIndex.status !== "indexed" || observedRecord.observationEventCount !== 1) throw new Error("A rebuild discarded the durable IndexFlow observation.");
  const observedAudit = JSON.parse(run("scripts/audit-regional-pages.mjs"));
  if (!observedAudit.passed || observedAudit.crawlAndIndexState !== "observed") throw new Error("Audit did not distinguish a real imported observation from the unobserved baseline.");
  console.log(JSON.stringify({
    passed: true,
    generatedCatalogExamples: examples.examples.length,
    prepaidIntent: prepaid.searchIntent,
    mvnoIntent: mvno.searchIntent,
    regionalPagesWithVerifiedLocalUtilityFacts: 0,
    regionalIndexCandidates: audit.editorialIndexCandidates,
    durableObservationPreservedAfterRegeneration: true,
    evidenceAccuracyClaim: "not inferred from synthetic fixtures"
  }, null, 2));
} finally {
  fs.writeFileSync(ledgerPath, originalLedger);
  fs.rmSync(tempInput, { force: true });
  run("scripts/generate-regional-pages.mjs");
}
