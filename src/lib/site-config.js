import rawSite from "../data/site.json";

const envBoolean=(value,fallback)=>{
  if(value==="true") return true;
  if(value==="false") return false;
  return fallback;
};

const normalizeSiteUrl=value=>{
  const url=new URL(value);
  url.pathname="/";
  url.search="";
  url.hash="";
  return url.toString();
};

export const siteConfig={
  ...rawSite,
  siteUrl:normalizeSiteUrl(process.env.SITE_URL?.trim() || rawSite.siteUrl),
  activationUrl:process.env.ACTIVATION_URL?.trim() || rawSite.activationUrl,
  productionReady:envBoolean(process.env.PRODUCTION_READY,rawSite.productionReady)
};
