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
assert.match(start,/추천 요금제 4가지/);
assert.equal((start.match(/<article class="sh-plan"/g)||[]).length,4,"Four recommended plan cards expected");
assert.match(start,/<details id="postpaid-plans" class="sh-catalog sh-plan-details">/,"The full catalog should be collapsed by default");
assert.match(start,/전체 47개/,"Full catalog remains discoverable");
assert.match(start,/name="robots" content="noindex,follow"/);
assert.match(start,/rel="canonical" href="https:\/\/xn--h49a29twjdmms77a5sofgdjwa\.shop\/start\/"/);
for(const network of ["kt","lg"]){
  const expr=new RegExp('data-billing="postpaid" data-network="'+network+'"');
  assert.match(start,expr,network+" outbound postpaid action missing");
}
assert.doesNotMatch(start,/data-prepaid-details/,"Postpaid-only /start/ should not show prepaid enrollment");
assert.match(start,/data-outbound/);
const ogImage=path.join(root,"images/og/antelcom-og-main-v1.jpg");
assert.ok(fs.existsSync(ogImage),"Dedicated 1200×630 OG image missing");
assert.ok(fs.readFileSync(ogImage).subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])),"OG image is not a valid JPEG");
for(const html of [home,start]){
 assert.ok(html.includes('property="og:image" content="https://xn--h49a29twjdmms77a5sofgdjwa.shop/images/og/antelcom-og-main-v1.jpg"'),"OG URL missing");
 assert.match(html,/property="og:image:width" content="1200"/);
 assert.match(html,/property="og:image:height" content="630"/);
 assert.ok(html.includes('property="og:image:type" content="image/jpeg"'),"OG MIME type missing");
 assert.match(html,/name="twitter:card" content="summary_large_image"/);
}
assert.match(start,/https:\/\/www\.n-telecom\.co\.kr\/ntgo\/view\/open\/kt\/face_auth\.aspx/,"KT CTA must use this NTGO mirror's direct application path");
assert.match(start,/https:\/\/www\.n-telecom\.co\.kr\/ntgo\/view\/open\/lg\/face_auth\.aspx/,"LG CTA must use this NTGO mirror's direct application path");
assert.doesNotMatch(start,/https:\/\/preplan\.site/,"No previous seller fallback on /start/");

