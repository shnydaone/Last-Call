# Changelog

Dates below are conversation dates, not deploy dates. Entries under
"Earlier" predate this changelog and are reconstructed from the original
`last-call-handoff.md` briefing — no specific dates are available for them,
so none are guessed.

## 2026-07-29 (typography & contrast refinement pass)

### Added
- Full typography/color token system in `styles.css`: `--font-brand`/
  `--font-display`/`--font-interface`/`--font-numeric` (aliases over the
  four typefaces already loaded — nothing new added), a nine-step named
  type scale (`--text-tag` 11px through `--text-total`/`--text-settlement`
  36px/28px), and eight semantic text-color aliases (`--text-primary`
  through `--text-accent`) over the existing palette.
- Global `:focus-visible` fallback ring — several interactive elements
  (`.who button`, `.mini-btn`, `.chip`, `.tab-action-btn`, `.fab button`,
  `.confirm`, `.cancel`, `.link`…) had no explicit focus style before this,
  relying on browser default.
- `.sr-only` utility class + a real (visually-hidden) label for the custom
  tip-percentage input, which previously had only a placeholder as its
  label — the one gap the form-controls audit found.
- `title` attributes on four fields that truncate/clamp under CSS
  (header night name, stop name, each name in The Tab's per-person list,
  the Edit Split names line) so the full text is reachable even when the
  layout can't show it all.

### Fixed
- **`--dim2` measured 4.498:1 against `--ink3`** — under WCAG AA's 4.5:1.
  Confirmed with the same relative-luminance script as prior contrast
  passes, not eyeballed. A prior pass (mobile-feel fixes) had already
  found this exact near-miss and deliberately left it — see the "Real
  bugs found and fixed" section of KNOWLEDGE.md; this pass finally fixes
  it — `#9088A8` → `#948CB0`, now 4.76–5.57:1 on every card background
  it's used against.
- **Monospace used for full phrases, not numbers**, in ~10 places — the
  same "competing type styles" complaint this pass exists to address:
  header status/live text, the Flagged tag, the flag button's own label,
  section eyebrows (`.section-lbl`, `.settle-eyebrow`), the Edit Split
  summary line, Crew card settlement text ("Owes $11.54" etc. — still
  tabular via `font-variant-numeric`, just not in the typewriter face),
  the Reopen button's caption, and three of the five End Night sheet row
  values. Genuinely numeric content (dollar amounts, timestamps, the
  keypad, uneven-share stepper values) stayed on the numeric font.
- **Crew card's "Current share" row had its label word inheriting the
  parent's monospace font** — same class of bug, found while auditing
  that card specifically since the spec called out its hierarchy by name.
  The value stays numeric; the label ("Current share") doesn't.
- End Night sheet's row values were blanket-monospace, including the
  Night title and the Settlement phrase (e.g. "Everyone is settled") —
  split via a new `.num` modifier so only the genuinely numeric rows
  (Total, Rounds · stops, People still out) stay on the numeric font.

### Changed
- **Crew card participant name: 14px → 17px.** The single clearest gap
  this pass's audit found against the spec's explicit participant-name
  floor — everything else in the card's hierarchy (settlement result,
  paid amount, status) was resized relative to this.
- **The Tab's settlement instruction: 15px → 20px; settlement amount:
  24px → 28px.** "Joe pays Eric" was barely bigger than the body text
  around it before this; the amount was bumped further so it still
  clearly outranks the now much-bigger instruction above it. The settled
  state ("Everyone is settled") matched to the same weight so a good
  outcome doesn't read as smaller news than a pending one.
- Header total bumped (16px → 18px) so it reads as the header's clearly
  strongest element, per spec, without changing the header's height or
  structure.
- Buttons nudged toward the spec's 17–19px primary-action floor: the
  sheet Confirm button (16→17px), Keep Night Open / End Night (14→16px),
  the two Tab action buttons (11.5→13px), Add Round / Add Stop on the
  bottom bar (15→16px / 12→13px).
- ~60 hardcoded `font-family`/size declarations across header, Crew,
  The Tab, the bottom bar, End Night sheet, landing/join screens, and
  form controls replaced with the new tokens — same visual weight in most
  places, real fixes where noted above.
