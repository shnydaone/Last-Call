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
js/
  config.js          Supabase client + constants
  utils.js           pure formatting/sharing helpers (no app state)
  brand.js           logo mark + wordmark (landing screen only)
  qr.js               QR-code rendering, wraps the qrcode dependency
  app.js              state, auth/boot, rendering, sheets, realtime sync
```

**Why `app.js` is still one ~1000-line file, deliberately.** Everything in
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
join_code, status) · `night_member` (presence window: `joined_at`/
`left_at`, `is_dry`, `role`) · `stop` · `expense` (kind: round/food/other,
status: pending/confirmed/disputed) · `allocation` (weight-based, supports
uneven shares) · `settlement`

Key RPCs: `join_night`, `create_night`, `leave_night`, `add_stop`,
`settle_night`, `close_night`, `reopen_night`, `sync_permanence`.

Derived views: `allocation_share` (per-person cent share, deterministic
penny remainders), `night_balance` (paid/owed/net per person — **never**
cache this, always compute from expenses).

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
9. Not yet specified by the person.

## Known open gaps (real, not yet fixed)

- **"Mark received" doesn't persist** — flips client-side only, forgotten
  on refresh. Never actually wired to write `settlement.status`.
- **Stop detection is still manual** — no automatic venue-change detection
  (the four-layer plan: time gap → coarse location → venue chips → receipt
  backfill was scoped early on, never built).
- **`venmo_handle` and receipt OCR/`ocr_payload`** — schema columns exist,
  zero UI or logic uses them.
- **QR code scannability** — generated and structurally correct, but not
  yet confirmed against a real phone camera.
- **`app.js` is still a monolith** — see File structure above for the
  tradeoff. Not a bug, just the next real modularization decision if it
  comes up.
