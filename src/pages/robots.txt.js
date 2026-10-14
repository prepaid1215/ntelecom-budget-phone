import site from "../data/site.json";

export async function GET(){
  const lines=["User-agent: *","Allow: /","Disallow: /lp/"];
  if(site.productionReady) lines.push("",`Sitemap: ${new URL("/sitemap.xml",site.siteUrl)}`);
  return new Response(`${lines.join("\n")}\n`,{headers:{"Content-Type":"text/plain; charset=utf-8"}});
}
