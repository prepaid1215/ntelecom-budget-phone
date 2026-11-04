#!/usr/bin/env node
// Build-only publication inventory. No network calls and no implicit IndexNow sending.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const enc = value => String(value).replace(/[<>&"']/g, ch => ({ "<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;" })[ch]);
const flag = (args,name,fallback="") => {
  const found=args.find(a=>a.startsWith("--"+name+"="));
  return found ? found.slice(name.length+3) : fallback;
};
export const parseLocs = xml => [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)]
  .map(match=>({ url:match[1].replace(/&amp;/g,"&"),block:match[0] }));
const readJson = file => file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,"utf8")) : null;
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data,null,2)+"\n");
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+"T00:00:00Z").toISOString().startsWith(value);
const normalize = value => new URL(value).origin;
const htmlFor = (dist,url,base,origin) => {
  const u=new URL(url);
  if(u.origin!==origin) throw Error("Sitemap contains foreign origin: "+url);
  let pathname=decodeURIComponent(u.pathname);
  if(base && base!=="/"){
    if(pathname!==base && !pathname.startsWith(base+"/")) throw Error("Sitemap URL outside base: "+url);
    pathname=pathname.slice(base.length)||"/";
  }
  if(pathname.includes("..")||pathname.includes("\\")||!pathname.startsWith("/")) throw Error("Unsafe URL: "+url);
  const rel=pathname.endsWith("/") ? pathname+"index.html" : pathname+".html";
  const file=path.resolve(dist,"."+rel);
  if(!file.startsWith(path.resolve(dist)+path.sep)) throw Error("URL outside build: "+url);
  if(!fs.existsSync(file)) throw Error("Sitemap URL does not have HTML: "+url);
  return fs.readFileSync(file,"utf8");
};

export function produce({dist,origin,previous=null,publishedAt=null,base="",key=null,initial=false,write=false}){
  origin=normalize(origin);
  if(publishedAt&&!validDate(publishedAt)) throw Error("publishedAt must be YYYY-MM-DD");
  if(key&&!/^[a-fA-F0-9-]{8,128}$/.test(key)) throw Error("IndexNow key must be 8-128 hex/hyphen characters");
  if(!fs.existsSync(path.join(dist,"sitemap.xml"))) throw Error("Built sitemap.xml missing");
  const xml=fs.readFileSync(path.join(dist,"sitemap.xml"),"utf8");
  const locs=parseLocs(xml);
  const prev=new Map((previous?.urls||[]).map(row=>[row.url,row]));
  const urls=[],changed=[];
  for(const {url} of locs){
    const content=htmlFor(dist,url,base,origin);
    if(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(content) ||
       /<meta[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots/i.test(content)) throw Error("noindex URL listed in sitemap: "+url);
    const canonical=(content.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)||
      content.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical/i))?.[1];
    if(canonical && canonical.replace(/&amp;/g,"&")!==url) throw Error("Sitemap canonical disagreement: "+url+" vs "+canonical);
    const hash=sha256(content);
    const was=prev.get(url);
    const updated=!was||was.sha256!==hash;
    // Initial import is NOT treated as a batch of freshly published URLs by default.
    if(updated && (was || initial)) changed.push(url);
    urls.push({url,sha256:hash,lastmod:updated ? (publishedAt || null) : (was.lastmod||null), change:!was?"new":updated?"updated":"unchanged"});
  }
  // A/B/C controls are respected because only built, indexable sitemap URLs are processed.
  const stamped=new Map(urls.filter(x=>x.lastmod).map(x=>[x.url,x.lastmod]));
  let rewritten=xml.replace(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g,(block,raw,body)=>{
    const u=raw.replace(/&amp;/g,"&"),d=stamped.get(u);if(!d)return block;
    const without=body.replace(/<lastmod>[^<]*<\/lastmod>/g,"");
    return "<url><loc>"+raw+"</loc><lastmod>"+d+"</lastmod>"+without+"</url>";
  });
  const recent=urls.filter(x=>x.lastmod).sort((a,b)=>b.lastmod.localeCompare(a.lastmod)).slice(0,100);
  const rss='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>앤텔레콤 개통방법 업데이트</title><link>'+
    enc(origin)+"/</link><description>공개된 개통 안내 업데이트</description>"+
    recent.map(x=>"<item><title>"+enc(decodeURI(new URL(x.url).pathname).split("/").filter(Boolean).at(-1)||"홈")+
      "</title><link>"+enc(x.url)+"</link><guid isPermaLink=\"true\">"+enc(x.url)+
      "</guid><pubDate>"+new Date(x.lastmod+"T00:00:00Z").toUTCString()+"</pubDate></item>").join("")+"</channel></rss>\n";
  const manifest={schemaVersion:1,origin,base,generatedAt:new Date().toISOString(),counts:{
    publicSitemapUrls:urls.length,new:urls.filter(x=>x.change==="new").length,
    updated:urls.filter(x=>x.change==="updated").length,unchanged:urls.filter(x=>x.change==="unchanged").length,
    changeNotifications:changed.length},urls};
  const payload=key ? {host:new URL(origin).host,key,keyLocation:origin+"/"+key+".txt",urlList:changed} : null;
  if(write){
    fs.writeFileSync(path.join(dist,"sitemap.xml"),rewritten);
    fs.writeFileSync(path.join(dist,"rss.xml"),rss);
    writeJson(path.join(dist,"seo-publication-manifest.json"),manifest);
    writeJson(path.join(dist,"indexnow-new.json"),payload || {disabled:"INDEXNOW_KEY missing; no remote notifications",urlList:changed});
    if(key)fs.writeFileSync(path.join(dist,key+".txt"),key+"\n");
  }
  return {manifest,payload,rss,rewritten};
}
const main = () => {
  const args=process.argv.slice(2),dist=path.resolve(flag(args,"dist","dist"));
  const origin=flag(args,"origin",process.env.SEO_PUBLIC_ORIGIN||"");
  if(!origin)throw Error("--origin required; never infer production origin from a preview build");
  const publishedAt=flag(args,"published-at",process.env.SEO_PUBLISHED_AT||"")||null;
  const previous=readJson(flag(args,"previous",""));
  const key=flag(args,"key",process.env.INDEXNOW_KEY||"")||null;
  const base=flag(args,"base","")||"";
  const initial=args.includes("--notify-initial");
  const write=args.includes("--write");
  const result=produce({dist,origin,previous,publishedAt,key,base,initial,write});
  const save=flag(args,"save","");
  if(save)writeJson(save,result.manifest);
  process.stdout.write(JSON.stringify({written:write,...result.manifest.counts,payloadReady:!!result.payload},null,2)+"\n");
};
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
