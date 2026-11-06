# Baseline of the pre-experiment build (commit 876d8c8)

Built with `SITE_URL=https://xn--h49a29twjdmms77a5sofgdjwa.shop BASE_PATH=/ PRODUCTION_READY=true pnpm run build` on 2026-11-03.

- `existing-503-html.sha256`: SHA-256 of all 503 HTML files (500 generated pages + /선불폰/ + /알뜰폰/ + 404). Paths are relative to `dist/`.
- `audit-existing-500-*.json`: output of `scripts/audit-existing-500.mjs` (0 errors, 203 pre-existing `h1-duplicate` warnings on /lp/ pages).
- `sitemap.xml` (140 URLs) and `robots.txt` from that build.

The hashes depend on build date (promotion expiry is evaluated at build time) and on the env above.
`scripts/seo-experiments/compare-baseline.mjs` reports date-driven drift separately from experiment-caused changes.
