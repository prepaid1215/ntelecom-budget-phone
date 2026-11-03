// Byte-level preservation check of the 503 pre-experiment HTML files.
//   node scripts/seo-experiments/compare-baseline.mjs                 # vs seo-lab/baseline/existing-503-html.sha256
//   node scripts/seo-experiments/compare-baseline.mjs --base-ref=876d8c8   # rebuild that commit today, then compare
// --base-ref removes build-date drift (promotion expiry is evaluated at build time), so any remaining
// difference is caused by this branch. Uses the same SITE_URL/BASE_PATH/PRODUCTION_READY env as the build.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { distRoot } from "./dist-lib.mjs";

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const root = distRoot();
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const parse = text => new Map(text.trim().split("\n").map(line => { const [hash, ...rest] = line.split(/\s+/); return [rest.join(" ").replace(/^\.\//, ""), hash]; }));

let expected, source;
const baseRef = arg("base-ref");
if (baseRef) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-base-"));
  execSync(`git worktree add --detach ${dir} ${baseRef}`, { stdio: "ignore" });
  try {
    fs.symlinkSync(path.resolve("node_modules"), path.join(dir, "node_modules"));
    // The worktree shares node_modules via symlink; skip pnpm's pre-run install check there.
    execSync("pnpm run build", { cwd: dir, stdio: "ignore", env: { ...process.env, npm_config_verify_deps_before_run: "false", pnpm_config_verify_deps_before_run: "false" } });
    const baseDist = path.join(dir, "dist");
    const files = execSync("find . -name '*.html' | sort", { cwd: baseDist }).toString().trim().split("\n");
    expected = new Map(files.map(f => [f.replace(/^\.\//, ""), sha(path.join(baseDist, f))]));
    source = `fresh build of ${baseRef}`;
  } finally {
    execSync(`git worktree remove --force ${dir}`, { stdio: "ignore" });
  }
} else {
  expected = parse(fs.readFileSync("seo-lab/baseline/existing-503-html.sha256", "utf8"));
  source = "seo-lab/baseline/existing-503-html.sha256";
}
const missing = [], changed = [];
for (const [rel, hash] of expected) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) missing.push(rel);
  else if (sha(file) !== hash) changed.push(rel);
}
const result = { comparedAgainst: source, expectedFiles: expected.size, identical: expected.size - missing.length - changed.length, missing, changed: changed.slice(0, 50), changedCount: changed.length };
console.log(JSON.stringify(result, null, 2));
if (missing.length || changed.length) process.exit(1);
