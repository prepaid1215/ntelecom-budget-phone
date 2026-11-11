import rawSite from "../data/site.json";

const envBoolean=(value,fallback)=>{
  if(value==="true") return true;
  if(value==="false") return false;
  return fallback;
};

// The published Cloudflare Pages main branch is the verified production site.
// Its static HTML must not inherit an accidental staging noindex flag.
const cloudflareMainSite=env=>env.CF_PAGES==="1" && env.CF_PAGES_BRANCH==="main";

const normalizeSiteOrigin=value=>{
  const url=new URL(value);
  url.pathname="/";
  url.search="";
  url.hash="";
  return url.toString();
};

const normalizeBasePath=value=>{
  const cleaned=String(value || "/").trim().replace(/^\/+|\/+$/g,"");
  return cleaned ? "/"+cleaned : "/";
};

export const siteOrigin=normalizeSiteOrigin(process.env.SITE_URL?.trim() || rawSite.siteUrl);
export const basePath=normalizeBasePath(process.env.BASE_PATH);

export const toPublicPath=value=>{
  if(!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
  const pathname=value.startsWith("/") ? value : "/"+value;
  return basePath==="/" ? pathname : basePath+pathname;
};

export const toSiteUrl=value=>new URL(toPublicPath(value),siteOrigin).toString();

const withSlot=(base,slot)=>{
  try{
    const url=new URL(base);
    if(slot && !url.searchParams.has("from")) url.searchParams.set("from","antelcom_"+slot);
    return url.toString();
  }catch{ return base; }
};

export const siteConfig={
  ...rawSite,
  siteUrl:toSiteUrl("/"),
  siteOrigin,
  basePath,
  activationUrl:process.env.ACTIVATION_URL?.trim() || rawSite.activationUrl,
  productionReady:cloudflareMainSite(process.env) || envBoolean(process.env.PRODUCTION_READY,rawSite.productionReady)
};

// On-site conversion funnel; provider URLs are selected on /start/.
export const activationLink=(slot,context={})=>{
  const query=new URLSearchParams();
  if(slot)query.set("from",/^exp_[abc]_[a-z0-9_]+$/.test(slot)?slot:"antelcom_"+slot);
  const net=String(context.network||"").toLowerCase();
  if(["k","kt","l","lg"].includes(net))query.set("net",net==="k"?"kt":net==="l"?"lg":net);
  const plan=String(context.plan||"");
  if(/^[a-z0-9-]{1,90}$/.test(plan))query.set("plan",plan);
  const name=String(context.planName||"").slice(0,80);
  if(name)query.set("plan_name",name);
  return toPublicPath("/start/")+(query.size?"?"+query.toString():"");
};
export const activationOutboundLink=slot=>withSlot(siteConfig.activationUrl,slot);
