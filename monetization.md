# Monetization

Working notes on a monetization model for Last Call. Nothing here is built —
this is planning/reference material, not a spec for current code. Treat
figures and tiers as a starting proposal to revisit before committing to any
of it.

## Competitive landscape (checked July 2026)

Two genuinely different clusters of "close" competitors — worth keeping
separate, because they compete with different parts of this app, not the
whole thing.

**Ongoing ledger apps** — Splitwise (100M+ downloads, the category
default), Tricount, Settle Up, SplitMyExpenses. Built for *recurring*
shared expenses over weeks/months: roommates, rent, a multi-day trip.
Running balance, settle whenever. This is the opposite of what Last Call
is for — these want to remember your group forever; Last Call wants to
close out and forget. Splitwise's free tier has also gotten meaningfully
worse in 2026 (daily expense caps, forced ad countdowns before logging an
expense, receipt scanning paywalled to Pro) — a real opening for "the free
tier just isn't annoying," but not a moat, since they could reverse that
anytime.

**One-time receipt scanners** — splitty, Tab, splyt, Split Check,
TabSplit. This is the closer comparison in spirit: photograph a receipt,
everyone taps to claim their items, split calculated automatically,
Venmo/Cash App to settle. Some (Tab, TabSplit) already do live multi-
person collaboration on one bill via a shared code, which is the same
trick Last Call uses for a whole night, just scoped to a single check.
None of them model a *night* — no stops, no presence, no "who's still
here." Each is built and marketed around one receipt, one moment, done.

### What's actually different about Last Call, stated plainly

- **Presence-based, not receipt-based.** Nothing gets photographed or
  scanned. A round is logged the moment it happens, split among whoever's
  tapped in right now — there's no bill to reconstruct after the fact.
- **The whole night is the unit, not one bill.** Stops are a first-class
  concept; every receipt-scanner competitor is explicitly single-bill.
- **A session, not a ledger.** Deliberately the opposite of Splitwise/
  Tricount's core value prop — no persistent group to maintain, which is
  also exactly why "permanent history" is a plausible Plus feature and
  not a free-tier given (see below).
- **Tap-out changes live math**, not just who claims which line item.
- **Honest non-differentiator:** most competitors also just deep-link to
  Venmo/Cash App rather than moving money themselves. Last Call isn't
  ahead here, it's following the same safe pattern everyone already uses.

## Core principle

**Monetize the host, not the guests.** Nobody should need to pay, subscribe,
or create a full account just to join somebody else's night — that friction
would kill sharing. The person who starts the night is the customer; their
purchase unlocks premium features for the entire crew.

## Model: free core + Host Plus

### Free

Let people experience the complete concept:
- Join unlimited nights
- Start a limited number of nights
- Add rounds and stops
- Presence-based splitting, tap people out
- Basic equal/custom splits
- Final "Who Pays Who" calculation
- Share settlement amounts
- Keep recent night history
- Up to ~6 participants

**Do not paywall the final settlement** — holding the answer hostage after
everyone has already used the app would create instant resentment.

Context: Splitwise offers core tracking free and sells Pro features
(receipt scanning, charts, currency conversion, search, unlimited expense
entry). Tricount currently promotes its core expense-sharing as free and has
deprecated its former Premium subscription. Competitors have trained people
to expect basic expense splitting for free.

### Last Call Plus — $19.99/year

One host subscription unlocks premium features for everybody in nights that
person hosts:
- Unlimited hosted nights
- Unlimited or larger crews
- Permanent night history
- Recurring crews and saved friends
- Receipt photo scanning
- Food versus drinks splitting
- Item-level exclusions
- Custom percentage and weighted splits
- Shareable premium receipt / PDF export
- Detailed calculation breakdown
- Spending statistics
- Custom night names and receipt themes
- Reopen or correct completed nights
- Priority backup and restoration

At ~$1.67/month, it reads as inexpensive without making the product look
disposable.

### Night passes (for occasional hosts)

A subscription is a tough sell for someone who only goes out occasionally.

- **One Night Pass — $2.99**: unlocks all Plus features for one night, whole
  group included.
- **Party Pack — $6.99 for three premium nights**: a flat $2.99 loses a
  meaningful share to processing (Stripe's standard domestic-card pricing is
  2.9% + $0.30/transaction — that fixed $0.30 matters a lot on a $2.99 sale).
  The 3-pack reduces per-sale processing overhead and feels like better value
  than repeatedly charging $2.99.

Proposed pricing screen:
```
Hosting just tonight?        One Night — $2.99
Going out again?             3-Night Party Pack — $6.99
You're always the organizer. Last Call Plus — $19.99/year
```

## Launch strategy

### Beta period

Keep everything free while learning:
- How often people host
- Average crew size
- Which splitting options get used
- How many people return for another night
- Whether hosts share the invite successfully
- Where users abandon the process
- Which features people repeatedly request

Add a voluntary **"Buy us a round — $2.99"** support button after a
successful night — an early willingness-to-pay signal without blocking
adoption.

### Founding-member offer

Once the app is stable: **Founding Host — $29.99 lifetime**, limited to the
first 250 users. Could produce up to ~$7,497.50 in early gross revenue, help
cover hosting/dev costs, and create a committed tester group. **Don't leave
lifetime pricing available forever.**

### Normal pricing (post-founder period)

- Free
- $2.99 one-night pass
- $6.99 three-night pack
- $19.99 annual Plus

Skip monthly pricing initially — a $2.99–$3.99 monthly subscription is easy
to cancel and expensive to process relative to its price. Annual pricing
fits an app people may use irregularly.

## Features people are most likely to pay for

