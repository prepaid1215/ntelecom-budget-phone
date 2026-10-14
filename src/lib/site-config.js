import rawSite from "../data/site.json";

const envBoolean=(value,fallback)=>{
  if(value==="true") return true;
  if(value==="false") return false;
  return fallback;
};

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
    if(slot && !url.searchParams.has("from")) url.searchParams.set("from","59man_budget_"+slot);
    return url.toString();
  }catch{ return base; }
};

export const siteConfig={
  ...rawSite,
  siteUrl:toSiteUrl("/"),
  siteOrigin,
  basePath,
  activationUrl:process.env.ACTIVATION_URL?.trim() || rawSite.activationUrl,
  productionReady:envBoolean(process.env.PRODUCTION_READY,rawSite.productionReady)
};

export const activationLink=slot=>withSlot(siteConfig.activationUrl,slot);
