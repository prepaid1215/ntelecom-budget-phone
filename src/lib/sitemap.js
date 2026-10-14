import pages from "../data/generated-pages.json";
import { siteConfig as site, toSiteUrl } from "./site-config.js";

// Child sitemaps by page role. Every group stays far below the 1,500-URL budget.
export const sitemapGroups={
  core:["home","hub","card-hub","benefit-hub","guide-hub","compare-hub"],
  plans:["plan"],
  segments:["tag","combo"],
  benefits:["benefit","card","compare"],
  guides:["guide"]
};

const priorityOf=page=>page.pageType==="home" ? "1.0" : ({P0:"0.9",P1:"0.7",P2:"0.5"}[page.priority] || "0.5");

export const escapeXml=value=>String(value).replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]));

// Only pages that are indexable in production belong in a sitemap; before launch every group is empty.
export const groupPages=group=>site.productionReady
  ? pages.filter(page=>page.effectiveIndex==="index" && sitemapGroups[group].includes(page.pageType))
  : [];

export const urlsetXml=group=>'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  +groupPages(group).map(page=>"<url><loc>"+escapeXml(toSiteUrl(page.path))+"</loc><lastmod>"+site.dataCheckedAt+"</lastmod><priority>"+priorityOf(page)+"</priority></url>").join("")
  +"</urlset>\n";

export const indexXml=()=>{
  const groups=Object.keys(sitemapGroups).filter(group=>groupPages(group).length);
  if(!groups.length) return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    +groups.map(group=>"<sitemap><loc>"+escapeXml(toSiteUrl("/sitemap-"+group+".xml"))+"</loc><lastmod>"+site.dataCheckedAt+"</lastmod></sitemap>").join("")
    +"</sitemapindex>\n";
};
