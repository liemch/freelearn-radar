# M27 — Production-like performance runbook

Use after a **preview/staging** URL exists. Do **not** deploy from this milestone.

## Environment marks

| Environment | When to use |
|---|---|
| `PREVIEW` | Vercel preview with Neon |
| `LOCAL_PROD` | `npm run build && npm run start` on localhost |
| `FIELD` | Real user RUM (not set up in M27) |
| `NOT_AVAILABLE` | Credentials / URL missing |

## Commands (operator)

```bash
# 1) Production build locally
npm run build
npm run start
# APP on http://localhost:3000

# 2) Warm TTFB (PowerShell)
$routes = @('/vi','/vi/search','/vi/mien-phi-hom-nay')
foreach ($r in $routes) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000$r" -UseBasicParsing -TimeoutSec 60
    "$r status=$($resp.StatusCode) ttfb_ms~$($sw.ElapsedMilliseconds)"
  } catch { "$r ERROR $($_.Exception.Message)" }
}

# 3) Lighthouse mobile (install once if needed)
npx lighthouse http://localhost:3000/vi --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --output=json --output-path=./lighthouse-home.json --chrome-flags="--headless"
npx lighthouse http://localhost:3000/vi/search --only-categories=performance --form-factor=mobile --output=json --output-path=./lighthouse-search.json --chrome-flags="--headless"
# Replace /vi/search course path with a real published slug for detail.
```

## Navigation checklist (manual)

1. Homepage → Search — NextTopLoader + catalog skeleton  
2. Search → Course — detail skeleton, CTA visible  
3. Back — no blank full-white flash preferred  
4. Category → Course  
5. Miễn phí hôm nay → Course  

Expect: click feedback &lt;~100ms (progress bar), no giant layout jump from missing aspect-ratio images.

## Acceptance references

- LCP ≤ 2.5s mobile  
- CLS ≤ 0.1  
- Warm TTFB ≤ 500ms when Neon warm  

Record results into `docs/M27_V136_FINAL_REPORT.md` section 12 — never invent numbers.