- Settlement row on the End Night summary given a distinct accent color
  (`.lc-row-settle`), per spec's "settlement summary visually distinct"
  requirement — it's the row the sheet exists to answer.

### Notes
- **The receipt block (`.receipt` and its `r-*` children) was deliberately
  left untouched**, including its blanket monospace treatment for labels
  like "Subtotal"/"NIGHT TOTAL". It's a literal cash-register-receipt
  pastiche — real printed receipts are monospace end to end — and this is
  a considered exception to the typography-role rule, not an oversight.
  Changing it would work against "preserve existing personality."
- **`--violet` remains defined but unused** — grepped the whole codebase
  to confirm before deciding. `--line` already fills the spec's "purple/
  lavender: dividers, neutral structure" role chromatically (it's the
  same muted-violet family, just darker), so no new violet accents were
  invented to give the unused token a job — that would be scope beyond a
  refinement pass for no clear product reason.
- Found one dead CSS rule, `.split-summary` (not `.split-summary-row`) —
  superseded by `.split-summary-row`/`-main`/`-names` when the Add Round
  sheet was restructured in an earlier pass. Left in place; this wasn't a
  cleanup pass and it's not a live inconsistency (nothing renders it).
- **No live browser or deployed preview in this session** — verified via
  `node --check` on every module, a CSS brace-balance check, and the
  contrast script; no visual-regression screenshots were produced.
  Recommend a real-device pass against the deployed site, same
  recommendation as the still-open QR-scan gap.
- Compiled build regenerated via the same pipeline as prior passes:
  local imports stripped, modules merged in dependency order (config →
  utils → brand → qr → settlement → app), the two external CDN imports
  (`@supabase/supabase-js`, `qrcode`) hoisted to the top of the merged
  script, zero leftover import/export keywords and zero duplicate
  top-level declarations asserted before writing the file, then
  `node --check` on the merged script.

## 2026-07-29

### Added
- `js/settlement.js` — canonical settlement presentation layer. One place
  that owns sign interpretation, currency formatting, zero-state handling,
  and payment-state wording, so no two screens can describe the same
  financial state differently again. Three functions: `settlementFor()`
  (participant-level), `transferInstruction()` (relationship-level),
  `nightSettlementSummary()` (night-level).
- The Tab: settlement instruction is now the first thing on the screen —
  one card per required transfer (payer, receiver, amount, pending/paid),
  with the full receipt demoted into a collapsed "How this was calculated"
  section beneath a compact summary.
- End night confirmation now shows the full spec'd field set: night name,
  total, rounds · stops, people still active, canonical settlement state.
  Rounds and stops were genuinely missing before, not just unlabeled.
- Real focus-trap on the End night sheet specifically (Tab/Shift+Tab wrap,
  Escape closes, focus returns to the menu trigger, focus lands on the
  safe action never the destructive one). Deliberately not retrofitted to
  the app's other four sheets — see Notes.
- `closeAllSheets()` — one shared guarantee that opening any top-level
  sheet first closes every other one.

### Fixed
- **`money(-0)` rendered `"-$0.00"`.** Confirmed in node before touching
  anything. Any tiny negative residual rounding to zero cents would have
  shown the same way. Fixed at the source in `utils.js`, so every caller
  benefits rather than just settlement.
- **Contradictory settlement language across screens.** "ALL SQUARE" /
  "No payments needed" could appear while Crew simultaneously said someone
  owed money. Now every screen routes through `settlement.js`.
- **Netting-graph jargon leaking into the UI** — "3 debts → 0 payments"
  replaced with "N payments remaining" / "Everyone is settled".
- **`.focus()` was scrolling hidden sheets into view.** The real cause of
  the End-night "screen scrolled up and I saw cards underneath" bug, found
  only after several wrong theories. `.phone` is `overflow:hidden`, which
  blocks *user* scrolling but not programmatic scrolling; `.focus()` scrolls
  ancestors to reveal its target, which dragged the off-screen
  `#detailsSheet` (`translateY(102%)`, z-index 50) up over everything.
  Fixed with `focus({preventScroll:true})` everywhere the target is already
  on-screen, plus `visibility:hidden` on closed sheets as a safety net so
  the class of bug can't recur.
