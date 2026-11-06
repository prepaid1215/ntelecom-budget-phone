import pages from "../data/generated-pages.json";
import { siteConfig as site, toSiteUrl } from "./site-config.js";
import { experimentSitemapEntries } from "./seo-experiments/registry.js";

const priorityOf=page=>page.pageType==="home" ? "1.0" : ({P0:"0.9",P1:"0.7",P2:"0.5"}[page.priority] || "0.5");

export const escapeXml=value=>String(value).replace(/[<>&'"]/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[char]));

// Publish one flat sitemap: every indexable page is listed directly in sitemap.xml.
// lastmod is omitted because the data-check date is not the page's modification date.
export const sitemapXml=()=>{
  const indexablePages=site.productionReady
    ? [
        ...pages.filter(page=>page.effectiveIndex==="index"),
        {path:"/선불폰/",pageType:"hub",priority:"P0"},
        {path:"/알뜰폰/",pageType:"hub",priority:"P0"},
        {path:"/guide/kt/",pageType:"guide",priority:"P1"},
        {path:"/guide/lg/",pageType:"guide",priority:"P1"},
        {path:"/faq/",pageType:"faq",priority:"P1"}
      ]
    : [];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    +indexablePages.map(page=>"<url><loc>"+escapeXml(toSiteUrl(page.path))+"</loc><priority>"+priorityOf(page)+"</priority></url>").join("")
    // Experiments A/B/C: only pages whose gate made them index candidates, appended after existing entries.
    +experimentSitemapEntries().map(entry=>"<url><loc>"+escapeXml(entry.loc)+"</loc><priority>0.5</priority></url>").join("")
    +"</urlset>\n";
};
