# A/B image integration — 2026-11-04

PR #3 remains a draft. This change does not merge or deploy it.

## Placement

| A candidate | Hero | Supporting image |
| --- | --- | --- |
| kt-barousim-prepaid | Existing KT 바로유심 product photo | Existing number-position illustration |
| lg-onechip-prepaid | Existing LG 모두의 원칩 product photo | Existing number-position illustration |
| onechip-modelcode-entry | Existing number-position illustration | — |
| naverpay-7gb-mvno | Existing KT 바로유심 product photo | Existing number-position illustration |
| daiso-usim | Existing LG 모두의 원칩 product photo, explicitly labelled as 원칩 | — |
| kt-barousim-number-entry | Existing number-position illustration | — |

These are nine image placements across six A candidates, using three existing product/number assets. The generated lifestyle image remains available for B common guidance. No fictional packaging or activation screen was generated. The existing number guide is labelled as an illustration; readers use the numbers on their own SIM.

The shared B template adds the two existing product photos to prepaid common guidance, and the AI lifestyle photo to MVNO common guidance. This is national guidance, not evidence of a local shop or customer. Region evidence/index gates are unchanged.

## Rendering and loading

Desktop A hero: two columns. At 760px and below: text followed by image. Product packages use `object-fit: contain`; figures have reserved dimensions. Hero images are eager-loaded; supporting and B images are lazy-loaded. Asset URLs use `toPublicPath`, including GitHub Pages subpaths. AI lifestyle scenes are visibly labelled as explanatory images.

## New asset and generation prompt

`public/images/experiments/phone-at-home.webp` (1200 × 800, approximately 71 KB). Created with the built-in image generation tool, then encoded as WebP for the website.

Prompt: “Use case: photorealistic-natural. Asset type: wide editorial lifestyle photograph for Korean mobile phone activation guide website. A Korean adult at a tidy home desk calmly speaking on a modern smartphone, with a second unbranded phone lying face down on desk, soft natural daylight, authentic domestic atmosphere, neutral ivory and pale blue tones, medium close shot of hands and torso with partial face, landscape 3:2 composition. No visible phone screen, no app interface, no text, no logos, no SIM packaging, no watermark. This is an explanatory lifestyle scene, not a real customer testimonial.”

## Validation

- Local production build, SEO audit, existing-page/link audits, baseline warning diff, unit/dist/HTTP tests pass.
- Existing 503 HTML files match the SHA-256 baseline; no new SEO audit findings.
- A candidate count stays six; B candidate count stays zero.
- All A image placements resolve to built assets and declare width/height.
- Local no-ready and GitHub Pages subpath builds and their dist tests pass.
- Local interactive preview is unavailable: preview daemon cannot find `pnpm`. No visual browser review is claimed.
- Local Chromium regression is unavailable: Python `playwright` is missing. The existing GitHub Actions workflow installs Playwright/Chromium and checks 390px/1280px rendering; its result must be checked for the pushed commit.