- **Compiled single-file build was broken by a leftover import.** The build
  script stripped local imports from `app.js` but not from the newly-added
  `settlement.js`, so `money` was declared twice in one module scope — a
  `SyntaxError` that stopped the entire script from executing. The build
  now asserts zero leftover imports and zero duplicate top-level
  declarations *before* writing the file.
- **End night could leave a stuck "Ending…" button.** No try/catch wrapped
  the handler, so any unexpected throw left it disabled forever with no
  feedback — indistinguishable from a crash. Same gap fixed in Mark Paid
  and Add Stop.
- **End night's data was read before it was ready.** `await refresh()`
  looked awaitable but isn't (it's `setTimeout`-debounced internally), so
  the UI rendered from still-open data and visibly swapped ~220ms later.
  Now fetches directly and genuinely awaits, which also matters because
  `refreshPlan()` branches on `night.status` to decide between the frozen
  settlement snapshot and a live recompute.
- **Scrim was only 75% opaque**, so background changes during End night
  (tab switch + scroll reset) were dimly visible through it. Raised to 97%.
- **QR code scannability** — 150px at `margin:1` (a 1-module quiet zone,
  vs. the library default of 4). Now 220px at `margin:3`, with the CSS
  display size matched 1:1 so browser scaling can't blur the modules.
  Colour contrast was measured and ruled out first (15.67:1).

### Changed
- **Bottom action bar is now two buttons, not three.** Last Call removed;
  End night moved into the global overflow menu in its own separated
  destructive section, host-only. The existing 1.6:1 flex ratio already
  landed in the spec's suggested 60–70/30–40 split once the third button
  was gone, so no ratio change was needed.
