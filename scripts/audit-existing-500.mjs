// Full audit of the original 500 generated MVNO pages.
// Runs against the built dist/ output and does not change production.
import fs from "node:fs";
import path from "node:path";
import pages from "../src/data/generated-pages.json" with {type:"json"};
import plans from "../src/data/research/plans.json" with {type:"json"};
import site from "../src/data/site.json" with {type:"json"};

const root=path.resolve("dist");
const out=path.resolve("audit-results");
fs.mkdirSync(out,{recursive:true});
const expected=new URL(process.env.SITE_URL?.trim()||site.siteUrl);
const ready=process.env.PRODUCTION_READY==="true";
const routeToFile=route=>path.join(root,...route.split("/").filter(Boolean),"index.html");
const extract=(html,re)=>(html.match(re)||[])[1]||"";
const strip=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&(?:nbsp|amp|quot|lt|gt);/g," ")
  .replace(/\s+/g," ").trim();
const issues=[];
const record=(level,category,route,detail)=>issues.push({level,category,route,detail});
const results=[];
const titleMap=new Map(),h1Map=new Map(),canonicalMap=new Map(),htmlBodies=new Map();
const routeMap=new Map(pages.map(p=>[p.path,p]));
const inbound=new Map(pages.map(p=>[p.path,0]));

if(pages.length!==500) record("error","page-count","/","Expected 500 pages; got "+pages.length);
const counts={indexCandidates:0,noindexCandidates:0,indexRobots:0,noindexRobots:0,htmlFound:0};
for(const p of pages){
 const route=p.path,fp=routeToFile(route);
 if(!fs.existsSync(fp)){record("error","html-missing",route,fp);continue;}
 counts.htmlFound++;
 const html=fs.readFileSync(fp,"utf8");
 const title=extract(html,/<title>([\s\S]*?)<\/title>/i);
 const h1matches=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
 const h1=h1matches.length===1?strip(h1matches[0][1]):"";
 const description=extract(html,/<meta\s+name="description"\s+content="([^"]*)"/i);
 const canonical=extract(html,/<link\s+rel="canonical"\s+href="([^"]+)"/i);
 const robots=extract(html,/<meta\s+name="robots"\s+content="([^"]+)"/i);
 const ogurl=extract(html,/<meta\s+property="og:url"\s+content="([^"]+)"/i);
 const body=extract(html,/<main\b[^>]*>([\s\S]*?)<\/main>/i);
 const text=strip(body);
 const normalized=text.replace(/\d[\d,.]*\s*(?:원|GB|Mbps|개월)/g,"<값>");
 const target=new URL(route,expected).href;
 const desired=ready&&p.effectiveIndex==="index"?"index,follow":"noindex,follow";
 const matched=titleMap.get(title);
 if(!title)record("error","title-missing",route,"");
 if(matched)record("error","title-duplicate",route,matched);
 if(title)titleMap.set(title,route);
 if(!description)record("error","description-missing",route,"");
 if(h1matches.length!==1)record("error","h1-count",route,String(h1matches.length));
 if(!h1)record("error","h1-missing",route,"");
 if(h1Map.has(h1))record("warning","h1-duplicate",route,h1Map.get(h1));
 if(h1)h1Map.set(h1,route);
 if(!canonical||canonical!==target)record("error","canonical-mismatch",route,canonical+" !== "+target);
 if(canonicalMap.has(canonical))record("error","canonical-duplicate",route,canonicalMap.get(canonical));
 if(canonical)canonicalMap.set(canonical,route);
 if(robots!==desired)record("error","robots-mismatch",route,robots+" wanted "+desired);
 if(ogurl!==canonical)record("error","ogurl-mismatch",route,ogurl);
 if(!text||text.length<180)record("warning","thin-body",route,"visible chars: "+text.length);
 if(html.includes("https://preplan.site/"))record("warning","old-activation-link",route,"preplan.site");
 // Operator identity (footer and JSON-LD) is intentional business disclosure, not a leftover brand.
 const brandScan=html.replace(/<footer\b[\s\S]*?<\/footer>/gi,"").replace(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,"");
 if(brandScan.includes("59만모바일"))record("warning","old-brand-in-html",route,"59만모바일 outside operator disclosure");
 if(!html.includes("<main"))record("error","main-missing",route,"");
 for(const hit of html.matchAll(/href="(\/[^"#?]*)/g)){
   const link=hit[1],key=link.endsWith("/")?link:link+"/";
   if(inbound.has(key)&&key!==route)inbound.set(key,inbound.get(key)+1);
 }
 if(p.effectiveIndex==="index")counts.indexCandidates++;else counts.noindexCandidates++;
 if(robots==="index,follow")counts.indexRobots++;
 if(robots==="noindex,follow")counts.noindexRobots++;
 if(htmlBodies.has(normalized))record("warning","body-identical-normalized",route,htmlBodies.get(normalized));
 else htmlBodies.set(normalized,route);
 results.push({path:route,type:p.pageType,indexCandidate:p.effectiveIndex,title,h1,canonical,robots,descriptionLength:description.length,bodyCharacters:text.length,inbound:0});
}

