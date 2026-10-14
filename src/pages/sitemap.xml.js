import { indexXml } from "../lib/sitemap.js";

export async function GET(){
  return new Response(indexXml(),{headers:{"Content-Type":"application/xml; charset=utf-8"}});
}
