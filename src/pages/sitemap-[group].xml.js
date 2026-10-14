import { sitemapGroups, urlsetXml } from "../lib/sitemap.js";

export function getStaticPaths(){
  return Object.keys(sitemapGroups).map(group=>({params:{group}}));
}

export async function GET({ params }){
  return new Response(urlsetXml(params.group),{headers:{"Content-Type":"application/xml; charset=utf-8"}});
}
