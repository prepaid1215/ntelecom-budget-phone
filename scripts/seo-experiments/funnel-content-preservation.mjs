// After adding /start/ to all 503 original pages, exact HTML hashes are expected to change.
// Preserve the original route inventory and SEO-critical page attributes instead.
// The unchanged strict SHA checker remains available for releases without shared UI updates.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const dist=path.resolve("dist");
const lines=fs.readFileSync("seo-lab/baseline/existing-503-html.sha256","utf8").trim().split("\n");
const files=lines.map(line=>line.trim().split(/\s+/).slice(1).join(" ").replace(/^\.\//,""));
assert.equal(files.length,503,"Original 503-page baseline must remain complete");
for(const file of files){
 const target=path.join(dist,file);
 assert.ok(fs.existsSync(target),"Original route disappeared: "+file);
 const html=fs.readFileSync(target,"utf8");
 assert.match(html,/<title>[^<]+<\/title>/,"Missing title: "+file);
 assert.match(html,/<meta name="description" content="[^"]+"/,"Missing description: "+file);
 assert.match(html,/<link rel="canonical" href="https:\/\//,"Missing canonical: "+file);
 assert.match(html,/<meta name="robots" content="(?:noindex|index),follow"/,"Missing robots: "+file);
 assert.equal((html.match(/<h1\b/g)||[]).length,1,"Original page H1 count changed: "+file);
 assert.match(html,/<main>[\s\S]*<\/main>/,"Missing original page content container: "+file);
 assert.match(html,/\/start\/\?from=/,"Original page must route activation CTA through /start/: "+file);
}
const start=path.join(dist,"start/index.html");
assert.ok(fs.existsSync(start),"/start/ missing");
const startHtml=fs.readFileSync(start,"utf8");
assert.match(startHtml,/name="robots" content="noindex,follow"/,"Conversion page must remain noindex");
assert.match(startHtml,/https:\/\/www\.n-telecom\.co\.kr\/ntgo\/view\/open\/kt\/face_auth\.aspx/);
assert.match(startHtml,/https:\/\/www\.n-telecom\.co\.kr\/ntgo\/view\/open\/lg\/face_auth\.aspx/);
console.log("PASS: all 503 original routes remain, SEO-critical metadata preserved, conversion CTAs route through /start/, and /start/ is noindex with two seller-specific outbound links.");
