import pages from "../data/generated-pages.json";
import postpaidGuides from "../data/a-postpaid-landings.json";
import lastmodLedger from "../data/seo-lastmod.json";
import { siteConfig as site, toSiteUrl } from "./site-config.js";
import { experimentSitemapEntries } from "./seo-experiments/registry.js";

const priorityOf=page=>page.pageType==="home" ? "1.0" : ({P0:"0.9",P1:"0.7",P2:"0.5"}[page.priority] || "0.5");

export const escapeXml=value=>String(value).replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]));

// Publish one flat sitemap: every indexable page is listed directly in sitemap.xml.
// Only verified per-route content revisions have lastmod; unknown dates remain omitted.
const modificationTag=route=>{
 const date=lastmodLedger.entries?.[route]?.lastmod;
 return typeof date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? "<lastmod>"+date+"</lastmod>" : "";
};
export const sitemapXml=()=>{
  const indexablePages=site.productionReady
    ? [
        ...pages.filter(page=>page.effectiveIndex==="index"),
        {path:"/선불폰/",pageType:"hub",priority:"P0"},
        {path:"/알뜰폰/",pageType:"hub",priority:"P0"},
        ...postpaidGuides.filter(page=>page.effectiveIndex==="index"),
        {path:"/guides/",pageType:"hub",priority:"P1"}
      ]
    : [];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    +indexablePages.map(page=>"<url><loc>"+escapeXml(toSiteUrl(page.path))+"</loc>"+modificationTag(page.path)+"<priority>"+priorityOf(page)+"</priority></url>").join("")
    // Experiments A/C: only pages whose gate made them index candidates, appended after existing entries.
    +experimentSitemapEntries().map(entry=>"<url><loc>"+escapeXml(entry.loc)+"</loc>"+modificationTag(entry.path)+"<priority>0.5</priority></url>").join("")
    +"</urlset>\n";
};
