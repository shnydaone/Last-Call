# Last Call

A session-based group ledger for nights out.

Five people, four bars, six hours, eleven rounds. Somebody bought the first one, somebody left at midnight, somebody joined at ten, and one guy was drinking doubles. At 1am nobody can reconstruct any of it, so the whole thing collapses into "just Venmo me twenty bucks" and someone quietly eats the difference.

Last Call keeps the ledger while the night is happening, then nets it down to two or three payments when someone calls it.

---

## Why not Splitwise

Splitwise is excellent at *ongoing* shared expenses — rent, utilities, a standing tab with a roommate. It has no concept of a night that starts, gets messy, and ends.

The bar-crawl problem is different in three ways:

1. **The group changes mid-session.** People arrive late and leave early. Every general-purpose splitter assumes a fixed group.
2. **The unit is the round, not the receipt.** "I got this one" — one tab, five ways, twelve seconds. Itemization is the exception, not the rule.
3. **The user is impaired.** Loud, dark, one-handed, 12% battery. Every interaction has to survive that.

The receipt-scan-and-split half of this space is thoroughly solved and commoditized. The session model is the part nobody owns.

---

## The core idea

**Presence is a property of the person, not a decision you make on every expense.**

Each member of a night has a window — joined 8:14, left 12:20. New expenses default their split to whoever was actually there at that moment. Tap someone out once when they leave, and every subsequent round skips them automatically.

The alternative is unticking a name seven times over the course of an evening, which nobody does, which is why group ledgers quietly go wrong.

Two axes, kept deliberately separate:

| | Meaning | Effect |
|---|---|---|
| **Presence** | Were they physically there? | Excluded from everything logged while away |
| **Not drinking** | DD, pregnant, off it tonight | Excluded from rounds only — still splits food, cabs, cover |

Collapsing these into one flag breaks the most common real case: the designated driver who buys a round for everyone else.

Presence sets the **default**. It doesn't enforce. Someone who left at midnight still owes for the tab they ran up before they went, so absent people stay tappable — just dimmed. Make the right thing easy, not the wrong thing impossible.

---

## What's in the repo

```
last-call-prototype.html    the working prototype — open it in a browser
drunken-nights-spec.md      schema, state machine, settlement algorithm
```

No build step, no dependencies, no install. Single file, opens in any browser. Fonts load from Google Fonts CDN; everything else is inline.

State is in-memory and resets on refresh. That's intentional — it's a design prototype, not a foundation.

---

## Try this

The prototype is seeded with a real night: five people, three stops, eight expenses, one late arrival, one early departure.

- **Crew tab** → tap someone out, then log a round. They're gone from the split without you touching their name.
- **Tap any expense** → edit it after the fact. Change the payer, drop someone, or open **Uneven shares** for the steppers. Dave's on 2× for the cocktail round.
- **Flag an expense** (⚑) → it drops out of the settle-up math but stays visible on the ledger. One argument about a $12 beer shouldn't block four people from squaring up.
- **Last Call** → closes pending items, nets the ledger, prints the tab. 27 debts collapse to 3 payments.

---

## Design decisions worth knowing

**Balances are derived, never stored.** Store immutable facts — an expense happened, these people were on it. Compute everything else on read. The moment you cache a balance you own a reconciliation problem, and you'll end up with a balances table that disagrees with the expense log.

**Silence is acceptance.** Expenses land as `pending` and auto-confirm after a grace period. There is no "approve" button — requiring five people to tap approve on every round at 11:40pm means the ledger is permanently half-approved and someone's phone is dead. The only action is *flag*, for the one person who got charged for a round they weren't there for.

**Tip is stored separately from base.** Always. Tips get added later, changed, and left in cash on the table. Fold it into the total and you can never answer "did we actually tip on this?" — and cash tips are the number one reason a night doesn't reconcile.

**Integer cents, deterministic remainders.** $67 split five ways doesn't divide cleanly. Distribute remainder pennies to participants sorted by ID, and assert that allocations sum exactly to the expense on every write. Assert that net balances sum to zero before settling. You want to find rounding bugs at write time, not at 2am.

**We never move money.** Settlement emits Venmo/Zelle deep links and an honour-system `marked_paid` flag. Holding funds makes you a money transmitter with 50-state licensing exposure. Every competitor sidesteps it the same way.

---

## The settlement algorithm

Two steps.

**Net everyone to a single number.**

```
net[p] = Σ(what p paid) − Σ(p's share of every expense)
```

**Greedy max-match.** Sort creditors and debtors by magnitude, repeatedly settle the largest against the largest, drop whichever hits zero.

Produces at most N−1 payments, and typically 2–3 for a group of five. The receipt screen shows the collapse — "27 debts → 3 payments" — because that's the payoff moment.

Minimizing payment *count* is NP-hard in the general case. Greedy isn't provably optimal but lands within one payment of optimal at any realistic group size, and it runs instantly. Don't build the exact solver. Nobody will notice, and you'd be optimizing a five-element set.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Round logging, presence windows, settle-up, deep links | prototyped |
| 2 | Real backend, multi-user sync, morning-after recap | not started |
| 3 | Receipt OCR, itemized splits | not started |
| 4 | Multi-night history, crew presets, venue stats | not started |

**Known gap:** stop selection is implicit. New expenses attach to the last stop in the list, and there's no way to say "we moved." The plan is a four-layer fallback — time gap → coarse location sampled at expense time → nearby-venue chips → merchant name backfilled from a scanned receipt — with location sampled only when an expense is logged, never continuously. A nightlife app that kills your battery is self-defeating.

**Deliberately deferred:** venue discovery, live friend maps, deals feeds. Different app, different economics, crowded market.

Resist building the OCR first because it's the interesting engineering problem. What determines whether this lives or dies is whether logging a round is faster than typing "venmo me 14" into a group chat.

---

## Naming

Working title was *Drunken Nights*. Retired for three reasons: App Store review gets twitchy about apps that read as encouraging heavy drinking; it hard-codes a ceiling, since the same ledger works for ski weekends and group dinners; and it fails the say-it-out-loud test.

*Last Call* is bar-native without saying drunk, means the moment the app matters, and — the actual argument — doubles as the primary button. The brand name *is* the core action.

Not yet cleared: App Store name search, USPTO classes 9 and 42, domain.
