# Changelog

Dates below are conversation dates, not deploy dates. Entries under
"Earlier" predate this changelog and are reconstructed from the original
`last-call-handoff.md` briefing — no specific dates are available for them,
so none are guessed.

## 2026-07-27

### Added
- Logo mark (inline SVG, circular-arrow motif + L/C monogram), Playfair
  Display wordmark, and tagline — landing/join-start screen only.
- QR code on the "Night Out Started" screen, encoding the same invite URL
  Share/Copy already use. (This had been described as done in an earlier
  pass but wasn't actually in the code — implemented for real this pass.)
- Dedicated Last Call confirmation sheet: current total, people still out,
  unresolved balances, then Keep Night Open / End Night.
- Real empty state for the Tonight tab ("No rounds yet" + Add First Round
  button) replacing a plain-text placeholder.
- Genuine Undo on the "round logged" toast — deletes the just-created
  expense by id, the same primitive the existing Void button already used.
- `js/qr.js`, `js/brand.js`, `js/utils.js`, `js/config.js` — new leaf
  modules split out of the single inline script (see Changed below).
- Copy Code button on the Crew tab — clipboard copy of the join code was
  previously only available once, on the "Night Out Started" screen; same
  logic, now available for the life of the night too.
- "Close the night" action on the Crew tab (host, night open) — calls the
  same `confirmLastCall()` the fab already used; not a second close flow.
  Previously this state only showed inert text ("Close the night to leave
  as host") with no button.
- Action row beneath the receipt: Share Summary (native share, falls back
  to clipboard), Settle Up (final tab only, only when a balance is
  unresolved), Details (per-person Paid/Share breakdown in a separate
  card below the receipt, not inside it).
- `PLAYFUL_SUMMARIES` flag in `js/config.js`, isolating the receipt's
  personality stats (Rounds bought / Most generous / Cheapest date) behind
  one constant. No settings framework exists yet, so this is the
  documented fallback until one does.
- Real `<label for>` on every join/sign-in/start-night form field (were
  `<div class="field-label">`, invisible to screen readers).
- `role="status" aria-live` on the toast (bumped to `assertive` for
  errors) — previously nothing was announced to screen readers at all.
- `role="tabpanel"`/`aria-controls` wiring between the nav and the three
  panes.
- Keyboard support (`role="button" tabindex="0"`, Enter/Space, visible
  focus ring) on round-card rows — they were plain `<div>`s with a click
  handler, invisible to keyboard/screen-reader users despite being the
  primary way to edit an expense.
- `aria-label`s on the keypad's `·` (00) and `⌫` (backspace) keys, and a
  live region on the running total, for the fully custom numeric keypad.
- Real app icon: `manifest.json`, `icons/icon.svg`, and PNGs at 16/32/
  180/192/512px, generated directly from the same SVG markup as the
  in-app logo mark (not a separate hand-drawn asset).
- Persistent header now shows the real logo mark + wordmark instead of
  plain "Last Call" text (still one semantic `<h1>`, just restyled).
- Info button (`i`) in the header opens a quick guide overlay — reuses
  the existing `overlay()` mechanism, and reuses `brandBlock()` (with the
  tagline) rather than inventing new UI.
- Crew intro card is now collapsible (native `<details>/<summary>`,
  collapsed by default) — join code, Share Invite/Copy Code, and Switch/
  Leave/Close now live inside it instead of always being visible.
- Optional round description — new `expense.description` column
  (migration `add_expense_description`), an optional field in the add/
  edit sheet, shown on the round card (escaped — see Notes) and in the
  edit sheet's hint text.
- Tip calculator — now opt-in ("+ Calculate a tip") instead of always-on;
  default entry is the total you actually paid.
- Compact scroll-reminder bar — a small sticky bar (logo, title, night
  total, live status) fades in once you've scrolled a bit into a long
  pane, fades out near the top. The real header never moves; this is a
  separate, non-interactive convenience element (see Notes for why this
  approach and not the header itself collapsing).
- "Stop N · M rounds" — optional line in the header, only shown once a
  stop genuinely exists.
- "Where does the night begin? (optional)" — new field on Start a Night,
  names the auto-created Stop 1 (previously always unnamed, always
  fell back to "Stop 1" everywhere with no way to fix it).
- Receipt photo attachment — attach button in the add/edit sheet
  (uploads immediately on selection), camera icon on the round card
  (dim when nothing's attached, white when it is) that opens the photo
  full-size when tapped. New Supabase Storage bucket (`receipts`) and
  upload/read policies — see Fixed/Notes.

### Fixed
- **"Mark received" now actually persists.** The `settlement` table
  already had `status` (`open`/`marked_paid`) and `marked_paid_at`
  columns — the client only ever wrote to a local `Set` that reset on
  refresh. `refreshPlan()` now carries the real row `id`/`status`
  through, and marking received writes to the real column. Only
  available once a night is final — while running, the settlement
  preview has no stable row to persist against yet.
- Invite-code input's letter-spacing (`.3em`) made it look like a
  different component from the name field right next to it — brought
  down to `.12em`, matching `.code-display`'s existing value elsewhere
  in the app.
- `extreme()` (Most generous / Cheapest date) was still using `money0()`
  while every other figure on the receipt uses `money()` — same class of
  bug as the header fix from an earlier pass.
- Receipt contrast: `.r-muted` measured 4.49:1 (just under WCAG AA's
  4.5:1), `.r-pay-status`/`.settled` measured 3.84:1 (a real failure) —
  opacities bumped to a comfortable margin above AA.
- Touch targets brought up toward the app's own 44px standard:
  `.mini-btn` (Tap Out/Skip Rounds) and `.crew-link` (Switch/Leave/Close)
  had no minimum height at all; `.crew-btn` (Share Invite/Copy Code) was
  capped at 34px.
- Crew's `.pname` had no overflow protection — a long single-word display
  name could overflow its row and cause page-wide horizontal scroll.
- Terminology: the add-expense sheet still said "not drinking" in two
  places after the Crew tab was renamed to "Skip Rounds"/"off rounds" —
  aligned. Header said "Your tab" while Crew said "Current share" for the
  identical value — unified to "Your share."
- "Active" → "Still Out" in the header, format "X / Y" → "X of Y" — ties
  the header's presence count to the exact wording already used
  per-person on the Crew tab ("Still out since...").
- `money()` had no thousands separator at all (`$1234.56`) while
  `money0()` already did, inconsistently — both now use `Intl`/
  `toLocaleString`.
- iOS double-tap-to-zoom was misfiring on fast repeated taps of the same
  keypad button — a direct side effect of restoring pinch-zoom in the
  mobile-polish pass. Fixed with `touch-action:manipulation` app-wide,
  which kills double-tap-zoom without touching pinch-zoom.
- Info button dropped its bordered-circle look (was reading as a
  floating badge) — smaller visible glyph, real 44px tap target via
  invisible padding, not a visible circle.
- `create_night()` was already auto-creating an unnamed Stop 1 (confirmed
  by reading the actual function) with no way to name it — see Added.

### Changed
- Header now shows precise currency (`$55.45`, not `$55`) for both Night
  total and Your tab, using the same `money()` formatter as every expense
  line — was previously rounded independently via a separate `money0()`
  call.
- Header's "Out 1/1" relabeled "Active" — the count was always "members
  still present," which the old label read backwards.
- Tab bar rebuilt: 44px+ touch targets, centered fixed-width active
  indicator (previously a full-width `border-bottom` that visually
  stacked against the tab bar's own separator line).
- Bottom action bar rebuilt into an explicit primary/secondary/destructive
  hierarchy: Add Round (largest), Add Stop (now has a visible label, not
  icon-only), Last Call (outlined instead of solid-filled, so it reads as
  distinct/final without out-competing Add Round).
- Live-status dot pulse softened (opacity floor .25 → .5, 2s → 2.4s cycle).
- Round/expense card: amount is now the strongest element (15px/600 →
  19px/700, its own column); payer + participant count merged into one
  line in plain English ("Eric paid · 1 participant") — the old "N-way" /
  "N shares" internal terminology is gone from the card (still visible and
  editable in the edit sheet, where the actual weights are set).
- Round-card tap-to-edit affordance (cursor, hover, chevron) now only
  renders when the night is open — previously present even on closed
  nights, where tapping just produced a "Tab is closed" error toast.
- Flag control: kept the ⚑ icon, added a visible text label
  ("Flag"/"Flagged"), an `aria-label` describing the actual effect, and a
  `title` tooltip. Previously icon-only with no explanation.
- `toast()` extended with an optional inline action (used by Undo above);
  existing plain-message calls elsewhere are unaffected.
- **Modularized the app.** Single `last-call-app.html` (~1470 lines) split
  into `index.html` (shell), `styles.css`, and `js/{config,utils,brand,qr,
  app}.js`. Every top-level declaration was cross-checked programmatically
  against the original file — zero lost, zero duplicated; the only new
  declaration is `renderInviteQR()`, a thin named wrapper around the same
  `QRCode.toCanvas()` call that was previously inline.
- Started this changelog, `KNOWLEDGE.md`, and `README.md` as a standing
  "full package" alongside code changes.
- **Crew tab rebuilt.** Intro card now leads with a real heading
  ("Presence drives the split") and the exact two-line explanation of the
  rule; join code moved into its own row with Share Invite + Copy Code;
  Switch/Leave/Close moved into a visually separate block below a divider
  (danger color on Leave/Close).
- Each participant row now shows a plain-English presence state
  ("Still out since 8:49 PM" / "Left at 10:42 PM") instead of a separate
  "Gone" pill plus a raw IN/OUT timestamp row.
- Participant money display expanded from 2 numbers (share, net) to the
  3 genuinely distinct fields `night_balance` provides: Paid, Current
  share, and Owes/Is owed — `paid_cents` wasn't surfaced anywhere before.
- "Not Drinking" relabeled "Skip Rounds" / "Include in Rounds"
  (action-oriented, matching the existing Tap Out/Tap Back In pattern),
  with a `title` + `aria-label` explaining exactly what it does: excludes
  from round-kind expenses only, no effect on food/other. The toggle's
  underlying behavior (`is_dry` on `night_member`) is unchanged.
- Presence timeline bar gained `role="img"` + a descriptive `aria-label`
  ("Present from X to Y") — previously had no accessible name at all.
  Arrival/departure captions relabeled "Arrived"/"Left"/"Present now"
  (was "IN"/"OUT"/"STILL OUT").
- **The Tab receipt.** Running/final status moved from an external
  banner into the receipt's own header: "RUNNING TAB · Night still open"
  with the exact supporting line requested, or "FINAL TAB · Night closed
  at [time]" (real `night.closed_at`). Who-pays-who rows changed from a
  single-line arrow ("Mia → Eric") to a stacked "Mia pays Eric" / amount
  / status layout, each showing Unpaid or Marked paid. "All square" case
  upgraded to "ALL SQUARE / No payments needed." Base font 11.5px→12px,
  section-rule spacing 10px→14px, `font-variant-numeric:tabular-nums`
  and overflow/ellipsis safeguards added for long names on narrow
  screens.
- Pay-in-Venmo and Mark-received are now only shown once a night is
  final — while running, who-pays-who is informational only (see Fixed
  above for why: no persistable row exists yet, and paying against a
  total that's still moving risks a real overpayment).
- Round-entry model: the keypad now enters the **total** by default
  (`tip_cents` stored as 0 unless the tip calculator is engaged); the
  old always-visible subtotal+% flow is now opt-in behind "+ Calculate a
  tip." `base_cents`/`tip_cents` and every downstream calculation are
  unchanged — this only changes what the digits mean going in.
- Persistent header: plain `<h1>Last Call</h1>` replaced with the actual
  logo mark + wordmark (`headerBrand()`), sized down from the landing
  version. No tagline in the header — that stays on the landing overlay
  and now also the new info guide, not diluted by repetition.
- Crew intro card restructured into a native `<details>/<summary>`,
  collapsed by default; its expand/collapse state is tracked in
  `crewIntroOpen` so it survives the pane's realtime re-renders.
- Header logo mark sized down another ~15%, more gap from the wordmark;
  metric dividers shortened/centered/lower-opacity (were full-height
  borders); tabular numerals on every header amount; lighter label
  letter-spacing; tab nav bumped to 52px targets with a wider (60px),
  thicker (3px) active indicator and a bolder active-tab weight.
- Lightened `--ink`/`--ink2`/`--line`/body background a step (contrast
  re-verified before committing to numbers — see Fixed). `--ink3` left
  untouched.
- Real phones (≤480px) now go edge-to-edge — no rounded corners, border,
  shadow, or padding around the app; the floating-card look is now
  desktop/wide-viewport only. Added `env(safe-area-inset-top)` for this
  specifically, since the card treatment never needed to account for a
  notch before.

### Notes
- `app.js` remains a single ~950-line file by design — it owns all shared
  mutable state (`night`, `members`, `expenses`, etc.), and splitting it
  further needs either a shared-store-object refactor or circular imports
  between its internal pieces. See KNOWLEDGE.md.
- Native ES module `import` syntax means `index.html` no longer works via
  `file://` — needs a static server locally (was previously
  double-click-to-open).
- Considered a multi-option "participation menu" (full split / food only /
  not drinking / excluded from next round / left the night) but only two
  independent, calculation-affecting fields actually exist
  (`night_member.left_at` and `.is_dry`). Implemented exactly those two
  states plus their one combination; didn't add labels for states with no
  backing logic.
- `.tag-dry` and `.tag-gone` CSS classes are now unused (that information
  moved into the row's plain-English state line) — left defined rather
  than risk an unrelated deletion.
- The receipt's one-time reveal (`print` keyframe) and per-row stagger
  (`stamp` keyframe) already existed and already respected the app's
  global `prefers-reduced-motion` rule — no new animation was added, just
  confirmed and left alone.
- `settledLocal` (client-only Set) removed entirely — fully replaced by
  the real `settlement.status` column.
- Diffed every change against the pre-pass version and re-ran the
  declaration-parity check (same method as the modularization pass) —
  zero functions added/removed; the mobile QA pass touched presentation
  only, confirmed no calculation code (`totalOf`/`sumW`/`eligible`/
  `presentAt`/`isOpen`/`isHost`/`refreshPlan`/any `sb.rpc`/`sb.from`
  call parameters) changed.
- `expense.description` is escaped at render time (new `escapeHtml()` in
  `utils.js`); `note` and `display_name` are not, and still aren't —
  that's a pre-existing gap this pass didn't introduce or fix, flagged
  in KNOWLEDGE.md for later.
- Considered adding `role="dialog"`/`aria-modal` to the bottom sheets;
  deliberately didn't, since that combination without real focus-trapping
  behind it can be worse for screen-reader users than no dialog semantics
  at all. Left as an open gap for its own dedicated pass.
- The `.phone` card-mockup treatment was flagged here as unresolved in an
  earlier pass — now resolved: real phone widths go edge-to-edge (see
  Changed), the floating card is desktop/wide-viewport only.
- Two collapsing-header approaches were discussed: moving the real header
  into the scroll flow (`position:sticky`, restructures the DOM) vs. a
  separate fade-in reminder bar (lower risk, header never moves). Built
  the second. The first is still on the table if the fade-in doesn't
  feel like enough.
- The `receipts` Storage bucket is public, not gated by night membership
  like every Postgres table in this app is via RLS. Deliberate, scoped
  decision (a custom storage policy parsing `night_id` from the object
  path is possible but wasn't built) — flagged in KNOWLEDGE.md, not
  silently decided.
- Canceling the add/edit sheet after attaching a receipt photo leaves the
  upload orphaned in storage (nothing points to it, but nothing deletes
  it either). Harmless, untidy, no cleanup job exists yet.

## Earlier (pre-changelog, reconstructed from the original handoff)

### Added
- Initial schema: `person`, `night`, `night_member`, `stop`, `expense`,
  `allocation`, `settlement`; RPCs `join_night`, `create_night`,
  `leave_night`, `add_stop`, `settle_night`, `close_night`,
  `reopen_night`, `sync_permanence`.
- Anonymous auth for guests (no account required to join).
- Visual redesign steps 1–3: inspection/plan, typography/contrast/mobile
  pass (token fixes, tap targets, safe-area insets), join/start screen
  overhaul (button hierarchy, live code formatting, Web Share + `sms:`
  fallback).

### Fixed
- `supabase_realtime` publication was empty — every realtime subscription
  was a silent no-op; only a full reload ever refreshed data.
- RLS helper functions had `EXECUTE` revoked from `authenticated` during a
  security hardening pass, breaking every policy using them.
- iOS Safari input-zoom (font under 16px) and a related `100vh`/keyboard
  resize bug (switched to `100dvh`).
- `--dim2` muted-text color measured 2.7–3.4:1 contrast, below WCAG AA's
  4.5:1 — replaced with a measured `#9088A8` (4.5–5.6:1).

### Known gaps carried forward (still open)
- Stop detection is manual (no automatic venue-change detection).
- `venmo_handle` and receipt OCR columns exist in the schema, unused by any
  UI or logic.
- QR scannability not yet confirmed against a real phone camera.
