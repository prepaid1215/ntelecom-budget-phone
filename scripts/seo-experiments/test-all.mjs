// Runs every check in order and writes reports/seo-experiments/test-summary.json.
//   node scripts/seo-experiments/test-all.mjs [--skip-render]
// Builds: (1) production-mode dist/ with A/C, (2) PRODUCTION_READY=false into dist-noready/,
// (3) the C fixture build inside test-system.mjs. Nothing is deployed.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const PROD = { SITE_URL: "https://xn--h49a29twjdmms77a5sofgdjwa.shop", BASE_PATH: "/", PRODUCTION_READY: "true", };
const steps = [
  ["unit tests", "node", ["--test", "scripts/seo-experiments/test-units.mjs"]],
  ["build (production mode, A/C only)", "pnpm", ["run", "build"], PROD],
  ["seo-audit.mjs (whole site incl. experiments)", "node", ["scripts/seo-audit.mjs"], PROD],
  ["audit-existing-500.mjs", "node", ["scripts/audit-existing-500.mjs"], PROD],
  ["audit-500-links-schema.mjs", "node", ["scripts/audit-500-links-schema.mjs"], PROD],
  ["audit diff vs baseline (pre-existing vs new findings)", "node", ["scripts/seo-experiments/audit-diff.mjs"]],
  ...(fs.existsSync("src/pages/start/index.astro") ? [["approved /start/ layout: 503 original routes and core metadata", "node", ["scripts/seo-experiments/funnel-content-preservation.mjs"], PROD]] : [["existing 503 HTML SHA-256 vs baseline", "node", ["scripts/seo-experiments/compare-baseline.mjs"], PROD]]),
  ["dist tests", "node", ["--test", "scripts/seo-experiments/test-dist.mjs"], PROD],
  ["HTTP access tests", "node", ["--test", "scripts/seo-experiments/test-http.mjs"], PROD],
  ["C link manifest", "node", ["scripts/seo-experiments/link-manifest.mjs"], PROD],
  ["A landing review record", "node", ["scripts/seo-experiments/a-review.mjs"], PROD],
  ["7/14/28-day report", "node", ["scripts/seo-experiments/report.mjs"], PROD],
  ...(process.argv.includes("--skip-render") ? [] : [["Chromium render check", "python3", ["scripts/seo-experiments/render-check.py"], { ...PROD, ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {}) }]]),
  ["build (PRODUCTION_READY=false) into dist-noready", "npx", ["astro", "build", "--outDir", "dist-noready"], { ...PROD, PRODUCTION_READY: "false" }],
  ["dist tests on PRODUCTION_READY=false build", "node", ["--test", "scripts/seo-experiments/test-dist.mjs"], { ...PROD, PRODUCTION_READY: "false", SEO_DIST: "dist-noready" }],
  ["build with deploy-pages.yml env (BASE_PATH) into dist-pages", "npx", ["astro", "build", "--outDir", "dist-pages"], { SITE_URL: "https://prepaid1215.github.io", BASE_PATH: "/ntelecom-budget-phone", PRODUCTION_READY: "false" }],
  ["dist tests on deploy-env build", "node", ["--test", "scripts/seo-experiments/test-dist.mjs"], { SITE_URL: "https://prepaid1215.github.io", BASE_PATH: "/ntelecom-budget-phone", PRODUCTION_READY: "false", SEO_DIST: "dist-pages" }],
  ["system test (C CLI, fixture build, manifest, observe, report)", "node", ["--test", "scripts/seo-experiments/test-system.mjs"], PROD]
];
const results = [];
for (const [name, cmd, args, env = {}] of steps) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1 << 28 });
  const out = (r.stdout || "") + (r.stderr || "");
  const tap = { pass: Number(out.match(/^# pass (\d+)/m)?.[1] ?? NaN), fail: Number(out.match(/^# fail (\d+)/m)?.[1] ?? NaN) };
  results.push({ name, command: [cmd, ...args].join(" "), status: r.status === 0 ? "pass" : "fail", exitCode: r.status, seconds: Math.round((Date.now() - started) / 1000),
    ...(Number.isFinite(tap.pass) ? { tests: tap } : {}), tail: out.trim().split("\n").slice(-6).join("\n") });
  console.log(`${r.status === 0 ? "PASS" : "FAIL"}  ${name} (${results.at(-1).seconds}s)${Number.isFinite(tap.pass) ? ` ${tap.pass} passed / ${tap.fail} failed` : ""}`);
  if (r.status !== 0) console.log(out.split("\n").filter(l => /not ok|error|Error|expected|actual|오류/.test(l)).slice(0, 12).join("\n"));
}
for (const dir of ["dist-noready", "dist-pages"]) fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync("reports/seo-experiments", { recursive: true });
fs.writeFileSync("reports/seo-experiments/test-summary.json", JSON.stringify({ ranAt: new Date().toISOString(), passed: results.filter(r => r.status === "pass").length, failed: results.filter(r => r.status === "fail").length, results }, null, 2) + "\n");
if (results.some(r => r.status === "fail")) process.exit(1);
