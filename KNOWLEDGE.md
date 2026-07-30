# Last Call — knowledge base

This supersedes the earlier `last-call-handoff.md` (which was written for
pasting into a fresh conversation). This doc is meant to be kept up to date
going forward as part of the "full package" alongside README.md and
CHANGELOG.md.

## What this is

A session-based group ledger for nights out. Presence-based bill splitting,
live across everyone in the group, closing to a netted "who pays who" at
Last Call. Vanilla HTML/CSS/JS, ES modules, no build step. Auth, DB, and
realtime via Supabase.

## File structure

```
index.html          shell markup only
styles.css           full stylesheet
manifest.json        PWA manifest (name, icons, standalone display)
icons/               real logo, exported as favicon/apple-touch-icon/PWA icons
js/
  config.js          Supabase client + constants
  utils.js           pure formatting/sharing helpers (no app state)
  brand.js           logo mark + wordmark — landing overlay, info guide,
                     and a compact header variant (headerBrand())
  qr.js               QR-code rendering, wraps the qrcode dependency
  settlement.js       canonical settlement wording — sign interpretation,
                      currency formatting, zero-state, payment-state copy
  app.js              state, auth/boot, rendering, sheets, realtime sync
```

**Why `app.js` is still one ~1600-line file, deliberately.** Everything in
it shares mutable module-level state (`me`, `night`, `members`, `stops`,
`expenses`, `balances`, `plan`, `draft`, `currentChannel`). Splitting that
further needs one of:
- A shared store object (e.g. `export const S = {...}`) that other modules
  mutate via `S.night = ...` — safe, but touches nearly every function in
  the app to rename bare identifiers to `S.xxx`.
- Circular imports between boot/render/sheet modules, which is workable in
  practice (these are function declarations, called later via events, not
  at module-evaluation time) but easy to get subtly wrong.

Both are real options if `app.js` gets unwieldy, but each is its own
carefully-tested pass, not something to fold into an unrelated feature
change. What's already safely split out: config (constants + Supabase
client), utils (pure formatting/sharing helpers with zero state
dependency), brand (logo/wordmark), and qr (the one point of contact with
the `qrcode` package).

**Local dev / deploy note:** native `import` syntax means `index.html`
can't be opened via `file://` — needs a static server locally, and Netlify
(or any real HTTP host) for anything else. See README.md.

## Backend

- **Org:** `Sheier` (personal Supabase account — kept deliberately separate
  from the person's work org, `IEEE-CF`, which also exists on this
  account's connector. **If the Supabase connector ever shows `IEEE-CF`
  instead of `Sheier`, stop and ask the person to reconnect** — this has
  happened before mid-session.)
- **Project:** `last-call`, ref `rkxmpvkhrchgkqocguwt`, us-east-1.
- **Also on this account:** a separate project `Soltinera` — unrelated,
  don't touch.
- Deployed to Netlify at a URL the person controls; not recorded here since
  it wasn't shared as plain text in any session so far. Ask if it's needed.

## Schema (all real, migrated, tested against live data)

`person` (mirrors `auth.users`, `is_permanent` flag) · `night` (host_id,
join_code, status, `closed_at`) · `night_member` (presence window:
`joined_at`/`left_at`, `is_dry`, `role`) · `stop` · `expense` (kind:
round/food/other, status: pending/confirmed/disputed, `description` —
optional free-text, added via migration, `receipt_url` — now actually
used, see below) · `allocation` (weight-based, supports uneven shares) ·
`settlement` (status: open/marked_paid, `marked_paid_at`)

Key RPCs: `join_night`, `create_night`, `leave_night`, `add_stop`,
`settle_night`, `close_night`, `reopen_night`, `sync_permanence`.

**Scheduled maintenance:** `auto_close_stale_nights(p_days integer default
7)` — a `pg_cron` job (`auto-close-stale-nights`, daily 3am UTC) that
closes any night untouched (no new round/stop/settlement, checked against
`greatest(started_at, created_at, last expense, last stop, last
marked_paid)`) for 7+ days. Runs the same closing steps `close_night`
does, but with no `host_id`/`auth.uid()` check — a cron job has no
session — so `EXECUTE` is revoked from `anon`/`authenticated` and granted
only to `postgres`/`service_role`. Not callable from the client at all.

Derived views: `allocation_share` (per-person cent share, deterministic
penny remainders), `night_balance` (paid/owed/net per person — **never**
cache this, always compute from expenses).

**Storage:** one bucket, `receipts` (public, 10MB file size limit),
created via migration `add_receipts_storage_bucket`. Two policies:
authenticated upload, public read. Objects are pathed
`{night_id}/{random-uuid}.{ext}` — see Architectural decisions for why
public, and the open gap on access control.

## Architectural decisions worth knowing *why*, not just *what*

- **Balances are derived, never stored.** Store immutable facts (expenses,
  allocations); compute everything else on read.
- **Anonymous auth for guests, no account required to join.** Hosting used
  to require a permanent (email-linked) identity — removed partway through
  the original build because it made basic testing depend on email
  delivery/rate limits/redirect URLs that weren't configured yet. Anyone
  can host now; claiming an email is optional, for durability across
  devices, not a gate.
- **Settlement is a snapshot, not a live query, once a night is closed.**
  Recomputing live after close meant if anyone with financial history left
  the night afterward, the ledger could no longer balance and silently
  returned nothing. Closed nights now read the frozen `settlement` table
  rows written at close time (`refreshPlan()` in `app.js` branches on
  `night.status === 'closed'`).
