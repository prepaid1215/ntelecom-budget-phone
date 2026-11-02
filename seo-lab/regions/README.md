# Regional page data and review pipeline

`administrative-areas.json` is a snapshot of 3,559 Korean administrative-area records across 256 city/county/district units. Its source snapshot and URL lock generate URL candidates; the number of generated files is not an index count. The checked-in `coverage-manifest.json` records the expected code/name set for that exact source version, so CI catches missing or unexpected regions.

The 2026-10-01 source contains 16 current metropolitan-level regions and includes Sejong (code `36`). The former list of 17 counted Gwangju and Jeollanam-do separately. The [special act](https://www.law.go.kr/LSW/lsRvsDocListP.do?chrClsCd=010202&lsId=015064&lsRvsGubun=all) took effect on 2026-07-01 and merged them into Jeonnam-Gwangju Special Metropolitan City, as the [Ministry of the Interior and Safety](https://mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=126845) describes. The coverage manifest checks the post-merger source names and codes, including Sejong; it does not mistake the merger for a missing region.

## Commands

```bash
pnpm run regions:import -- /path/to/HangJeongDong_ver20261001.geojson
pnpm run regions:generate
pnpm run regions:audit
pnpm run regions:quality-test
pnpm run regions:pipeline-test
pnpm run regions:sources-test
pnpm run regions:content-preview
```

Review a source update before changing paths. `regions:import` only refreshes the normalized source; the version is read from the filename or can be provided using `--version=YYYYMMDD`. After comparing the new coverage against official code/name sources, update `coverage-manifest.json`; after reviewing names, codes, and proposed URL changes, explicitly run:

```bash
pnpm run regions:sync-url-lock -- /path/to/HangJeongDong_ver20261001.geojson
```

The URL lock keeps a code-derived suffix in each slug to prevent same-name collisions and path drift. Retired code mappings stay reserved. A renamed area requires review before its locked path changes.

## Evidence gate

`status: "verified"` and a plausible URL do not authenticate a claim. Each evidence item must identify a source snapshot, a JSON pointer into that pinned file, the exact extracted value, the review date, and (for local information) a second pointer proving that the source row belongs to the exact 10-digit area code. `regional-source-verifier.mjs` checks the source file SHA-256 against `source-snapshots.json`, checks the exact URL and host allowlist, resolves the pointers, compares the claim value, and rejects a changed or stale snapshot. Arbitrary `fact` prose is never rendered as evidence; the page renderer uses only recognized fact types and values resolved from the source file.

Administrative name/code facts are verified for URL accuracy, but they are explicitly not considered useful local information and cannot make a page index eligible. A local source snapshot must declare a consumer-useful fact type before a regional page can pass. The current source manifest contains no such local records, so the current regional candidate count is correctly zero. Product examples are built from the operator-supplied catalogs and linked to their source URLs; the examples are separate nationwide intent demonstrations, not region pages and not publishable content.

`regional-content-engine.mjs` has separate generated structures for prepaid plan/advance-payment comparison and MVNO monthly fee/data comparison. Its review output is written to `seo-lab-regional-content-preview/`. `regions:pipeline-test` checks the two data-backed examples, checks that no region is approved on administrative identity alone, and imports one temporary IndexFlow observation to prove a rebuild preserves it. The temporary event is restored away after the test.

Content overlap is checked after region names and service type words are normalized. The detector retrieves likely pairs with SimHash locality-sensitive hashing, then calculates exact character-trigram shared-content ratio relative to the shorter body; pairs above `0.30` are held. This is a measurable duplication screen, not a semantic quality score or a guarantee that search intent has been served. The auditor reports the pair count; human review still checks whether the page answers a distinct question and whether each local fact helps a person in that area.

## Collecting and pinning regional sources

Capture only a source host already reviewed in `source-snapshots.json`:

Run `pnpm run regions:fetch-source -- --id=<stable-source-id> --url=<actual-HTTPS-official-JSON-CSV-or-PDF-URL>` with a reviewed URL from an allowlisted host.

The importer records the response and SHA-256 under `source-cache/`, but prints `captured_not_verified`. Inspect the snapshot, add its exact hash, source URL, check date, and supported fact types to `source-snapshots.json`, then point evidence to exact fields in the snapshot. Capturing a page does not by itself verify a store, opening hours, inventory, coverage, or service promise. PDF sources need a reviewed structured extraction before a claim can use a JSON pointer.

## Durable IndexFlow observations

`index-flow-observations.json` is the durable event ledger. Generated `index-flow.json` starts with unobserved states, then overlays the latest dated event for each URL and event type. Rebuilding preview HTML never clears the ledger. To import a Search Console or crawl export, create an input JSON with an `events` array and run:

```bash
pnpm run regions:record-observation -- --input=/path/to/index-flow-events.json
```

The importer checks each URL against the generated registry, requires an observation timestamp and HTTPS source, validates status values and performance ranges, and deduplicates identical events. Keep Search Console submissions, crawler observations, Google index checks, and performance values as separate event types. Before measurement exists, indexed counts and impressions remain `null`, not zero.

Candidate status does not publish or index a page. All regional output is generated under the ignored `seo-lab-regions-preview/` directory, carries `noindex,follow`, and is disconnected from Astro routes, the public sitemap, robots, DNS, and deployment settings. National product examples are in a separate ignored preview directory and are also `noindex`. `preview-candidate-sitemap.xml` is for offline QA only and must not be submitted. `editorial-index-candidates-sitemap.xml` lists evidence-qualified editorial candidates only. Search submission, crawl, Google index state, impressions, and clicks remain separately unobserved until real records are imported.

## Source attribution

The normalized records were derived from [vuski/admdongkor](https://github.com/vuski/admdongkor), snapshot `ver20261001`, based on administrative boundaries opened by Statistics Korea SGIS under KOGL Type 1 and distributed under CC BY 4.0:

> 본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.

Source snapshot SHA-256: `843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605`.
