# Last Call

A session-based group ledger for nights out. Presence-based bill splitting,
live across everyone in the group, netting to a "who pays who" tab at Last
Call.

One app, no build step, no framework — vanilla HTML/CSS/JS with native ES
modules, backed by Supabase (Postgres + Auth + Realtime).

See **KNOWLEDGE.md** for architecture, schema, and the history of decisions
and bugs behind the current code. See **CHANGELOG.md** for what's changed
release to release.

## File structure

```
index.html          shell markup only — no inline CSS or JS
styles.css           full stylesheet
manifest.json        PWA manifest — name, icons, standalone display
icons/               real app logo exported as favicon/apple-touch-icon/
                     manifest icons (icon.svg + PNGs at 16/32/180/192/512px)
js/
  config.js          Supabase client + constants (URL, publishable key, dust threshold, playful-summaries flag)
  utils.js           pure formatting/sharing helpers — no app state, safe to import anywhere
  brand.js           logo mark + wordmark: brandBlock() (with tagline, for the
                     landing overlay and info guide), headerBrand() (compact,
                     no tagline, for the persistent header, wraps the page's
                     one <h1>), and compactMark() (bare mark only, for the
                     scroll-reminder bar)
  qr.js               QR-code rendering — the app's one point of contact with the qrcode dependency
  app.js              state, auth/boot, rendering, sheets, realtime sync — the stateful "core"
```

`app.js` is intentionally still one file. Splitting it further would mean
either converting `me`/`night`/`members`/`stops`/`expenses`/`balances`/`plan`/
`draft` from plain module-level `let`s into a shared store object (so other
modules could safely mutate them — ES modules can't reassign an imported
binding from outside its own module) or accepting circular imports between
render/sheet/boot code that all call each other. Both are real, doable
follow-ups — just a separate, carefully-tested pass rather than folded into
this one. See KNOWLEDGE.md for the fuller version of this tradeoff.

## Running locally

The app uses native `import ... from './...'` module syntax, which browsers
block under `file://`. Serve it instead:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed `localhost` URL. Double-clicking `index.html` will
load styling but the app itself won't boot (no Supabase connection).

## Icons / PWA

`icons/icon.svg` is generated directly from the same SVG markup used by
`js/brand.js`'s logo mark (ink background added, centered, scaled up) — not
a separately hand-drawn asset, so the two can't visually drift apart. The
PNGs were rendered from it via `cairosvg`. If the logo design changes,
regenerate both from the updated markup rather than editing the PNGs by
hand.

## Deploying

Deployed to Netlify — no build command, publish directory is the repo root.
See KNOWLEDGE.md for the specific org/project and a note on a lookalike
project on the same account that this one is *not*.

## Backend

Supabase project `last-call`. See KNOWLEDGE.md for schema, RPCs, and the
architectural decisions (derived balances, anonymous auth, settlement
snapshots, etc.) that shape how the code is written.

One Storage bucket, `receipts` (public, 10MB cap), for attached receipt
photos. See KNOWLEDGE.md for the access-control tradeoff that comes with
"public."
