import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { produce } from "./indexnow-pipeline.mjs";
const origin="https://xn--h49a29twjdmms77a5sofgdjwa.shop";
const fixture=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"seo-indexnow-")),dist=path.join(root,"dist");
  fs.mkdirSync(path.join(dist,"example"),{recursive:true});
  fs.writeFileSync(path.join(dist,"example","index.html"),'<html><head><link rel="canonical" href="'+origin+'/example/"><meta name="robots" content="index,follow"></head><body>Example</body></html>');
  fs.writeFileSync(path.join(dist,"sitemap.xml"),'<?xml version="1.0"?><urlset><url><loc>'+origin+'/example/</loc></url></urlset>');
  return {dist,root};
};
test("first import does not falsely notify old URLs",()=>{const {dist,root}=fixture();try{const r=produce({dist,origin,write:true});assert.equal(r.manifest.counts.publicSitemapUrls,1);assert.equal(r.manifest.counts.changeNotifications,0);assert.ok(fs.existsSync(path.join(dist,"rss.xml")));}finally{fs.rmSync(root,{recursive:true,force:true})}});
test("known HTML changes produce one notification with real publication date",()=>{
 const {dist,root}=fixture();try{
 const before=produce({dist,origin}).manifest;
 fs.writeFileSync(path.join(dist,"example/index.html"),fs.readFileSync(path.join(dist,"example/index.html"),"utf8").replace("Example","Changed"));
 const r=produce({dist,origin,previous:before,publishedAt:"2026-11-04",key:"abcdef0123456789",write:true});
 assert.equal(r.manifest.counts.changeNotifications,1);assert.ok(r.rewritten.includes("<lastmod>2026-11-04</lastmod>"));
 assert.equal(r.payload.urlList.length,1);assert.equal(fs.readFileSync(path.join(dist,"abcdef0123456789.txt"),"utf8").trim(),"abcdef0123456789");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test("noindex and foreign URLs rejected",()=>{const {dist,root}=fixture();try{
 const file=path.join(dist,"example/index.html");fs.writeFileSync(file,fs.readFileSync(file,"utf8").replace("index,follow","noindex,follow"));
 assert.throws(()=>produce({dist,origin}),/noindex/);
 fs.writeFileSync(path.join(dist,"sitemap.xml"),'<urlset><url><loc>https://example.com/example/</loc></url></urlset>');
 assert.throws(()=>produce({dist,origin}),/foreign origin/);
}finally{fs.rmSync(root,{recursive:true,force:true})}});
