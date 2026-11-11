#!/usr/bin/env node
// A truthful revision ledger: the first import records hashes without pretending
// that every existing page was just published. Only significant changes get dates.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseLocs } from "./indexnow-pipeline.mjs";

const digest=value=>crypto.createHash("sha256").update(value).digest("hex");
const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date+"T00:00:00Z"));
const match=(body,regex)=>body.match(regex)?.[1]||"";

export function significantFingerprint(html){
  const main=match(html,/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const title=match(html,/<title>([\s\S]*?)<\/title>/i);
  const description=match(html,/<meta\s+name="description"\s+content="([^"]*)"/i);
  const structured=match(html,/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if(!main||!title)throw Error("Expected rendered main/title for revision tracking");
  return digest(JSON.stringify([title,description,main,structured]));
}

export function refreshLedger({dist,origin,previous,date}){
  if(!validDate(date))throw Error("A real YYYY-MM-DD source-commit date is required");
  const site=new URL(origin).origin;
  const xml=fs.readFileSync(path.join(dist,"sitemap.xml"),"utf8");
  const urls=parseLocs(xml).map(x=>x.url);
  if(!previous||previous.schemaVersion!==1||typeof previous.initialized!=="boolean")throw Error("Invalid revision ledger");
  const next={schemaVersion:1,initialized:true,entries:{}};
  const initial=!previous.initialized;
  let fresh=0,updated=0,unchanged=0,dated=0;
  for(const url of urls){
    const parsed=new URL(url);
    if(parsed.origin!==site||parsed.search||parsed.hash)throw Error("Sitemap URL is not within verified domain: "+url);
    const route=decodeURI(parsed.pathname);
    if(!route.startsWith("/")||!route.endsWith("/")||route.includes("..")||route.includes("\\"))throw Error("Unsafe route "+route);
    const file=path.resolve(dist,"."+route+"index.html");
    if(!file.startsWith(path.resolve(dist)+path.sep)||!fs.existsSync(file))throw Error("Sitemap URL lacks an HTML file "+route);
    const html=fs.readFileSync(file,"utf8");
    if(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html))throw Error("Noindex URL listed in sitemap "+route);
    const canonical=match(html,/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    if(canonical!==url)throw Error("Canonical disagrees with sitemap "+route);
    const hash=significantFingerprint(html);
    const was=previous.entries?.[route];
    const changed=was?.hash!==hash;
    const lastmod=initial?null:changed?date:(was.lastmod||null);
    if(!was)fresh++;else if(changed)updated++;else unchanged++;
    if(lastmod)dated++;
    next.entries[route]={hash,lastmod};
  }
  return {ledger:next,stats:{initial,fresh,updated,unchanged,dated,tracked:urls.length}};
}

const main=()=>{
  const args=process.argv.slice(2);
  const val=name=>args.find(v=>v.startsWith("--"+name+"="))?.slice(name.length+3);
  const dist=path.resolve(val("dist")||"dist");
  const ledgerPath=path.resolve(val("ledger")||"src/data/seo-lastmod.json");
  const previous=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
  const date=val("date");
  const origin=val("origin")||process.env.SITE_URL;
  if(!origin)throw Error("--origin required");
  const result=refreshLedger({dist,origin,previous,date});
  if(args.includes("--write"))fs.writeFileSync(ledgerPath,JSON.stringify(result.ledger,null,2)+"\n");
  console.log(JSON.stringify({written:args.includes("--write"),...result.stats},null,2));
};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
