// Canonical settlement presentation layer.
//
// This exists because different screens were independently deciding how
// to talk about the same numbers — Crew said "Owes $11.54", the Tab said
// "ALL SQUARE" / "No payments needed" even mid-transfer, and the debt
// count used netting-graph language ("3 debts → 0 payments") nobody
// outside this codebase would parse. Same underlying data, three
// different vocabularies. This module is the fix: every screen that
// describes who owes/receives/is settled goes through these three
// functions, so no two screens can contradict each other again.
//
// Sign convention (confirmed against the actual night_balance view
// definition, not assumed): net_cents = paid_cents - owed_cents.
// Positive means you paid more than your calculated share, so money
// comes back to you. Negative means you paid less than your share, so
// you owe the difference. Verified against the Eric/Joe example:
// Eric paid $108.08, share $96.54, net = +$11.54 → gets back $11.54.
// Joe paid $85.00, share $96.54, net = -$11.54 → owes $11.54.
//
// This module does not calculate anything — it only describes numbers
// that settle_night() / night_balance already produced.

import { money } from './utils.js';

// Participant-level result: what does THIS person's net_cents mean?
// Math.round(...) || 0 also normalizes -0 to 0 (the || 0 catches it,
// since -0 is falsy in JS) before the zero-check runs, on top of the
// money() fix at the formatting layer itself — belt and suspenders,
// since this is the exact class of bug the spec called out by name.
export function settlementFor(netCents){
  const cents = Math.round(netCents) || 0;
  if(cents === 0) return { type: 'settled',  label: 'Settled', cls: 'settled' };
  if(cents > 0)   return { type: 'receives', label: `Gets back ${money(cents)}`, cls: 'pos' };
  return            { type: 'owes',     label: `Owes ${money(Math.abs(cents))}`, cls: 'neg' };
}

// Relationship-level: one settlement transfer between two named people.
// instructionLabel is the primary/action wording ("Joe pays Eric"),
// explanationLabel is the supporting wording ("Joe owes Eric $11.54") —
// both canonical per the spec, used for different contexts (a card
// headline vs. a share-summary line), never invented ad hoc per screen.
export function transferInstruction(payerName, receiverName, amountCents){
  const amt = money(amountCents);
  return {
    payerName, receiverName,
    amountLabel: amt,
    instructionLabel: `${payerName} pays ${receiverName}`,
    explanationLabel: `${payerName} owes ${receiverName} ${amt}`
  };
}

// Night-level: summarizes a set of transfers (pass the same non-dust
// `collect` array every screen already filters plan down to — this
// does not re-derive that filtering, just describes whatever list it's
// given). isSettled is true only when every transfer is marked_paid;
// a calculation with even one pending transfer is not settled, per the
// spec's explicit "everyone is settled" definition.
export function nightSettlementSummary(transfers){
  const outstanding = transfers.filter(t => t.status !== 'marked_paid');
  const n = outstanding.length;
  return {
    isSettled: n === 0,
    outstandingTransferCount: n,
    outstandingAmountCents: outstanding.reduce((s,t) => s + t.amount_cents, 0),
    summaryLabel: n === 0 ? 'Everyone is settled' : `${n} payment${n===1?'':'s'} remaining`
  };
}
