// Minimal static server for dist/ that behaves like GitHub Pages for directory URLs:
// percent-decodes the path, serves <path>/index.html, returns 404.html with status 404 otherwise.
//   node scripts/seo-experiments/serve.mjs [--port=4399] [--dir=dist]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" };

export const startServer = ({ dir = "dist", port = 0 } = {}) => new Promise(resolve => {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end("bad request"); }
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      return res.end(fs.existsSync(path.join(root, "404.html")) ? fs.readFileSync(path.join(root, "404.html")) : "not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=")[1];
  const { origin } = await startServer({ dir: arg("dir") || "dist", port: Number(arg("port") || 4399) });
  console.log("serving " + origin);
}
