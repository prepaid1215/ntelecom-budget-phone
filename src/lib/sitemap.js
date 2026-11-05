import pages from "../data/generated-pages.json";
import { siteConfig as site, toSiteUrl } from "./site-config.js";

const priorityOf=page=>page.pageType==="home" ? "1.0" : ({P0:"0.9",P1:"0.7",P2:"0.5"}[page.priority] || "0.5");

export const escapeXml=value=>String(value).replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]));

// Publish one flat sitemap: every indexable page is listed directly in sitemap.xml.
// lastmod is omitted because the data-check date is not the page's modification date.
export const sitemapXml=()=>{
  const indexablePages=site.productionReady ? pages.filter(page=>page.effectiveIndex==="index") : [];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    +indexablePages.map(page=>"<url><loc>"+escapeXml(toSiteUrl(page.path))+"</loc><priority>"+priorityOf(page)+"</priority></url>").join("")
    +"</urlset>\n";
};
