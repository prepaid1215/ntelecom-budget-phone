import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root=path.resolve("dist");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const home=read("index.html");
const start=read("start/index.html");
const pages=JSON.parse(fs.readFileSync("src/data/generated-pages.json","utf8"));
assert.equal(pages.length,500,"All existing 500 catalog records must remain");
for(const page of pages){
 const filename=page.path==="/"?"index.html":page.path.replace(/^\/|\/$/g,"")+"/index.html";
 assert.ok(fs.existsSync(path.join(root,filename)),"Missing existing page "+page.path);
 const rendered=read(filename);
 assert.match(rendered,/class="header start-header"/,"Shared header missing "+page.path);
 assert.equal((rendered.match(/id="start-sidebar"/g)||[]).length,1,"Exactly one sidebar required "+page.path);
}
assert.match(start,/지금 바로/);
assert.match(start,/셀프개통/);
assert.match(start,/앤텔레콤 추천 요금제/);
assert.match(start,/name="robots" content="noindex,follow"/);
assert.match(start,/rel="canonical" href="https:\/\/xn--h49a29twjdmms77a5sofgdjwa\.shop\/start\/"/);
for(const network of ["kt","lg"]){
  const expr=new RegExp('data-billing="postpaid" data-network="'+network+'"');
  assert.match(start,expr,network+" outbound postpaid action missing");
}
assert.match(start,/data-prepaid-details/);
assert.match(start,/data-outbound/);
assert.match(start,/id="postpaid-plans"/);
assert.match(start,/id="start-benefits"/);
assert.match(start,/id="start-usim"/);
assert.match(start,/id="start-faq"/);
assert.match(start,/activation_outbound/);
assert.match(start,/prepaid_alternative_open/);
assert.match(start,/start_view/);
assert.match(home,/\/start\/\?from=antelcom_hero/);
assert.match(home,/\/start\/\?from=antelcom_header/);
console.log("PASS: existing 500 pages, branded postpaid /start home, two CTA routes, noindex, catalog, USIM, benefits, FAQ and event tracking.");
