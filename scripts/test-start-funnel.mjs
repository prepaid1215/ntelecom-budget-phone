import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve("dist");
const read = p => fs.readFileSync(path.join(root,p),"utf8");
const home=read("index.html");
const start=read("start/index.html");
const existing=JSON.parse(fs.readFileSync("src/data/generated-pages.json","utf8"));

assert.equal(existing.length,500,"Original 500 catalog routes must be preserved");
for(const route of existing){
  const filename=route.path==="/"?"index.html":route.path.replace(/^\/|\/$/g,"")+"/index.html";
  assert.ok(fs.existsSync(path.join(root,filename)),"Missing legacy route "+route.path);
}
assert.match(start,/<h1[^>]*>[\s\S]*?후불 알뜰폰 개통을 시작하세요[\s\S]*?<\/h1>/);
assert.match(start,/<meta name="robots" content="noindex,follow"/);
assert.match(start,/<link rel="canonical" href="https:\/\/xn--h49a29twjdmms77a5sofgdjwa\.shop\/start\/"/);
assert.match(start,/data-network="kt" data-billing="postpaid"/);
assert.match(start,/data-network="lg" data-billing="postpaid"/);
assert.match(start,/data-network="kt" data-billing="prepaid"/);
assert.match(start,/data-network="lg" data-billing="prepaid"/);
assert.match(start,/start_view/);
assert.match(start,/activation_outbound/);
assert.match(start,/prepaid_alternative_open/);
assert.match(home,/\/start\/\?from=59man_budget_hero/);
assert.match(home,/\/start\/\?from=59man_budget_header/);
assert.doesNotMatch(home,/<a class="header-cta" href="https:\/\/preplan\.site/);
console.log("PASS: 500 pages preserved; /start canonical, noindex, two networks/two billing paths, funnel events and internal CTAs confirmed.");
