import pages from "../data/generated-pages.json";
import { siteConfig as site } from "../lib/site-config.js";

const escapeXml=value=>String(value).replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]));

export async function GET(){
  const urls=site.productionReady
    ? pages
      .filter(p=>p.effectiveIndex==="index")
      .map(p=>`<url><loc>${escapeXml(new URL(p.path,site.siteUrl))}</loc><lastmod>${site.dataCheckedAt}</lastmod></url>`)
      .join("")
    : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`,{headers:{"Content-Type":"application/xml; charset=utf-8"}});
}
