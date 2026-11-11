import test from "node:test";
import assert from "node:assert/strict";
import {planUpdates} from "./naver-indexnow-live.mjs";
const origin="https://xn--h49a29twjdmms77a5sofgdjwa.shop";
const sha="a".repeat(64);
const xml='<urlset><url><loc>'+origin+'/new/</loc></url><url><loc>'+origin+'/existing/</loc></url></urlset>';
test("never backfills undated baseline pages or removed/noindex URLs",()=>{
 const ledger={schemaVersion:1,initialized:true,entries:{
  "/old/":{hash:sha,lastmod:null},
  "/deleted/":{hash:sha,lastmod:"2026-11-11"},
  "/new/":{hash:sha,lastmod:"2026-11-11"}
 }};
 const sent={schemaVersion:1,entries:{}};
 const plan=planUpdates({ledger,sent,sitemap:xml});
 assert.deepEqual(plan.map(x=>x.route),["/new/"]);
});
test("already accepted fingerprint is not sent again",()=>{
 const ledger={schemaVersion:1,initialized:true,entries:{"/new/":{hash:sha,lastmod:"2026-11-11"}}};
 const sent={schemaVersion:1,entries:{"/new/":{hash:sha,lastmod:"2026-11-11"}}};
 assert.equal(planUpdates({ledger,sent,sitemap:xml}).length,0);
});
test("bulk submissions are capped at safe incremental batches",()=>{
 const entries={},urls=[];
 for(let i=0;i<80;i++){const route="/p"+i+"/";entries[route]={hash:sha,lastmod:"2026-11-11"};urls.push("<url><loc>"+origin+route+"</loc></url>")}
 const result=planUpdates({ledger:{schemaVersion:1,initialized:true,entries},sent:{schemaVersion:1,entries:{}},sitemap:"<urlset>"+urls.join("")+"</urlset>"});
 assert.equal(result.length,40);
});
