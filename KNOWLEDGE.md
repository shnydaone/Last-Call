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
  app.js              state, auth/boot, rendering, sheets, realtime sync
```

**Why `app.js` is still one ~1260-line file, deliberately.** Everything in
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
17. Not yet specified by the person.

## Known open gaps (real, not yet fixed)

- **Stop detection is still manual** — no automatic venue-change detection
  (the four-layer plan: time gap → coarse location → venue chips → receipt
  backfill was scoped early on, never built).
- **`venmo_handle` and `ocr_payload`** — schema columns exist, zero UI or
  logic uses them. (`receipt_url` is no longer in this list — it's real
  now, see redesign pass #16.)
- **QR code scannability** — generated and structurally correct, but not
  yet confirmed against a real phone camera.
- **`app.js` is still a monolith** — see File structure above for the
  tradeoff. Not a bug, just the next real modularization decision if it
  comes up.
- **`note`/`display_name` are still unescaped** at render time (unlike
  `description` and now `receipt_url`'s alt text, which are escaped/safe
  by construction) — a pre-existing gap, not introduced or fixed in any
  of these passes. Worth a dedicated look if it becomes a priority.
- **No focus-trap/`aria-modal` on the bottom sheets** — deliberately not
  added without real focus-trapping behind it; still open.
- **The `receipts` storage bucket is public**, not gated by night
  membership. Deliberate, documented tradeoff (see Architectural
  decisions) — paths are namespaced by night ID + a random UUID, not
  guessable, but this is *not* the same as the auth-gated access every
  other table in this app has via RLS + `is_night_member()`. Worth
  revisiting if this goes beyond a friend-group tool.
- **Orphaned receipt uploads** — if someone attaches a photo mid-edit and
  then cancels the sheet, the file stays in storage with nothing
  pointing to it. Harmless (never surfaced anywhere, never billed), just
  untidy. No cleanup job exists.
- **The scroll-collapsing header is the lighter of two options
  (Approach B — a separate fade-in bar)**, not the header itself
  shrinking in place (Approach A). If the fade-in reminder doesn't feel
  like enough, moving the real header into the scroll flow is the
  documented next step, not a rebuild.