const listing=pages.filter(p=>["tag","combo"].includes(p.pageType));
const group=new Map();
for(const p of listing){
 const key=[...p.supportingPlanIds].sort().join("|");
 if(!key)continue;
 const g=group.get(key)||[];g.push(p);group.set(key,g);
}
for(const g of group.values()){
 if(g.length<2)continue;
 // Different join intents may validly feature identical plan sets.
 // Flag only duplicates *within* the same user journey (general / new-number / transfer).
 const intents=new Map();
 for(const item of g.filter(p=>p.effectiveIndex==="index")){
   const intent=item.path.startsWith("/new-number/")?"new-number":
     item.path.startsWith("/number-transfer/")?"number-transfer":"general";
   intents.set(intent,[...(intents.get(intent)||[]),item]);
 }
 for(const sameIntent of intents.values()){
 const count=sameIntent.length;
 if(count>1)record("warning","same-plan-set-indexable",sameIntent[0].path,
   count+" same-intent index candidates share a product set: "+sameIntent.map(p=>p.path).join(" "));
 }
}
for(const r of results){
 r.inbound=inbound.get(r.path)||0;
 if(r.indexCandidate==="index"&&r.inbound===0&&r.path!=="/")
   record("warning","indexable-no-internal-links",r.path,"no detected internal incoming links");
}
for(const p of plans){
 if(!p.monthly_price || !p.name || !p.data_text || !p.network)
  record("error","plan-data",p.id,"required plan detail missing");
 if(p.promotion?.active&&p.promotion.end_date&&p.promotion.end_date<new Date().toISOString().slice(0,10))
  record("warning","past-promotion",p.id,p.promotion.end_date);
}
const generated=[...fs.readdirSync(root,{withFileTypes:true})].length;
const knownNew=["/선불폰/","/알뜰폰/"];
const sitemapFile=path.join(root,"sitemap.xml");
const sitemap=fs.existsSync(sitemapFile)?fs.readFileSync(sitemapFile,"utf8"):"";
const sitemapLocs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
for(const route of knownNew){
 if(!fs.existsSync(routeToFile(route)))record("error","new-section-missing",route,"");
 if(ready&&!sitemapLocs.includes(new URL(route,expected).href))
  record("warning","new-section-not-in-sitemap",route,"new section is indexable but absent from sitemap");
}
const byCategory={};
for(const item of issues){
 const key=item.level+":"+item.category;
 byCategory[key]=(byCategory[key]||0)+1;
}
const summary={
 source:"built Astro HTML for existing generated-pages.json",
 auditedPages:pages.length,foundHtml:counts.htmlFound,
 ...counts,allPathsUnique:new Set(pages.map(p=>p.path)).size===pages.length,
 listingGroupsWithSameProductSet:[...group.values()].filter(g=>g.length>1).length,
 sourceDataCheckedAt:site.dataCheckedAt,ready,distinctVisibleBodies:htmlBodies.size,
 errors:issues.filter(x=>x.level==="error").length,
 warnings:issues.filter(x=>x.level==="warning").length,
 issueCounts:byCategory
};
fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2)+"\n");
fs.writeFileSync(path.join(out,"issues.json"),JSON.stringify(issues,null,2)+"\n");
fs.writeFileSync(path.join(out,"pages.json"),JSON.stringify(results,null,2)+"\n");
console.log("EXISTING 500 PAGE AUDIT SUMMARY\n"+JSON.stringify(summary,null,2));
console.log("ISSUES SAMPLE\n"+JSON.stringify(issues.slice(0,18),null,2));
if(summary.errors)process.exitCode=1;
