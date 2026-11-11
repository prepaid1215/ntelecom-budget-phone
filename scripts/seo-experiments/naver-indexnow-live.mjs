#!/usr/bin/env node
// Naver IndexNow. Safely sends only new/meaningfully changed, verified pages.
// No first-import backfill, no excluded URLs, no mass-blast, no Google Indexing API.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parseLocs} from "./indexnow-pipeline.mjs";
import {significantFingerprint} from "./lastmod-ledger.mjs";

const ORIGIN="https://xn--h49a29twjdmms77a5sofgdjwa.shop";
const KEY="7be9bab21ea2fbefbb07353904211af3";
const MAX_PER_RUN=40;
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function planUpdates({ledger,sent,sitemap,limit=MAX_PER_RUN}){
  if(ledger.schemaVersion!==1||sent.schemaVersion!==1||!ledger.initialized)throw Error("Invalid or uninitialized publication ledgers");
  const linked=new Set(parseLocs(sitemap).map(x=>x.url));
  const queue=[];
  for(const [route,record] of Object.entries(ledger.entries)){
    if(!record.lastmod||!datePattern.test(record.lastmod)||!/^[a-f0-9]{64}$/.test(record.hash))continue;
    if(!route.startsWith("/")||!route.endsWith("/")||route.includes(".."))throw Error("Unsafe route "+route);
    const url=new URL(route,ORIGIN).toString();
    if(!linked.has(url))continue;
    if(sent.entries?.[route]?.hash===record.hash)continue;
    queue.push({route,url,hash:record.hash,lastmod:record.lastmod});
  }
  queue.sort((a,b)=>a.lastmod.localeCompare(b.lastmod)||a.route.localeCompare(b.route));
  return queue.slice(0,limit);
}
const get=async url=>{
 const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(20000),headers:{"user-agent":"59manmobile-indexnow-publisher/1.0"}});
 if(response.status!==200)throw Error("Not public HTTP 200: "+url+" ("+response.status+")");
 return response.text();
};
export async function submit({ledger,sent,send=false,fetcher=fetch}){
 if(!send)throw Error("Explicit --send required");
 const siteRobots=await get(ORIGIN+"/robots.txt");
 if(!/^Allow: \/$/m.test(siteRobots)||/^Disallow: \/$/m.test(siteRobots))throw Error("robots.txt blocks crawling");
 const xml=await get(ORIGIN+"/sitemap.xml");
 const urlList=planUpdates({ledger,sent,sitemap:xml});
 if(urlList.length===0)return {sent,planned:0,accepted:0};
 const keyLocation=ORIGIN+"/"+KEY+".txt";
 if((await get(keyLocation)).trim()!==KEY)throw Error("IndexNow ownership key is not live");
 const ready=[];
 for(const item of urlList){
   const html=await get(item.url);
   if(!/<meta\s+name="robots"\s+content="index,follow"/i.test(html))throw Error("noindex changed page "+item.url);
   const canonical=html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
   if(canonical!==item.url)throw Error("canonical mismatch "+item.url);
   if(significantFingerprint(html)!==item.hash)throw Error("Live content not yet deployed "+item.url);
   ready.push(item);
 }
 const response=await fetcher("https://searchadvisor.naver.com/indexnow",{
   method:"POST",
   headers:{"content-type":"application/json; charset=utf-8"},
   body:JSON.stringify({host:new URL(ORIGIN).host,key:KEY,keyLocation,urlList:ready.map(x=>x.url)}),
   signal:AbortSignal.timeout(20000)
 });
 if(![200,202].includes(response.status))throw Error("Naver IndexNow rejected: HTTP "+response.status);
 const next={schemaVersion:1,entries:{...(sent.entries||{})}};
 for(const item of ready)next.entries[item.route]={hash:item.hash,lastmod:item.lastmod,status:response.status};
 return {sent:next,planned:ready.length,accepted:ready.length,status:response.status};
}
const main=async()=>{
 if(!process.argv.includes("--send")||process.env.INDEXNOW_ALLOW_SEND!=="yes")throw Error("Requires --send and INDEXNOW_ALLOW_SEND=yes");
 const ledger=read("src/data/seo-lastmod.json");
 const sent=read("src/data/seo-indexnow-sent.json");
 const result=await submit({ledger,sent,send:true});
 if(result.accepted)fs.writeFileSync("src/data/seo-indexnow-sent.json",JSON.stringify(result.sent,null,2)+"\n");
 console.log(JSON.stringify({planned:result.planned,accepted:result.accepted,status:result.status||"no_changes"},null,2));
};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(err=>{console.error(err.message);process.exitCode=1;});
