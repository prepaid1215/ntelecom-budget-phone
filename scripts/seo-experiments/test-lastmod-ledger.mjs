import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import {refreshLedger,significantFingerprint} from "./lastmod-ledger.mjs";

const origin="https://xn--h49a29twjdmms77a5sofgdjwa.shop";
const html=(body,route="/example/")=>'<html><head><title>제목</title><meta name="description" content="설명"><link rel="canonical" href="'+origin+route+'"><meta name="robots" content="index,follow"><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><header>공통 메뉴</header><main>'+body+'</main></body></html>';
const fixture=()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sitemap-revision-"));
 const dst=path.join(dir,"dist"),f=path.join(dst,"example","index.html");
 fs.mkdirSync(path.dirname(f),{recursive:true});
 fs.writeFileSync(f,html("<h1>핵심 정보</h1>"));
 fs.writeFileSync(path.join(dst,"sitemap.xml"),'<urlset><url><loc>'+origin+'/example/</loc></url></urlset>');
 return {dir,dst,f};
};
const empty=()=>({schemaVersion:1,initialized:false,entries:{}});
test("first import records actual content but does not invent modification dates",()=>{
 const {dir,dst}=fixture();try{
  const a=refreshLedger({dist:dst,origin,previous:empty(),date:"2026-11-11"});
  assert.equal(a.ledger.entries["/example/"].lastmod,null);
  assert.equal(a.stats.tracked,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test("unchanged or navigation-only changes do not reset lastmod",()=>{
 const {dir,dst,f}=fixture();try{
  const base=refreshLedger({dist:dst,origin,previous:empty(),date:"2026-11-11"}).ledger;
  let a=refreshLedger({dist:dst,origin,previous:base,date:"2026-11-12"});
  assert.equal(a.stats.updated,0);
  fs.writeFileSync(f,html("<h1>핵심 정보</h1>").replace("공통 메뉴","다른 메뉴"));
  a=refreshLedger({dist:dst,origin,previous:base,date:"2026-11-12"});
  assert.equal(a.stats.updated,0);
  fs.writeFileSync(f,html("<h1>변경된 핵심 정보</h1>"));
  a=refreshLedger({dist:dst,origin,previous:base,date:"2026-11-12"});
  assert.equal(a.stats.updated,1);
  assert.equal(a.ledger.entries["/example/"].lastmod,"2026-11-12");
  const later=refreshLedger({dist:dst,origin,previous:a.ledger,date:"2026-11-13"});
  assert.equal(later.ledger.entries["/example/"].lastmod,"2026-11-12");
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test("noindex URL cannot be marked updated",()=>{
 const {dir,dst,f}=fixture();try{
  fs.writeFileSync(f,html("본문").replace("index,follow","noindex,follow"));
  assert.throws(()=>refreshLedger({dist:dst,origin,previous:empty(),date:"2026-11-11"}),/Noindex/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test("outer-shell changes never alter meaningful content fingerprint",()=>{
 assert.equal(significantFingerprint(html("한글 본문")),significantFingerprint(html("한글 본문").replace("공통 메뉴","다른 메뉴")));
});
