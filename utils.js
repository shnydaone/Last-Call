/* ============================================================
   UTILS — pure helpers only. Nothing in this file reads or writes
   app state (me/night/members/...); everything here takes its
   inputs as arguments. That's what makes it safe to import from
   anywhere without circular-dependency risk.
   ============================================================ */
export const $  = s => document.querySelector(s);
export const money  = c => ((c === 0 ? 0 : c) / 100).toLocaleString('en-US', { style:'currency', currency:'USD' });
export const money0 = c => '$' + Math.round(c/100).toLocaleString();
export const clock  = ts => new Date(ts).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});

// Whole-hours-and-minutes span for the receipt's timeline — deliberately
// coarse (no seconds), matches the informal tone of a night out rather
// than reading like a stopwatch.
export function duration(startMs, endMs){
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  if(h === 0) return `${m}m`;
  if(m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
export const initials = n => (n||'?').slice(0,2).toUpperCase();

// Display-only grouping — "LASTCALL" → "LAST CALL". Purely cosmetic:
// the actual night.join_code, the input's submitted value, and the
// server-side match are all untouched. Never feed this back into a form.
export const groupCode = code => (code || '').replace(/(.{4})(?=.)/g, '$1 ');

// Web Share API first (native share sheet — Messages, WhatsApp, etc. on
// both iOS and Android), falling back to the existing sms: deep link
// where Share isn't available (most desktop browsers).
export async function shareInvite(code, title){
  const url = `${location.origin}${location.pathname}?code=${code}`;
  const text = `Join "${title}" on Last Call — code ${code}`;
  if(navigator.share){
    try{ await navigator.share({ title: 'Last Call', text, url }); return 'shared'; }
    catch(e){ if(e.name === 'AbortError') return 'cancelled'; }
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  location.href = (isIOS ? 'sms:&body=' : 'sms:?body=') + encodeURIComponent(`${text}\n${url}`);
  return 'sms-fallback';
}

export const PALETTE = ['#E8A33D','#FF4D8D','#3DD9B0','#8B7BFF','#FF8A5B','#6D9EEB','#F2C960'];
export const colorFor = id => PALETTE[[...id].reduce((a,c)=>a+c.charCodeAt(0),0) % PALETTE.length];

// Escapes free-typed user text before it goes into an innerHTML template.
// display_name/note/stop-name elsewhere in the app are short, server- or
// UI-constrained strings; the round description is the first genuinely
// open-ended, arbitrary-length field a person can type, so it gets this
// treatment specifically.
export const escapeHtml = s => (s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));
