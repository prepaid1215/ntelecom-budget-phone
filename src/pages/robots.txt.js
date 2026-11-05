import { siteConfig as site, toSiteUrl } from "../lib/site-config.js";

export async function GET(){
  const lines=site.productionReady
    ? ["User-agent: *","Allow: /","","Sitemap: "+toSiteUrl("/sitemap.xml")]
    : ["User-agent: *","Disallow: /"];
  return new Response(lines.join("\n")+"\n",{headers:{"Content-Type":"text/plain; charset=utf-8"}});
}