- **`leave_night()` won't delete a membership row if that person has any
  expense/allocation history in the night.** Same root cause as above —
  deleting a load-bearing row breaks everyone else's balance math. If they
  have history, "leaving" is purely client-side navigation (same as
  Switch); nothing is deleted.
- **Dust threshold ($2 default, `DUST_CENTS` in `js/config.js`)** on
  settlement — sub-threshold payments are written off rather than
  collected, shown on the receipt as a footnote, not silently dropped.
- **We never touch money directly.** Venmo deep links / Web Share only.
- **The Tonight-tab round card's tap-to-edit affordance only renders when
  the night is open** (`data-edit` attribute is conditionally included in
  the template based on `isOpen()`). `openEdit()` already refused edits on
  a closed night with a toast; the card no longer *looks* tappable when
  there's nowhere for the tap to go.
- **The undo on "round logged" is real, not simulated.** It calls
  `expense.delete().eq('id', data.id)` — the exact same primitive the Void
  button in the edit sheet already used. No separate "soft delete" or
  client-only revert was invented.
- **"Close the night" on the Crew tab calls the same `confirmLastCall()`
  the fab uses.** No parallel close flow — one function, two entry points.
- **Participation states are limited to what `eligible()` actually checks:
  presence (`left_at`) and the round-only `is_dry` flag.** A richer
  "participation menu" (food only / excluded from next round / left the
  night) was considered and explicitly not built — those aren't
  independently supported by the calc engine, and inventing labels for
  states with no backing logic would misrepresent what toggling them does.
  If any of those become real states later, they need their own schema/
  `eligible()` work first, not just new UI.
- **"Mark received" writes the real `settlement.status`/`marked_paid_at`
  now, not just a client-side Set.** The columns already existed;
  `refreshPlan()` just wasn't passing `id`/`status` through its mapping.
  Fixed by carrying both through in the closed-night branch only.
- **Pay-in-Venmo and Mark-received only render once a night is closed.**
  While running, `plan` comes from the live `settle_night()` preview and
  has no stable row to persist a status against — and encouraging a real
  payment against a total that's still moving is how someone overpays a
  stale preview. This is a deliberate product-safety choice, not a bug.
- **Round entry is total-first, not subtotal-first.** `draft.tipMode`
  (default `false`) gates whether `tipOf()` computes anything: off, the
  typed digits are the whole total and `tip_cents` is stored as 0; on,
  digits are treated as a subtotal and tip is computed from the % chip,
  exactly like the old always-on flow. Switching modes clears the typed
  digits so a number is never silently reinterpreted between "total" and
  "subtotal." `base_cents`/`tip_cents` themselves are untouched — this is
  a UI-flow change, not a schema or calculation change.
- **`expense.description` is escaped at render time; `note`/
  `display_name` are not.** Description is the first genuinely
  open-ended, arbitrary-length field a person types that gets rendered
  into `innerHTML` anywhere in the app — `note` is auto-generated
  ("Round N") and `display_name` is short and UI-constrained. This is a
  targeted fix for the new field, not a retrofit of the existing ones;
  the same latent gap exists for `note`/`display_name` and would need
  its own pass if it becomes a priority.
- **The Crew intro card is a native `<details>/<summary>`, not a custom
  JS toggle.** Free keyboard/screen-reader disclosure semantics. The one
  wrinkle: `renderCrew()` rebuilds `#pane-crew`'s innerHTML on every
  refresh, which would reset `<details>`'s own `open` state on every
  realtime update — so `crewIntroOpen` (module state) is the real source
  of truth, written from the element's `toggle` event and read back into
  the template on each render.
- **The real logo is now the app's icon**, not a placeholder. Generated
  from the exact same inline SVG markup already used in the app (via
  `cairosvg`, not hand-drawn separately), so the icon and the in-app mark
  can never visually drift apart. This also resolves the "no manifest/
  icon" gap noted in the previous pass.
- **The `receipts` storage bucket is public, not RLS-gated by night
  membership.** A custom storage policy parsing `night_id` out of the
  object path is possible (Postgres storage RLS supports it), but wasn't
  built — it adds real complexity that's hard to verify without a live
  browser to test against, for a casual social app where "not guessable"
  (random-UUID paths) is a reasonable bar. Flagged as an open gap, not
  silently decided.
- **Stop 1's name is set via a direct `stop` table update, not a
  `create_night()` RPC change.** Checked RLS first — `stop_update` already
  permits it for any night member, no column restriction — so this reuses
  an existing permission path instead of touching a function multiple
  other flows depend on. Non-fatal if it fails: the night's already
  created either way.
- **The round card's receipt icon has no click handler when empty.**
  When a receipt exists, its click calls `stopPropagation()` and opens
  the viewer. When it doesn't, the click is left to bubble up to the
  card's own tap-to-edit — attaching a receipt only ever happens in the
  edit sheet, so an empty icon doing nothing itself but forwarding to
  edit is intentional, not a missed handler.