- Destructive action relabeled to **"End night"** everywhere (was "Last
  Call" / "Close"). The product is still called Last Call; the button now
  describes what it does.
- Payment status wording: "Unpaid" / "Marked paid" → "Payment pending" /
  "Paid".
- End night confirmation copy no longer implies irreversibility — verified
  against the live `reopen_night()` RPC that ending a night is genuinely
  reversible, and says so.

### Notes
- **Confirmed against the live database, not assumed:** `net_cents =
  paid_cents - owed_cents` (positive → gets back, negative → owes);
  `close_night()` enforces `host_id = auth.uid()` server-side, so End
  night's host-only menu visibility mirrors real enforcement rather than
  substituting for it; `reopen_night()` exists, so ending is reversible.
- **Payment model documented:** the app tracks a *calculated obligation
  plus manual confirmation*, not real money movement. "Everyone is
  settled" means no transfer is required or every one is marked paid — it
  never claims money actually moved.
- Focus-trap was added to the End night sheet only. The other four sheets
  still have no trap, matching the existing documented reasoning — this
  one got it because it's the one genuinely consequential action.
- No test suite exists in this project. Verification each pass: `node
  --check`, a full `$('#...')`-against-HTML cross-reference (split into
  top-level vs. function-scoped, since a top-level reference to a removed
  element throws on load), a byte-diff of all nine calculation functions,
  and standalone runs of `settlement.js` against every case in the spec's
  test list including the Eric/Joe example, negative zero, and tiny
  floating residuals.
- Several fixes this session were reached only after wrong theories.
  The screen recording and console screenshots diagnosed in minutes what
  static code review missed across several attempts — worth reaching for
  earlier next time.

## 2026-07-28

### Added
- Add Round: Edit Split and Round Details child sheets — participant
  editing and Note+Receipt moved off the main screen entirely, each into
  its own focused near-full-screen sheet.
- "Current Crew" quick action in Edit Split — resets to the presence
  default (eligible members). This is a genuine reintroduction: an
  earlier pass explicitly dropped "Who's here" per your own answer at
  the time; a later, more detailed spec brought it back with clearer
  naming, so it's back.
- Remove Receipt action (previously attach/replace only, no way to
  clear).
- Persistent inline error message for failed receipt uploads (was
  toast-only, which can read as "silently disappeared").
- PDF support for receipts — `accept` was image-only; broadened to
  `image/*,application/pdf`. Viewer now detects file type and shows an
  "Open Receipt" link for non-images instead of a broken `<img>`.
- Custom tip input (percentage) — "Custom" previously had nothing behind
  it to open.
- Compact, tab-aware persistent header row: Tonight shows stop/round
  context, Crew shows "N Still Out", The Tab shows "The Tab" with no
  logo mark (avoids repeating branding the receipt already carries).

### Fixed
- The Add Round sheet had no fixed height (`max-height:90%` is a cap,
  not a target) — the literal cause of it "beginning too low." Now a
  real `92dvh` near-full-screen sheet with `grid-template-rows:auto
  minmax(0,1fr) auto`.
- The header's "compact bar" was never actually a second state — it was
  a permanent third layer fading in on top of a header that never
  collapsed. Consolidated into one system: exactly one of
  expanded/compact is ever present.
- `capture="environment"` on the receipt file input was biasing mobile
  browsers toward the camera directly, skipping the real file-or-photo
  choice. Removed.
- "1-way" wording on the Add Round confirm button (fixed on the round
  card in an earlier pass, never on the sheet's own button).
- `aria-pressed` missing from tip chips and payer buttons (split-row
  participant chips already had it).
- No focus movement when Note/Receipt/Payer rows expanded.
- `#presenceHint` and `#autoNote` were both explaining the same presence
  rule at the same time — removed the generic one, kept the specific one.
- Tonight's empty state showed two equally-prominent ways to add the
  first round (central CTA + bottom tray) — tray now hides specifically
  when `currentTab==='tonight' && !expenses.length`.
- Receipt icon (attach button + Tonight-tab indicator): camera → paperclip,
  since "camera" implied photo-only once files were supported. The old
  icon was an emoji, which doesn't reliably respect CSS `color` — the
  gray/white attached-state toggle may never have visually worked;
  the new SVG (`currentColor`) fixes this as a likely side effect.

### Changed
- **Tip UI reverted to always-visible presets** (18%/20%/Custom, none
  pre-selected) — a real reversal of the total-first/opt-in-calculator
  model from an earlier pass, done per explicit instruction in the
  approved redesign spec, not silently.
- Payer selector + "Other expense" combined into one row (was two
  stacked full-width elements).
- Split "quick actions" simplified to match your explicit answer
  (Everyone + Uneven Shares only) in the first pass, then Current Crew
  was reintroduced in the later restructuring pass — see Added.
- Confirm button label simplified to "Log Round · $X.XX" / "Log Expense
  · $X.XX" (was "Log $X · N people").
- Expanded header spacing tightened (~15% padding reduction, shorter
  metric dividers, tighter stop/round-count placement).
- Bottom action tray padding trimmed (~15-20%).
- Crew intro row height bumped from the app-wide 44px floor to 56px
  (this row specifically called out as needing more presence).

### Notes
- Kind-toggle-reset-on-switch (Round ↔ Other wipes a manually-adjusted
  split) was asked about explicitly and never answered across multiple
  specs since — still original, pre-redesign behavior, still an open
  question, not a decision made by omission.
- Did not add a dirty-form confirmation on Cancel/× anywhere — no such
  pattern exists elsewhere in the app to reuse, and building one from
  scratch was explicitly out of scope ("do not create an intrusive
  confirmation for an untouched form").
- Did not invent an "uneven shares don't reconcile" validation state —
  shares are weight-based ratios, which can't mismatch by construction.
  Confirmed this reasoning twice across two separate specs that both
  asked for it.
- The two new child sheets (Edit Split, Round Details) don't have
  modal/`aria-modal` focus-trap semantics, matching the same reasoning
  applied to the original sheets — untrapped focus is better than a
  half-implemented trap.
- Live-device testing was not possible in this environment for any of
  today's scroll-threshold, safe-area, or Safari/PWA-specific work —
  flagged explicitly in each response rather than assumed to be correct.

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
