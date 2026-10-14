const port=process.env.CHROME_DEBUG_PORT||"9222";
const base=process.env.QA_BASE_URL||"http://127.0.0.1:4321";
const targets=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
const socketUrl=targets.find(t=>t.type==="page")?.webSocketDebuggerUrl;
if(!socketUrl) throw new Error("Chrome debugging page target not found");

const ws=new WebSocket(socketUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let id=0;
const pending=new Map();
const events=new Map();
ws.onmessage=({data})=>{
  const message=JSON.parse(data);
  if(message.id&&pending.has(message.id)){
    const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
    message.error?reject(new Error(message.error.message)):resolve(message.result);
  }
  const listeners=events.get(message.method)||[];
  for(const resolve of listeners.splice(0)) resolve(message.params);
};
const send=(method,params={})=>new Promise((resolve,reject)=>{const callId=++id;pending.set(callId,{resolve,reject});ws.send(JSON.stringify({id:callId,method,params}))});
const once=method=>new Promise(resolve=>{const listeners=events.get(method)||[];listeners.push(resolve);events.set(method,listeners)});
await send("Page.enable");
await send("Runtime.enable");

const paths=[
  "/","/plans/","/plans/k/","/plans/l/","/plans/15gb/","/plans/price/under-30000/",
  "/no-contract/","/number-transfer/","/self-phone/","/card/","/card/kt-my-alttle-bc-baro/",
  "/card/uplus-partners-samsung/","/benefits/","/benefits/coupang-cash/","/benefits/naverpay/",
  "/benefits/daiso/","/benefits/millie/","/benefits/oliveyoung/","/benefits/cu/","/plans/k/item/7gb-coupang-cash/",
  "/plans/k/item/100gb-coupang-cash/","/plans/l/item/100min-15gb/","/plans/l/item/daily5gb/",
  "/lp/k/7gb-coupang-cash/price/","/lp/k/7gb-coupang-cash/number-transfer/","/lp/k/7gb-coupang-cash/card/"
];
const viewports=[[360,800],[375,812],[390,844],[430,932]];
const results=[];
const expression=`(()=>{
  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0};
  const rect=e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
  const bottom=document.querySelector(".bottom");
  const touch=[...document.querySelectorAll(".btn-primary,.btn-secondary,.card-actions>*,.bottom button,.bottom a,.header-cta")].filter(visible).map(rect);
  const text=[...document.querySelectorAll("h1,h2,.plan-name,.plan-price,.card-zone")].filter(visible);
  const cards=[...document.querySelectorAll(".card,.card-zone")].filter(visible);
  return {
    path:location.pathname,
    bodyOverflow:document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth,
    cardOverflow:cards.some(e=>e.scrollWidth>e.clientWidth+1),
    clippedText:text.some(e=>e.scrollWidth>e.clientWidth+1),
    minTouch:touch.length?Math.min(...touch.map(r=>r.h)):0,
    sticky:visible(bottom)&&getComputedStyle(bottom).position==="fixed"&&Math.abs(rect(bottom).bottom-innerHeight)<2,
    h1:parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
    h2:parseFloat(getComputedStyle(document.querySelector("h2")).fontSize),
    planColumns:document.querySelector(".grid.cols-3")?getComputedStyle(document.querySelector(".grid.cols-3")).gridTemplateColumns.split(" ").length:1,
    robots:document.querySelector('meta[name="robots"]')?.content,
    faq:document.querySelectorAll(".faq").length,
    related:document.querySelectorAll(".link-list a").length
  };
})()`;

for(const [width,height] of viewports){
  await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});
  for(const path of paths){
    const loaded=once("Page.loadEventFired");
    await send("Page.navigate",{url:base+path});await loaded;
    const value=await send("Runtime.evaluate",{expression,returnByValue:true});
    results.push({width,height,...value.result.value});
  }
}
for(const width of [768,1024,1440]){
  await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
  const loaded=once("Page.loadEventFired");await send("Page.navigate",{url:base+"/"});await loaded;
  const value=await send("Runtime.evaluate",{expression,returnByValue:true});results.push({width,height:900,...value.result.value});
}
ws.close();
const mobile=results.filter(r=>r.width<768);
const failures=mobile.filter(r=>r.bodyOverflow||r.cardOverflow||r.clippedText||r.minTouch<44||!r.sticky||r.h1<30||r.h1>40||r.h2<24||r.h2>30||r.planColumns!==1||r.robots!=="noindex,follow");
console.log(JSON.stringify({tested:results.length,mobilePages:mobile.length,widths:[...new Set(results.map(r=>r.width))],failures},null,2));
if(failures.length) process.exit(1);