- **The numeric font (`--font-numeric`, IBM Plex Mono) is reserved for
  content that's actually a number** — dollar amounts, timestamps, the
  keypad, uneven-share stepper values, receipt columns. A phrase that
  merely *contains* a number (a settlement sentence, a status line, a
  tag) uses the interface font instead, with `font-variant-numeric:
  tabular-nums` doing the alignment work that used to be the excuse for
  reaching for the typewriter face. Two exceptions, both deliberate:
  - **The receipt (`.receipt` and its `r-*` children) stays blanket
    monospace, labels included.** It's a literal cash-register-receipt
    pastiche — real printed receipts are monospace end to end, not just
    their numbers — so this is a bounded stylistic quotation, the same
    category as the brand wordmark using Playfair Display. Not an
    inconsistency to fix.
  - **Two-letter avatar monograms (`.av`, `.who .mini`, and the inline
    equivalent in the shares panel) stay monospace.** They're an
    iconographic "ID badge" label, not prose someone reads, so the
    typewriter face's blocky look is the point, not a violation.
- **`--violet` is defined in `:root` but not used anywhere in the
  codebase** (confirmed by grepping the whole project, not assumed).
  `--line`, used throughout for borders and dividers, already fills the
  "purple/lavender: dividers, neutral structure" role chromatically —
  same muted-violet family, just darker — so no new violet accents were
  introduced just to give the token a job. Worth revisiting only if a
  future pass has an actual reason to differentiate "secondary control"
  from "structural divider" as distinct colors.
- **`close_night()` and `reopen_night()` are meant to be exact mirror
  images — same authorization model, same guard shape, same
  `SECURITY DEFINER` status.** They drifted (see Real bugs below: the
  missing already-closed guard, the missing `SECURITY DEFINER`) because
  they were written at different times rather than as a matched pair.
  If either one changes, check the other reflects it. The pattern to
  keep: the function's own body checks `host_id = auth.uid()` — that
  check *is* the authorization — and `SECURITY DEFINER` just lets the
  authorized action actually execute regardless of the caller's own RLS
  grants, the same principle already documented above for
  `is_night_member`.
- **Any function called internally by another function needs its own
  `EXECUTE` grant checked independently — a function being reachable via
  the app doesn't mean every function *it* calls is reachable too.**
  `settle_night` had the right grant; `assert_night_balances`, which it
  calls, didn't. Found by auditing every function in `public` against
  `has_function_privilege('authenticated', ..., 'EXECUTE')` in one
  query rather than checking them one at a time — worth doing that
  audit again after adding any new internal helper function, since this
  is now a confirmed repeat failure mode, not a one-off. Two more
  functions turned up missing the grant during that audit
  (`assert_allocation_integrity`, `assert_host_permanent`) but neither
  is a live bug: the first only runs as an `allocation` trigger (trigger
  execution doesn't need a direct grant, same as `handle_new_user` on
  `auth.users`), and the second isn't called by anything at all anymore.

## Real bugs found and fixed (context for why code looks the way it does)

- The `supabase_realtime` publication was **empty** for a long stretch —
  every live-sync subscription was a silent no-op. Only a full page reload
  ever actually refreshed data. Fixed by adding the relevant tables to the
  publication.
- RLS helper functions (`is_night_member` etc.) had `EXECUTE` revoked from
  `authenticated` during a security hardening pass — broke every policy
  that used them. `SECURITY DEFINER` controls whose privileges a
  function's *body* runs with; it does not authorize the call itself. Both
  are needed.
- iOS Safari auto-zooms on input focus below 16px font — fixed, then found
  a second cause of the same symptom (`100vh` resizing oddly when the
  keyboard opens) — switched to `100dvh`.
