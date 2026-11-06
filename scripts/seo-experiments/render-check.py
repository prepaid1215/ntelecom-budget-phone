"""Chromium rendering check of built pages (requires Python Playwright + a Chromium build).
   python3 scripts/seo-experiments/render-check.py [--screenshots=DIR]
Starts scripts/seo-experiments/serve.mjs, renders A/C pages, sampled B and existing pages at
390px (mobile) and 1280px, and fails on console errors, failed same-origin requests, missing/extra
H1, robots/canonical mismatch with the HTML, or horizontal overflow."""
import json, subprocess, sys, time, os, urllib.parse
from playwright.sync_api import sync_playwright

PORT = 4399
shots = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--screenshots=")), None)
registry = json.loads(subprocess.check_output(["node", "-e",
  "import('./src/lib/seo-experiments/registry.js').then(m=>{const r=m.buildExperimentRegistry();"
  "const b=r.pages.filter(p=>p.experiment==='B');const pick=k=>b.find(p=>p.kind===k);"
  "console.log(JSON.stringify([...r.pages.filter(p=>p.experiment!=='B'),pick('root'),pick('sido'),pick('sgg'),pick('emd'),b[b.length-1]].filter(Boolean).map(p=>({path:p.path,title:p.title,exp:p.experiment}))))})"]))
pages = registry + [{"path": p, "title": None, "exp": "existing"} for p in ["/", "/선불폰/", "/알뜰폰/", "/guide/", "/plans/k/item/7gb-naverpay/", "/lp/k/100min-15gb-daiso/price/"]]
server = subprocess.Popen(["node", "scripts/seo-experiments/serve.mjs", f"--port={PORT}"], stdout=subprocess.PIPE)
server.stdout.readline()
origin = f"http://127.0.0.1:{PORT}"
failures, results = [], []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width, label in [(390, "mobile"), (1280, "desktop")]:
            ctx = browser.new_context(viewport={"width": width, "height": 900}, locale="ko-KR")
            for page_info in pages:
                page = ctx.new_page()
                errors, bad = [], []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.url.startswith(origin) and r.status >= 400 else None)
                url = origin + urllib.parse.quote(page_info["path"])
                resp = page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(300)
                info = page.evaluate("""() => ({
                  title: document.title,
                  h1: [...document.querySelectorAll('h1')].filter(h => h.offsetParent !== null).length,
                  h1All: document.querySelectorAll('h1').length,
                  robots: document.querySelector('meta[name=robots]')?.content,
                  canonical: document.querySelector('link[rel=canonical]')?.href,
                  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                  textLength: (document.querySelector('main')?.innerText || '').length,
                  brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length
                })""")
                problems = []
                if resp.status != 200: problems.append(f"status {resp.status}")
                if page_info["title"] and info["title"] != page_info["title"]: problems.append("title")
                if info["h1All"] != 1 or info["h1"] != 1: problems.append(f"h1 visible={info['h1']} total={info['h1All']}")
                if not info["canonical"]: problems.append("no canonical")
                if info["overflow"] > 1: problems.append(f"horizontal overflow {info['overflow']}px")
                if info["textLength"] < 100: problems.append("main text under 100 chars")
                if info["brokenImages"]: problems.append(f"{info['brokenImages']} broken images")
                if errors: problems.append("console: " + "; ".join(errors[:2]))
                if bad: problems.append("failed requests: " + "; ".join(bad[:2]))
                results.append({"viewport": label, "path": page_info["path"], "experiment": page_info["exp"], **info, "problems": problems})
                if problems: failures.append(f"[{label}] {page_info['path']}: {', '.join(problems)}")
                if shots and label == "mobile" and page_info["exp"] in ("A", "C") and page_info["path"].count("/") <= 3 and page_info["path"] in (registry[0]["path"], "/indexkit/"):
                    os.makedirs(shots, exist_ok=True)
                    page.screenshot(path=os.path.join(shots, ("render-" + page_info["exp"] + ".png")), full_page=True)
                page.close()
            ctx.close()
        browser.close()
finally:
    server.terminate()
os.makedirs("reports/seo-experiments", exist_ok=True)
json.dump({"pages": len(pages), "renders": len(results), "failures": failures, "results": results}, open("reports/seo-experiments/render-check.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({"pages": len(pages), "renders": len(results), "failures": failures}, ensure_ascii=False, indent=1))
sys.exit(1 if failures else 0)