The strongest premium opportunities aren't cosmetic themes — they're
features that eliminate arguments or work:
- **Receipt scanning and itemization** — photograph the receipt, confirm
  items, assign food and drinks
- **Smarter participation rules** — "Eric had dinner but no drinks," "Mia
  joined at Stop 2," "Karen left before the final round"
- **Recurring crews** — start a new night with the same people in one tap
- **Permanent history and corrections** — view old nights, reopen one, fix a
  mistake, regenerate balances
- **Premium shareable recap** — branded receipt, playful statistics, payment
  links, clean social image

The receipt is where the product has personality: keep the basic receipt
free, give Plus users a better export, customization, detailed breakdown,
and permanent archive.

## What to avoid

- **Advertising** (as a primary model) — cheapens the product and reduces
  trust exactly when people are reviewing money. See Advertising section
  below for a more careful secondary-revenue take.
- **Charging every participant** — "download this app, and now pay before
  you can join" is a terrible group dynamic. Guests should always be free.
- **Taking a percentage of the night's spending** — a group spending $800
  didn't get 8x more value than one spending $100, and it makes people
  suspicious of the calculations.
- **Processing the actual repayments** — start with links/instructions for
  Venmo, Cash App, PayPal, Zelle, etc. rather than becoming the intermediary
  holding or moving the group's money. Payment-platform infrastructure adds
  cost and real operational complexity (Stripe's separate Connect product
  exists specifically for platforms that facilitate payments between
  parties).

## Advertising (secondary revenue only)

Ads could fit as a secondary stream — done badly they'd ruin the premium
nightlife feel; done carefully they monetize the guests who'll never buy a
host subscription.

### Model: one tasteful sponsor placement, only post-night

Show a single sponsored card only after the night is finished:
```
Tonight's recap is brought to you by [Sponsor]
Get home safely.
VIEW OFFER
```
Good placements: beneath the final receipt, on the completed-night summary,
in night history, on the home screen before starting another night.

**Never place ads while someone is:** adding a round, entering expenses,
tapping someone out, reviewing who owes whom, or completing settlement.
Those are trust-critical moments.

**Avoid normal banner ads** — no banner above the bottom actions or inside
Crew/Tonight tabs. It would make the app feel cheap and risks accidental
taps. (AdSense does support persistent anchor ads and full-screen vignette
ads between page navigations in a PWA — technically possible, but both
would be especially intrusive in a fast-moving group-expense workflow.)

Target feel: *"a cool tool that occasionally has a sponsor,"* not *"a free
website covered in programmatic ads."*

### Optional rewarded ads (later, especially with native apps)

E.g. "Unlock the premium receipt for tonight — watch one short ad," in
exchange for: premium shareable receipt, alternate receipt theme, PDF
export, extra playful statistics, 30-day history, one advanced receipt
scan, custom night cover. **Choice matters** — never force an ad to see a
debt or close the night.

### Ad-free by plan

| Plan | Advertising |
|---|---|
| Guest joining a free night | One end-of-night sponsor |
| Free host | Sponsor on completed receipt |
| One Night Pass | Ad-free for everyone that night |
| Party Pack | Ad-free for covered nights |
| Last Call Plus | Every hosted night is ad-free |

Framing: *"Last Call Plus hosts create ad-free nights for the entire crew."*

### Direct sponsors over ad networks

Branding is strong enough to eventually sell a small number of designed
sponsorships instead of random network ads. Natural categories: safe
transportation, late-night food, concerts/entertainment, event ticketing,
restaurants/venues, travel/group-experience brands. A sponsor package could
include branded final-receipt placement, one home-screen placement, a
custom offer code, a sponsored receipt theme, and aggregate campaign
reporting — **never** sharing individual tabs, participant names, purchase
amounts, or precise group activity with sponsors.

### Be cautious with alcohol advertising

The obvious category is alcohol, but it brings real complications — Google
treats alcohol as restricted content with limits based on location, age,
device, and format, plus extra restrictions on personalized alcohol ads.
The branding is smarter because it's about *going out*, not drinking — keep
it that way. Safe rides, food, entertainment, and venues give a much wider
audience.

### Start non-personalized

At launch: contextual ads, direct sponsors, no precise location targeting,
no spending-based targeting, no participant-level ad profiles.
Personalized advertising requires certified consent-management for the
EEA/UK/Switzerland and privacy messaging for applicable US state
requirements — not worth the administrative burden during early beta.

### Overall advertising recommendation

- Primary revenue: Plus subscriptions and night passes
- Secondary revenue: direct sponsors
- Optional later revenue: rewarded ads
- Avoid: persistent banners, forced videos, full-screen interstitials

The final receipt is emotional — the payoff of the night. A tasteful
sponsor directly beneath it could work well. A flashing ad across the
bottom would kill the product.

## Bottom-line recommendation

Launch with:
- Free joining, forever
- Free first three hosted nights
- $2.99 one-night premium pass
- $6.99 three-night party pack
- $19.99/year Last Call Plus
- $29.99 limited founding-member lifetime offer (first 250 only, not open-ended)

Gives virality (guests always free), an easy impulse purchase, and
recurring revenue, without turning a fun social app into a subscription
trap. The host pays, the whole crew benefits, and the core job — figuring
out who owes whom — always stays trustworthy and free to see.

## Open questions / not yet decided

- Actual willingness-to-pay is unvalidated — the "Buy us a round" beta
  button is meant to start generating that signal, not assumed in advance.
- None of the pricing, the founding-member cap, or the ad placements have
  been tested against real users.
- This assumes App Store / Play Store distribution eventually exists;
  current app is a web/PWA build with no payment processing wired up at all.
