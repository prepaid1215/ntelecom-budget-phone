import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).filter(arg => arg.startsWith("--")).map(arg => {
  const [key, ...value] = arg.slice(2).split("=");
  return [key, value.join("=")];
}));
if (!args.url || !args.id) throw new Error("Usage: node scripts/fetch-regional-source.mjs --id=source-name --url=https://official.example/data.json");
if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(args.id)) throw new Error("Source id must be a lowercase slug.");
const manifest = JSON.parse(fs.readFileSync("seo-lab/regions/source-snapshots.json", "utf8"));
const url = new URL(args.url);
if (url.protocol !== "https:" || !manifest.allowedHosts.includes(url.hostname.toLowerCase())) throw new Error("HTTPS source host is not in the reviewed allowlist.");
const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "ntelecom-regional-evidence-review/1.0" } });
if (!response.ok) throw new Error("Source request failed: HTTP " + response.status);
const finalUrl = new URL(response.url);
if (finalUrl.protocol !== "https:" || !manifest.allowedHosts.includes(finalUrl.hostname.toLowerCase())) throw new Error("Source redirected outside the reviewed allowlist.");
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length > 20 * 1024 * 1024) throw new Error("Source snapshot exceeds the 20MB review limit.");
const contentType = response.headers.get("content-type") || "application/octet-stream";
const extension = /json/i.test(contentType) || /\.json(?:$|\?)/i.test(url.href) ? ".json"
  : /csv/i.test(contentType) || /\.csv(?:$|\?)/i.test(url.href) ? ".csv"
    : /pdf/i.test(contentType) || /\.pdf(?:$|\?)/i.test(url.href) ? ".pdf" : ".bin";
if (extension === ".bin") throw new Error("Only JSON, CSV, and PDF source snapshots are supported.");
const directory = path.resolve("seo-lab/regions/source-cache");
fs.mkdirSync(directory, { recursive: true });
const output = path.join(directory, args.id + extension);
fs.writeFileSync(output, bytes, { flag: "wx" });
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
console.log(JSON.stringify({ id: args.id, requestedUrl: url.href, finalUrl: finalUrl.href, contentType, bytes: bytes.length, sha256, capturedAt: new Date().toISOString(), path: path.relative(process.cwd(), output), reviewStatus: "captured_not_verified", next: "Inspect the snapshot, add its exact hash and source pointer mappings to source-snapshots.json, then verify each claim." }, null, 2));