- `--dim2` (muted text token) measured 2.7–3.4:1 contrast against its card
  backgrounds — WCAG AA needs 4.5:1. Fixed with real measured numbers, not
  a guess (`#9088A8`, now 4.5–5.6:1 everywhere it's used).
- The header showed whole-dollar amounts (`money0()`) while every expense
  line showed cents (`money()`) — same night, two different levels of
  precision. Header now uses `money()`, the same formatter as everything
  else it sits above.
- The header's "Out 1/1" reads as "1 of 1 people have left," backwards
  from what it means (count of members *still present*, not yet left).
  Relabeled "Active."
- The "Not Drinking" toggle changed the same thing it always had
  (`is_dry`, checked only for round-kind expenses in `eligible()`), but
  the UI never said so — read as a general dietary/preference flag rather
  than "skip drink rounds specifically." Relabeled with explicit scope
  text rather than changing the underlying flag.
- The Crew tab's presence timeline bar (`.track`/`.span`) had no
  accessible name at all — a screen reader got nothing from it. Added
  `role="img"` + a descriptive `aria-label`.
- The invite-code input's letter-spacing (`.3em`) made it look like a
  visually different component from the name field right beside it —
  brought down to `.12em` to match `.code-display` elsewhere in the app.
- `extreme()` (the Most generous / Cheapest date receipt stat) was still
  using `money0()` while every other figure on the receipt uses `money()`
  — same class of bug as the earlier header fix.
- `money()` never had a thousands separator at all (`$1234.56`, not
  `$1,234.56`) — `money0()` already did, inconsistently. Fixed by
  switching `money()` to `Intl`/`toLocaleString`.
- Restoring pinch-zoom (mobile-polish pass) had a side effect nobody
  caught until it was felt on a real phone: iOS's double-tap-to-zoom
  gesture started misfiring on fast repeated taps of the same keypad
  button. Fixed with `touch-action:manipulation` app-wide, which kills
  double-tap-zoom specifically without touching pinch-zoom at all.
- While lightening the palette, found `--dim2` on `--ink3` was already
  sitting at 4.498:1 — a hair under WCAG AA's 4.5:1 — *before* any of
  this pass's changes. Pre-existing, not introduced here. Left `--ink3`
  untouched rather than push it further under while lightening
  everything else.

- `money(-0)` rendered `"-$0.00"` — confirmed in node, not assumed. Any
  tiny negative residual rounding to zero cents hit the same path. Fixed
  in `utils.js` so every caller benefits, not just the settlement display.
- **`.focus()` scrolled hidden sheets into view.** This is the one that
  took the longest to find, and it's worth understanding because the
  pattern is easy to reintroduce. `.phone` is `overflow:hidden`, every
  sheet is `position:absolute; bottom:0` hidden via `transform:
  translateY(102%)`, and `.focus()` makes the browser scroll ancestors to
  reveal its target. `overflow:hidden` blocks *user* scrolling but not
  programmatic scrolling — so focusing a button inside the newly-opened
  End night sheet scrolled the container and dragged the off-screen
  `#detailsSheet` (z-index 50, above End night's 40) into view on top of
  everything. The JS logic was correct the whole time; nothing had a
  stray `.on` class. Fixed with `focus({preventScroll:true})` plus
  `visibility:hidden` on closed sheets so they can't render even if
  something does scroll.
- The compiled single-file build silently broke when `settlement.js` was
  added: the build script stripped local imports from `app.js` but not
  from the new module, so `money` was declared twice in one module scope.
  A `SyntaxError` stops the *entire* script from executing — including
  the error-overlay code further down the same file — which presents as
  a totally blank app with no visible error. The build script now asserts
  zero leftover local imports and zero duplicate top-level declarations
  before writing.
- `await refresh()` looks awaitable but isn't — `refresh()` is
  `setTimeout`-debounced internally and returns nothing, so awaiting it
  resolves immediately. End night rendered from stale still-open data
  that then visibly swapped ~220ms later. Anywhere freshness genuinely
  matters, fetch directly (the shape `load()` uses) rather than calling
  `refresh()`.
- Several handlers (`End night`, `Mark Paid`, `Add Stop`) disabled their
  button before an `await` with no `try/catch` — any unexpected throw
  left the button disabled forever with no feedback, indistinguishable
  from a crash. All three now guarantee recovery.
- **`--dim2` on `--ink3` was still 4.498:1 — the exact near-miss flagged
  and deliberately left by the mobile-feel-fixes pass above, unresolved
  until the typography refinement pass finally fixed it** (`#9088A8` →
  `#948CB0`, re-measured with the same script, now 4.76–5.57:1 on every
  card background it's used against). Left as a gap for one pass,
  fixed in the next — not something that silently lingered forever.
- The Crew card's "Current share" row (`.cc-share-row`) had its label
  word ("Current share") inheriting the row's monospace font, meant for
  the dollar value next to it — found while auditing that card's
  hierarchy by name for the typography pass, the same class of bug as
  the flag tag and split-summary line in the same pass.
- **`close_night()` had no guard against being called on an already-
  closed night.** Re-running it deleted every `settlement` row —
  including any `marked_paid` ones — and re-inserted fresh rows
  defaulting to `status='open'`, silently reverting every "Mark Paid"
  confirmation. Fixed on both overloaded versions found in the database
  (a legacy 1-arg one and the 2-arg one the app calls), mirroring the
  exact guard `reopen_night()` already had for the inverse case.
- **`reopen_night()` wasn't `SECURITY DEFINER`, unlike `close_night()`.**
  Its internal `delete from settlement` ran under the caller's own RLS,
  and there is no `DELETE` policy on `settlement` for `authenticated` —
  only `SELECT` and `UPDATE`. The delete silently affected 0 rows, no
  error, leaving orphaned rows behind on every reopen. Found one live
  (a `marked_paid` row on an actively-open night). Fixed by making
  `reopen_night` `SECURITY DEFINER` — its own `host_id` check is
  already the real authorization.
- **`settle_night()` — the RPC behind every live settlement preview on
  an open night — was 403ing for every real user, the entire time.**
  Confirmed directly in the API logs (`POST rpc/settle_night → 403`,
  repeatedly, while everything else on the same session succeeded).
  Root cause: it calls `assert_night_balances()` internally, which had
  `EXECUTE` granted only to `postgres`/`service_role`. Since
  `settle_night` itself is deliberately not `SECURITY DEFINER` (it's a
  read-only, caller-privileges function by design), the internal call
  inherited that gap. `refreshPlan()` swallowed the error silently
  (`console.error`, falls back to `plan=[]`) — which is the actual
  explanation for the Tab persistently showing "Everyone is settled"
  regardless of real balances. Same failure class as the
  `is_night_member` bug above, just discovered on a different function.
  Fixed by granting `EXECUTE` on `assert_night_balances(uuid)` to
  `authenticated, anon`.
- **The "Ending…"-forever bug.** `#lcEndBtn` lives in static markup
  (`#lastCallSheet`), never recreated by `renderAll()` the way the tab
  panes are — so it carries over whatever state the *previous* use left
  it in. The close handler's success path only ever restored the button
  on the *error* branch, so a successful close left it permanently
  `disabled`, showing "Ending…". Invisible the first time (the overflow
  menu correctly hides "End night" once closed), but the moment the
  night is reopened, this exact button reappears in the DOM exactly as
  it was left — un-clickable, no way to end the night a second time in
  the same browser session without a full reload. Fixed by restoring
  the button on the success path too, plus a defensive reset in
  `confirmLastCall()` on every open.

## Status: visual/UX redesign passes

1. ✅ Inspection + implementation plan (no code)
2. ✅ Typography/contrast/hierarchy/mobile pass — token fixes, mono
   reclassified off ~15 non-receipt selectors, card padding/radius
   unified, 44px tap targets, safe-area insets
3. ✅ Join/start screen overhaul — real button hierarchy, live code
   uppercase/space-strip (display-only, server already normalizes), Web
   Share API with `sms:` fallback, QR code
4. ✅ Branding + QR — logo mark (inline SVG, circular-arrow motif + L/C
   monogram), Playfair Display wordmark, tagline; all landing-screen only,
   not repeated on every sub-screen. QR code actually wired up this pass
   (see gap below — it had been described as done earlier but wasn't in
   the code).
5. ✅ Primary live-night dashboard — header precision (cents everywhere,
   "Active" label), tab bar (44px targets, centered indicator instead of
   stacked borders), bottom action bar rebuilt as primary/secondary/
   destructive hierarchy (Add Round / Add Stop / Last Call), dedicated
   Last Call confirmation sheet (current total / people still out /
   unresolved balances → Keep Night Open / End Night), softened live-dot
   pulse.
6. ✅ Tonight tab + round cards — amount as the strongest element, payer +
   plain-English participant count (no more "N-way"/"shares" jargon on the
   card), labeled+tooltipped flag control, real empty state, non-blocking
   toast with a genuine Undo on new rounds.
7. ✅ Modularization — split the single HTML file into
   `index.html` + `styles.css` + `js/*.js` (see File structure above).
   Not originally part of this numbered plan, but done as its own pass.
8. ✅ Crew tab — intro card leads with a plain-language statement of the
   presence rule, join code + Share/Copy in their own row, Switch/Leave/
   Close visually separated below a divider; participant rows now state
   presence in words ("Still out since..."/"Left at..."), surface all
   three `night_balance` fields (Paid/Current share/Owes) instead of two,
   relabel the drink-round toggle with an explicit scope explanation, and
   give the timeline bar a real accessible name. Closing from Crew reuses
   `confirmLastCall()` — not a second close flow.
9. ✅ The Tab / receipt — running/final status moved into the receipt's
   own header ("RUNNING TAB"/"FINAL TAB"), who-pays-who rows restated as
   "X pays Y" with real persisted Unpaid/Marked paid status, action row
   (Share Summary / Settle Up / Details) added below the receipt, playful
   stats isolated behind `PLAYFUL_SUMMARIES`. Fixed the "Mark received
   doesn't persist" gap for real (see Architectural decisions).
10. ✅ Mobile/regression polish pass — accessibility (real `<label>`s,
    live-announced toast, tab/tabpanel ARIA, keyboard-operable round
    cards, measured contrast fixes on the receipt), touch-target sweep
    (`.mini-btn`/`.crew-btn`/`.crew-link`/`.flag` brought up toward the
    44px standard), a real overflow-safety fix for long Crew names, and
    terminology alignment ("Your tab" → "Your share", "not drinking" →
    "off rounds" in the add-sheet to match the Crew tab). No calculation
    code touched — verified via diff and a declaration-parity check.
11. ✅ Real branding + info guide + Crew collapse + descriptions + tip
    calculator rework — real logo now doubles as the app icon (favicon +
    apple-touch-icon + manifest icons, generated from the exact in-app
    SVG); persistent header shows the logo/wordmark instead of plain
    text (still one semantic `<h1>`); new info button opens a quick
    guide reusing `brandBlock()` (this is where the tagline now also
    lives, alongside the landing screen); Crew intro card collapsed by
    default via native `<details>`; optional round description
    (`expense.description`, new column); round entry is total-first with
    an opt-in tip calculator instead of always-on subtotal+%.
12. ✅ Header polish (spec-driven refinement pass) — info button dropped
    the bordered-circle look (44px tap target via invisible padding, not
    a visible badge), logo mark sized down ~15%, dividers shortened/
    centered/lower-opacity, tabular numerals on every header amount,
    tab nav bumped to 52px targets with a wider/thicker active indicator.
    "Active" → "Still Out" with format "X / Y" → "X of Y", tying the
    header count to the exact wording already used per-person on Crew.
    New optional "Stop N · M rounds" context line (real data, no
    placeholder). Crew rollup heading confirmed as "Only pay for what
    you were there for." Explicitly did **not** build a scroll-collapsing
    header in this pass — flagged the architecture mismatch (header/nav
    sit outside the only scrollable region) rather than guess; see #13.
13. ✅ Compact scroll-reminder bar — the lighter of two collapsing-header
    approaches discussed (moving the real header into the scroll flow
    vs. a separate fade-in reminder bar). Built the second: `#hdrCompact`
    is `position:sticky` inside `main`, fades in past 90px of scroll and
    out below 60px (hysteresis, no flicker), fixed height + negative
    margin so it reserves zero layout space while hidden. Non-interactive
    (`pointer-events:none`, `aria-hidden`) — a convenience duplicate of
    already-accessible header info, not a second interactive surface.
    The real header never moves; Approach A (actually collapsing it) is
    still on the table if this doesn't feel like enough.
14. ✅ Mobile-feel fixes — `money()` had no thousands separator at all
    (only `money0()` did); fixed via `Intl`/`toLocaleString`. iOS
    double-tap-to-zoom was misfiring on fast repeated keypad taps (a
    direct side effect of restoring pinch-zoom in the mobile-polish
    pass) — fixed with `touch-action:manipulation` app-wide, which kills
    double-tap-zoom without touching pinch-zoom. Lightened `--ink`/
    `--ink2`/`--line`/body background a step (re-verified AA contrast
    before committing to numbers; left `--ink3` untouched since it was
    *already* at 4.498:1 for `--dim2` before this pass — the tightest
    margin in the palette, pre-existing). Real phones now go edge-to-edge
    (≤480px: no rounded corners/border/shadow/padding), card mockup only
    on wider/desktop viewports; added `env(safe-area-inset-top)` since
    edge-to-edge means the header can now actually meet a notch.
15. ✅ Initial stop naming — `create_night()` was already auto-creating
    Stop 1 server-side (confirmed by reading the actual function, not
    assumed) but never naming it. Added "Where does the night begin?
    (optional)" to Start a Night; names it via a direct `stop` table
    update after creation (RLS already permitted it — no RPC change, no
    migration needed for this one).
16. ✅ Receipt photo attachment — real backend work first: no Supabase
    Storage bucket existed at all (checked, confirmed empty), so created
    one (`receipts`, public, 10MB cap) plus upload/read policies via
    migration. Attach button in the add/edit sheet uploads immediately on
    selection. Round card shows a camera icon — dim by default, white
    (`--paper`, not a color accent) when `receipt_url` is set; tapping it
    when attached opens the photo full-size (reuses `overlay()`); tapping
    it when empty bubbles through to the card's existing edit action
    rather than being a dead click.
17. ✅ Add Round — inspection + planning (no code). Read the actual sheet
    markup/CSS/JS rather than work from memory; identified the sheet as
    its own scroll container (no separated header/footer), documented
    every business rule that had to survive a redesign, and surfaced
    three genuine open questions (tip UI model, kind-toggle reset
    behavior, fate of "Who's here"/"Clear") via `ask_user_input_v0`
    rather than guessing.
18. ✅ Add Round — first redesign pass (spec-driven). Combined payer +
    "Other expense" into one row; **tip presets reverted to always-
    visible** (18%/20%/Custom, none pre-selected, tap-to-toggle-off) —
    this is a real reversal of the total-first/opt-in-calculator model
    from an earlier pass, done deliberately per explicit instruction, not
    silently. Collapsed Note/Receipt into expandable rows with filled-
    state summaries. Fixed "1-way" wording on the confirm button (was
    fixed on the round card in an earlier pass, never on the sheet's own
    button). Kind-toggle-reset question was never explicitly answered —
    left as pre-existing behavior.
19. ✅ Add Round — refinement pass. Found by tracing all 30 requested
    functional states through the actual code rather than assuming:
    there was no way to *remove* an attached receipt (only attach/
    replace); failed uploads only surfaced via an auto-dismissing toast
    (added a persistent inline error); `aria-pressed` was missing from
    tip chips and payer buttons (split-row had it, the other two didn't);
    nothing moved focus when Note/Receipt/Payer rows expanded. Also
    removed a genuine duplication — `#presenceHint` and `#autoNote` were
    both explaining the same presence rule at once.
20. ✅ Add Round — full information-architecture restructuring. The
    sheet had no fixed height (`max-height:90%` is a cap, not a target),
    which is the literal cause of "begins too low." Split `.sheet` into
    `.sheet-compact` (Add Stop, Last Call — unchanged) and `.sheet-full`
    (Add Round + two new children) with a real
    `grid-template-rows:auto minmax(0,1fr) auto`. Moved the full
    participant grid into a new **Edit Split** child sheet (reintroduced
    "Current Crew" — the earlier answer had dropped this action entirely;
    this newer spec brought it back with clearer naming, treated as
    supersession, not a mistake) and Note+Receipt into a new **Round
    Details** child sheet. Mutations stay immediate (unchanged from
    before) — "Apply"/"Save" just close the child sheet, since staged/
    buffered editing was never the existing behavior to begin with.
    Stacked three sheets via z-index (`.z2` on children) without hiding
    the parent, so its state is never lost while a child is open.
21. ✅ Receipt attach — file-or-photo choice. `capture="environment"` was
    biasing mobile browsers toward the camera directly, skipping the
    real choice; removed it. `accept="image/*"` blocked PDFs (receipts
    are very often digital); broadened to include `application/pdf`. The
    viewer always rendered `<img>`, which would silently break on a PDF —
    now detects file type by extension and shows an "Open Receipt" link
    for non-images. Camera icon → paperclip (attach button + the Tonight-
    tab indicator), since "camera" implied photo-only. Side benefit
    found in passing: the old indicator was an emoji, and emoji don't
    reliably respect CSS `color` — the gray/white attached-state toggle
    may never have actually rendered correctly; the new SVG (`currentColor`)
    fixes this as a side effect.
22. ✅ Two-state persistent header. The existing "compact bar" (from an
    earlier pass) was never actually a second *state* — `header`/`nav`
    sat outside `main` and never collapsed; the compact bar was a
    permanent third layer fading in on top of a header that never went
    away. Consolidated into one system: `header` now has exactly one
    active child at a time (`.hdr-expanded` or `.hdr-compact-row`),
    toggled by a single class off one scroll listener on `main`, with
    hysteresis (compact past 80px, expanded only restored near the
    actual top). Compact title is tab-aware — Tonight shows stop/round
    context, Crew shows "N Still Out", **The Tab shows "The Tab" with no
    logo mark at all**, since the receipt already carries the LAST CALL
    branding and repeating it was the exact duplication this pass
    targeted. Also: tightened expanded-header spacing (~15% padding,
    shorter dividers), bottom tray padding trimmed, Tonight's empty-state
    FAB-vs-central-CTA duplication fixed (scoped tightly to
    `currentTab==='tonight' && !expenses.length`, not a blanket rule),
    Crew intro row bumped from the 44px app-wide floor to 56px per this
    spec's specific target.
23. ✅ Canonical settlement + settlement-first Tab (prompt 3 of 6). New
    `js/settlement.js` owns all directional language, currency
    formatting, zero/negative-zero handling, and payment-state wording.
    Crew cards now consume it instead of their own copy. The Tab was
    restructured so the required payment is the first thing on screen,
    with the full receipt collapsed under "How this was calculated".
    Confirmed the sign convention and the payment-status model against
    the live DB before touching display logic.
24. ✅ Bottom bar + end-night flow (prompt 4 of 6). Bottom bar reduced to
    Add Round + Add Stop; End night moved into the existing overflow menu
    in its own destructive section, host-only, matching the server-side
    check in `close_night()`. Confirmation sheet gained the full field
    set, a real focus trap, non-destructive default focus, honest
    reversibility copy (verified `reopen_night()` exists), and correct
    failure behaviour — the sheet now stays open through the whole
    attempt rather than closing first and leaving a failure with nowhere
    to report to.
25. ✅ Typography & contrast refinement pass (spec-driven, prompts 0–4's
    structural decisions preserved, nothing reversed). Full token system
    added to `styles.css` (four font-role tokens, a nine-step type scale,
    eight semantic color aliases). Fixed a real WCAG near-miss (`--dim2`
    at 4.498:1, found and left by an earlier pass — see Real bugs below)
    and ~10 places where the numeric font was being used for full phrases
    instead of numbers. Raised Crew card participant name 14→17px (the
    clearest single gap the spec's own audit found) and The Tab's
    settlement instruction 15→20px / amount 24→28px, plus smaller bumps
    across buttons toward the spec's primary-action floor. The receipt
    block was deliberately left alone — see Architectural decisions.
26. ✅ Small feature/polish batch (name change, stop reassignment,
    Mark Paid visuals, receipt additions, expense-card cleanup).
    - **Change your name mid-night** — overflow menu → "Change your
      name." Writes straight to `person.display_name` (RLS's
      `person_self_write: id = auth.uid()` already permits this — no new
      RPC needed). It's an identity-level field, not night-scoped, so
      this updates the name everywhere that person appears, in every
      night they're in, not just the current one.
    - **Move an expense to a different stop**, from the edit sheet.
      Added a Stop picker pill (same interaction shape as the existing
      Paid-by pill) — only rendered in edit mode, and only when the
      night has 2+ stops. `stop_id` is now included in the edit save
      alongside payer/description/receipt; new rounds are unaffected,
      still auto-attaching to the current stop.
    - **Mark Paid visual redesign.** It used to be a same-color-family
      text swap ("Payment pending" → "Paid"), easy to miss. Paid cards
      now get a real teal-tinted background/border wash, the amount
      steps down from accent to secondary color (no longer the call to
      action), and a small SVG checkmark pops in next to "Paid."
    - **Receipt additions** (duration, per-stop breakdown, who-pays-who)
      — folded a coarse duration ("5h 28m") into the existing status
      line rather than adding a new one; added a "BY STOP" section
      (only when 2+ stops actually have spend, since one stop is already
      the NIGHT TOTAL line); added a "WHO PAYS WHO" section listing the
      actual transfer directions (`Eric → Rocco $24.00`). That last one
      went through a revision — first pass showed each person's net
      +/− position, which the person found harder to read than just the
      direct pairwise transfers already shown as cards above the
      receipt; replaced rather than kept both.
    - **Expense-card action buttons cleaned up.** The paperclip
      (receipt) and flag buttons were visually mismatched — a bare icon
      next to an icon+text label of different size/weight. Unified into
      one row of matching 28×28 icon-only buttons. The flag's "⚑" emoji
      was also replaced with a real SVG using `stroke="currentColor"`,
      same fix already applied to the receipt icon in redesign pass #21
      — emoji don't reliably respect CSS `color`, so the flag's
      active/inactive color states may never have rendered correctly.
      Dropping the "Flag"/"Flagged" text label doesn't lose information:
      `.exp-flagtag` in the card header already announces "Flagged"
      once disputed, so the button repeating it was redundant weight,
      not the only place it's said.
    - **In-app guide (`showGuide()`) additions** — explained what
      flagging actually does (holds an expense out of the tab, doesn't
      delete it), that any round/expense is tap-to-edit (including,
      now, which stop it's under), and that Mark Paid is a bookkeeping
      checkbox, not a real money transfer.
    - **Database:** added `auto_close_stale_nights` and its `pg_cron`
      schedule (see Schema above) — nights untouched for 7+ days now
      close themselves automatically instead of staying open forever.
27. Not yet specified by the person.

## Known open gaps (real, not yet fixed)

- **`close_night(uuid)` (the 1-arg, pre-dust-cents overload) is dead
  code.** It internally calls `settle_night(p_night_id)` with one
  argument, but only `settle_night(uuid, integer)` exists anymore — so
  this overload would throw if anything ever actually called it. The
  app only calls the 2-arg `close_night(uuid, integer)`. Found while
  building `auto_close_stale_nights`, which was deliberately based on
  the live 2-arg version's logic instead. Not removed — just flagged,
  since dropping a DB function isn't something to fold into an
  unrelated feature pass.
- **This repo's actual layout is flat** (`app.js`, `styles.css`,
  `config.js`, etc. all at root) **but `index.html` references
  `js/app.js` and `icons/icon.*`.** Either the live Netlify deploy has
  those subfolders and this particular export just doesn't reflect it,
  or it's genuinely broken — not confirmed either way this session.
  Worth a quick check next time the actual deploy is being debugged.
- **Stop detection is still manual** — no automatic venue-change detection
  (the four-layer plan: time gap → coarse location → venue chips → receipt
  backfill was scoped early on, never built).
- **`venmo_handle` and `ocr_payload`** — schema columns exist, zero UI or
  logic uses them. (`receipt_url` is no longer in this list — it's real
  now, see redesign pass #16.)
- **QR code scannability** — improved this pass (150px→220px, quiet-zone
  margin 1→3, CSS size matched 1:1 to canvas resolution so scaling can't
  blur it; contrast measured at 15.67:1 and ruled out as a factor). Still
  not confirmed against a real phone camera.
- **`app.js` is still a monolith** — see File structure above for the
  tradeoff. Not a bug, just the next real modularization decision if it
  comes up.
- **`note`/`display_name` are still unescaped** at render time (unlike
  `description` and now `receipt_url`'s alt text, which are escaped/safe
  by construction) — a pre-existing gap, not introduced or fixed in any
  of these passes. Worth a dedicated look if it becomes a priority.
- **No focus-trap/`aria-modal` on four of the five bottom sheets.** The
  End night sheet now has a real trap (`role=dialog`, `aria-modal`,
  Tab/Shift+Tab wrap, Escape, focus restore) because it's the one
  genuinely consequential action. The other four are unchanged and still
  deliberately untrapped rather than half-trapped.
- **The `receipts` storage bucket is public**, not gated by night
  membership. Deliberate, documented tradeoff (see Architectural
  decisions) — paths are namespaced by night ID + a random UUID, not
  guessable, but this is *not* the same as the auth-gated access every
  other table in this app has via RLS + `is_night_member()`. Worth
  revisiting if this goes beyond a friend-group tool.
- **Orphaned receipt uploads** — if someone attaches a file mid-edit and
  then cancels the sheet, it stays in storage with nothing pointing to
  it. Harmless (never surfaced anywhere, never billed), just untidy. No
  cleanup job exists.
- **The header is now permanently compact** (prompt 0) — the two-state
  collapsing system, its scroll listener, and its thresholds are all
  gone, which also retires the old "thresholds not tuned on a real
  device" gap. `92dvh`-style sheet targets elsewhere are still
  spec-derived rather than device-tuned.
- **`settle_night` 403s for an unauthenticated caller** — correct, not a
  bug: the RPC is not `SECURITY DEFINER`, so it runs with the caller's
  own privileges and every RLS policy it depends on is scoped to
  `authenticated`. It surfaces as a console error with a graceful empty
  fallback. Worth knowing because it looks alarming when testing the
  compiled single file over `file://`, which can never hold a session.
  **Correction to this entry:** at the time this was written,
  *authenticated* callers were also 403ing, for an unrelated reason —
  `assert_night_balances()`, called internally, was missing its
  `EXECUTE` grant. That was a real bug, now fixed (see Real bugs above).
  This entry originally conflated the two; the unauthenticated-caller
  403 above is still correct and expected.
- **Tip UI has now reversed twice** (total-first/opt-in → always-visible
  presets) across two passes, both times per explicit instruction, not
  drift. Worth confirming this is the settled direction before it
  reverses a third time.
- **Kind-toggle-reset-on-switch** (Round ↔ Other wipes a manually-
  adjusted split) was asked about explicitly early on and never
  answered in any of the specs since — still the original, pre-redesign
  behavior, still unconfirmed as intentional.
- **No live browser or deployed preview was available during the
  typography/contrast refinement pass.** Verified via `node --check`,
  a CSS brace-balance check, and a real WCAG contrast-ratio script —
  not visual judgment — but no actual screenshots or on-device check
  were produced. Same category as the still-unconfirmed QR-scan gap;
  worth a real-device pass, especially at 200% browser zoom and with a
  genuinely long participant name, before calling that pass fully closed.
- **One dead CSS rule, `.split-summary`** (distinct from the live
  `.split-summary-row`/`-main`/`-names`), found while auditing typography
  — superseded when the Add Round sheet was restructured in an earlier
  pass, never removed. Left in place since it's not a live inconsistency
  and this wasn't a cleanup pass; safe to delete whenever someone's
  actually in that part of the file.