assert.match(start,/id="postpaid-plans"/);
assert.match(start,/id="start-benefits"/);
assert.match(start,/id="start-usim"/);
assert.match(start,/id="start-faq"/);
assert.match(start,/activation_outbound/);
assert.doesNotMatch(start,/prepaid_alternative_open/);
assert.match(start,/start_view/);
assert.match(home,/href="\/start\/"[^>]*>셀프개통 시작하기<\/a>/,"Home hero must lead to /start/");
assert.match(home,/\/start\/\?from=antelcom_header/);
assert.doesNotMatch(home,/선불폰/,"Postpaid-only home must not contain prepaid navigation");
assert.match(home,/data-start-home/,"Home must reuse the /start/ page content");
assert.match(home,/sh-hero-home/,"Home must have second reference hero layout");
assert.match(home,/요금제 비교부터 개통까지/);
assert.doesNotMatch(home,/id="start-recommended"/,"No duplicate recommended section on homepage");
assert.match(home,/class="pf pf-home"/,"Homepage must use existing circular filter styling");
assert.match(home,/data-home-filter/,"Homepage must have price/data/network controls");
assert.match(home,/data-group="price"/,"Price filter panel missing");
assert.match(home,/data-group="data"/,"Data filter panel missing");
assert.match(home,/data-group="net"/,"Network filter panel missing");
const finderSource=fs.readFileSync("src/components/HomePlanFinder.astro","utf8");
assert.match(finderSource,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,"Desktop filter needs three equal columns");
assert.match(finderSource,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,"Tablet filter layout missing");
assert.match(finderSource,/grid-template-columns:minmax\(0,1fr\)/,"Mobile single-column filter layout missing");
const startCss=fs.readFileSync("src/styles/start.css","utf8");
assert.match(startCss,/The closed sidebar is the reference layout/,"Closed sidebar must define full-width baseline");
assert.match(startCss,/\.sh-main\{[\s\S]*?width:100%;[\s\S]*?padding-right:0;/,"Main must keep the full available width");
assert.doesNotMatch(startCss,/padding-right:210px/,"Main must not reserve 210px for open sidebar");
assert.match(startCss,/\.sh-main \.pf\.pf-home\{[\s\S]*?margin-right:0/,"Home filter must remain fixed while sidebar toggles");
assert.doesNotMatch(finderSource,/not\(\.sh-side-collapsed\)[^\n]*margin-right:210px/,"Filter must not move when sidebar toggles");
assert.match(finderSource,/HomeFilterIcon/,"Homepage must use unified filter icon set");
assert.match(home,/images\/usim\/baro-usim\.webp/,"KT SIM product photo missing on homepage");
assert.match(home,/images\/usim\/onechip\.webp/,"LG SIM product photo missing on homepage");
assert.match(start,/images\/usim\/baro-usim\.webp/,"KT SIM product photo missing on start page");
assert.match(start,/images\/usim\/onechip\.webp/,"LG SIM product photo missing on start page");
assert.match(finderSource,/price-mid/,"Monthly fee icons should not use data icons");

assert.match(home,/data-finder-list/,"Homepage must have one matching result grid");
assert.equal((home.match(/<article class="pf-card"/g)||[]).length,4,"Four initial homepage plans must be server rendered");
assert.doesNotMatch(home,/<details id="postpaid-plans"/,"Homepage filter must not be hidden by a disclosure");
assert.match(home,/id="postpaid-plans"/);
assert.match(home,/id="start-usim"/);
assert.match(home,/data-guide-carousel/,"Home should contain the photo carousel");
assert.match(start,/data-guide-carousel/,"Start page should contain the photo carousel");
for(let i=0;i<6;i++){
  const name="images/guide/step-"+String(i).padStart(2,"0")+".jpg";
  const file=path.join(root,name);
  assert.ok(fs.existsSync(file),"Missing guide image "+name);
  assert.ok(fs.readFileSync(file).subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])),"Invalid JPEG "+name);
  assert.ok(home.includes(name),"Guide photo not present on home: "+name);
}
assert.equal((home.match(/class="go-guide-slide/g)||[]).length,7,"Photo carousel should have six pictures and one CTA");
assert.match(start,/data-location="guide_carousel_last"/,"Last slide CTA missing");
const photoGuideSource=fs.readFileSync("src/components/SelfOpenPhotoCarousel.astro","utf8");
assert.match(photoGuideSource,/class="go-guide-stage"/,"The arrows require a slide-relative stage");
assert.match(photoGuideSource,/class="go-guide-prev"/,"Left-side arrow missing");
assert.match(photoGuideSource,/class="go-guide-next"/,"Right-side arrow missing");
assert.match(photoGuideSource,/go-guide-nav\{position:absolute/,"Arrows must be overlay controls");
assert.match(photoGuideSource,/track\.scrollTo/,"Next/previous should change only the card, not scroll the whole page");

assert.match(start,/https:\/\/www\.n-telecom\.co\.kr\/ntgo\/view\/open\/kt\/face_auth\.aspx/,"KT carousel must point to NTGO");
assert.match(start,/https:\/\/www\.n-telecom\.co\.kr\/ntgo\/view\/open\/lg\/face_auth\.aspx/,"LG carousel must point to NTGO");

assert.match(home,/id="start-faq"/);
console.log("PASS: existing 500 pages, branded postpaid /start home, two CTA routes, noindex, catalog, USIM, benefits, FAQ and event tracking.");

assert.doesNotMatch(home,/후불/,"Do not show banned terminology on homepage");
assert.doesNotMatch(start,/후불/,"Do not show banned terminology on /start/");
assert.doesNotMatch(home,/선불폰부터|선불폰 알아보기|선불폰 개통방법/,"Home must not promote prepaid");
assert.doesNotMatch(start,/data-billing="prepaid"/,"No prepaid activation on postpaid-only funnel");

for(const [pagePath,heading] of [
  ["guide/kt/index.html","KT망 알뜰폰 개통방법"],
  ["guide/lg/index.html","LG U+망 알뜰폰 개통방법"],
  ["faq/index.html","알뜰폰 자주 묻는 질문"]
]){
 const html=read(pagePath);
 assert.ok(html.includes(heading),"Independent guide or FAQ missing "+pagePath);
 assert.match(html,/rel="canonical"/,"Canonical URL missing "+pagePath);
 assert.doesNotMatch(html,/후불/,"Banned word in visible guide metadata "+pagePath);
}
assert.match(home,/href="\/guide\/kt\/"/,"Home must link to KT guide");
assert.match(home,/href="\/guide\/lg\/"/,"Home must link to LG guide");
assert.match(home,/href="\/faq\/"/,"Home must link to independent FAQ");
assert.match(home,/href="#start-steps"/,"Homepage anchor navigation must remain");
const smSource=fs.readFileSync("src/lib/sitemap.js","utf8");
for(const url of ["/guide/kt/","/guide/lg/","/faq/"])assert.ok(smSource.includes('path:"'+url+'"'),"Sitemap must include gated SEO page "+url);
