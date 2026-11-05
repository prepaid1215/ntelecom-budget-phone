import { sitemapXml } from "../lib/sitemap.js";

export async function GET(){
  return new Response(sitemapXml(),{headers:{"Content-Type":"application/xml; charset=utf-8"}});
}
