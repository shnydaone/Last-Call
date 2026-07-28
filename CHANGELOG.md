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

### Notes
- `app.js` remains a single ~950-line file by design — it owns all shared
  mutable state (`night`, `members`, `expenses`, etc.), and splitting it
  further needs either a shared-store-object refactor or circular imports
  between its internal pieces. See KNOWLEDGE.md.
- Native ES module `import` syntax means `index.html` no longer works via
  `file://` — needs a static server locally (was previously
  double-click-to-open).

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
- "Mark received" doesn't persist (client-side only, not wired to
  `settlement.status`).
- Stop detection is manual (no automatic venue-change detection).
- `venmo_handle` and receipt OCR columns exist in the schema, unused by any
  UI or logic.
- QR scannability not yet confirmed against a real phone camera.
