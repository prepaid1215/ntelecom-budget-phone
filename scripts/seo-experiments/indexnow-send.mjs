#!/usr/bin/env node
// Explicit operator-run IndexNow notification, never called by CI, build, or push.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const arg=(k,def="")=>process.argv.find(x=>x.startsWith("--"+k+"="))?.split("=").slice(1).join("=")||def;
const run=async()=>{
  if(!process.argv.includes("--send")||process.env.INDEXNOW_ALLOW_SEND!=="yes")throw Error("Requires --send and INDEXNOW_ALLOW_SEND=yes");
  const filename=arg("payload","dist/indexnow-new.json");
  const body=JSON.parse(fs.readFileSync(filename,"utf8"));
  const origin="https://xn--h49a29twjdmms77a5sofgdjwa.shop";
  if(!body.key||!Array.isArray(body.urlList)||body.urlList.length===0)throw Error("No approved URLs to notify");
  if(body.host!==new URL(origin).host||body.keyLocation!==origin+"/"+body.key+".txt")throw Error("Wrong domain/key location");
  if(body.urlList.some(s=>new URL(s).origin!==origin))throw Error("Foreign URL in notification");
  const keyCheck=await fetch(body.keyLocation,{redirect:"error"});
  if(!keyCheck.ok|| (await keyCheck.text()).trim()!==body.key)throw Error("Published IndexNow key file does not match");
  for(let i=0;i<body.urlList.length;i+=1000){
    const urlList=body.urlList.slice(i,i+1000);
    const response=await fetch("https://searchadvisor.naver.com/indexnow",{
      method:"POST",headers:{"content-type":"application/json; charset=utf-8"},
      body:JSON.stringify({...body,urlList})
    });
    process.stdout.write(JSON.stringify({batch:Math.floor(i/1000)+1,count:urlList.length,status:response.status,accepted:[200,202].includes(response.status),submittedAt:new Date().toISOString()})+"\n");
    if(![200,202].includes(response.status))process.exitCode=1;
  }
};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(err=>{console.error(err.message);process.exitCode=1;});
