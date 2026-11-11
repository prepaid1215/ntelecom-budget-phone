#!/usr/bin/env node
// Read-only report: internal crawl paths among sitemap-indexable HTML pages.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {htmlRoutes,localRoute,sitemapLocs,anchors} from "./dist-lib.mjs";
const main=()=>{
 const root=path.resolve("dist"),routes=htmlRoutes(root);
 const origin=new URL(process.env.SITE_URL||"https://xn--h49a29twjdmms77a5sofgdjwa.shop").origin;
 const base=process.env.BASE_PATH||"/";
 const indexable=new Set(sitemapLocs(root).map(loc=>{
  const url=new URL(loc);
  if(url.origin!==origin)throw Error("Unexpected sitemap domain "+loc);
  const r=localRoute(url.pathname,base);
  if(!r||!routes.has(r))throw Error("Sitemap points to non-HTML page "+loc);
  return r;
 }));
 const links=new Map();
 for(const route of indexable){
  const html=fs.readFileSync(routes.get(route),"utf8");
  const out=new Set();
  for(const a of anchors(html)){
   let href=a.href;
   if(!href)continue;
   try{if(href.startsWith("http")){const u=new URL(href);if(u.origin!==origin)continue;href=u.pathname+u.search;}}catch{continue}
   const to=localRoute(href,base);
   if(to&&indexable.has(to))out.add(to);
  }
  links.set(route,[...out]);
 }
 const depths=new Map([["/",0]]),queue=["/"];
 if(!indexable.has("/"))throw Error("Indexable homepage missing");
 for(let i=0;i<queue.length;i++){
   const p=queue[i],depth=depths.get(p);
   for(const next of links.get(p)||[])if(!depths.has(next)){depths.set(next,depth+1);queue.push(next)}
 }
 const unreachable=[...indexable].filter(p=>!depths.has(p));
 const deep=[...depths].filter(([p,d])=>d>3).map(([path,depth])=>({path,depth}));
 const histogram={};
 for(const depth of depths.values())histogram[depth]=(histogram[depth]||0)+1;
 const report={indexable:indexable.size,reachable:depths.size,unreachableCount:unreachable.length,unreachable:unreachable.slice(0,100),overThreeClicks:deep.length,deep:deep.slice(0,100),depths:histogram};
 fs.mkdirSync("reports/seo-experiments",{recursive:true});
 fs.writeFileSync("reports/seo-experiments/crawl-depth.json",JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({indexable:report.indexable,reachable:report.reachable,unreachableCount:report.unreachableCount,overThreeClicks:report.overThreeClicks,depths:histogram}));
};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
