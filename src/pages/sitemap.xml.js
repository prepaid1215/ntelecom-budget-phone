import pages from "../data/generated-pages.json";
import site from "../data/site.json";
export async function GET(){
  const urls=site.productionReady
    ? pages.filter(p=>p.effectiveIndex==="index"&&!p.path.startsWith("/lp/")).map(p=>`<url><loc>${new URL(p.path,site.siteUrl)}</loc></url>`).join("")
    : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{"Content-Type":"application/xml"}});
}
