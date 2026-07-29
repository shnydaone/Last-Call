import { sb, DUST_CENTS, PLAYFUL_SUMMARIES } from './config.js';
import { $, money, money0, clock, initials, groupCode, shareInvite, colorFor, escapeHtml } from './utils.js';
import { brandBlock, compactMark } from './brand.js';
import { renderInviteQR } from './qr.js';


/* ============================================================
   STATE
   ============================================================ */
let me = null;              // person row
let night = null;
let members = [];           // night_member joined to person
let stops = [];
let expenses = [];          // with allocations attached
let balances = [];
let plan = [];              // settle_night rows
let crewIntroOpen = false;  // Crew intro card starts collapsed; <details> loses
                             // its own open state whenever we rebuild the pane's
                             // innerHTML, so this is the real source of truth.


const M   = id => members.find(m => m.person_id === id);
const nameOf = id => M(id)?.person?.display_name ?? '???';
const isHost = () => night && me && night.host_id === me.id;
const isOpen = () => night && night.status !== 'closed';
const presentAt = (m, at) =>
  new Date(m.joined_at) <= at && (m.left_at === null || new Date(m.left_at) > at);
const totalOf = e => e.base_cents + e.tip_cents;
const sumW = e => e.allocation.reduce((s,a)=>s+Number(a.weight),0);

/* ============================================================
   BOOT
   ============================================================ */
async function signInFresh(){
  const { data, error } = await sb.auth.signInAnonymously();
  if(error){
    overlay('Not connected',
      error.message.match(/disabled|not enabled/i)
        ? 'Anonymous sign-ins are turned off.<br><br>Enable them in the dashboard:<br><code>Auth → Providers → Anonymous Sign-ins</code>'
        : 'Sign-in failed: ' + error.message);
    return null;
  }
  return data.session;
}

// Fetch this session's person row. If it's missing — a stale cached
// session from before the row existed, or from before anon auth was
// even switched on — sign out, mint a fresh anonymous session, and
// try once more rather than crash three lines later on a null.
async function fetchOrHealPerson(session, alreadyRetried){
  const { data: person, error } = await sb.from('person')
    .select('*').eq('id', session.user.id).maybeSingle();

  if(error) throw new Error('Could not load your profile: ' + error.message);
  if(person) return person;

  if(alreadyRetried){
    throw new Error('Signed in, but no matching profile exists, and a fresh session didn\'t fix it. ' +
      'The handle_new_user trigger may be missing.');
  }

  overlay('Repairing session','Found a stale sign-in — starting fresh…');
  await sb.auth.signOut();
  const fresh = await signInFresh();
  if(!fresh) throw new Error('Could not create a fresh session.');
  return fetchOrHealPerson(fresh, true);
}

async function boot(){
  overlay('Connecting','Signing you in…');
  let { data: { session } } = await sb.auth.getSession();

  if(!session){
    session = await signInFresh();
    if(!session) return;   // signInFresh already showed the error overlay
  }

  me = await fetchOrHealPerson(session, false);

  // Keep is_permanent in sync with the JWT. This is what makes the
  // "click the email link, land back here" path just work — no
  // special-casing needed for the return trip.
  const { data: nowPermanent } = await sb.rpc('sync_permanence');
  if(typeof nowPermanent === 'boolean') me.is_permanent = nowPermanent;

  const code = new URLSearchParams(location.search).get('code') || '';
  const { data: existing, error: exErr } = await sb.from('night_member')
    .select('night_id').eq('person_id', me.id)
    .order('joined_at', { ascending: false }).limit(1);
  if(exErr) throw new Error('Could not check night membership: ' + exErr.message);

  if(existing?.length){
    await load(existing[0].night_id);
  } else {
    await promptJoin(code);
  }
}

function promptJoin(code){
  overlay('', 'Join a night already in progress.');
  $('#ovTitle').innerHTML = brandBlock();
  $('#ovBody').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px;width:100%">
      <label class="field-label" for="joinCode">Invite code</label>
      <input id="joinCode" class="code-field" value="${code}" placeholder="e.g. LASTCALL" maxlength="12" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false">
      <label class="field-label" for="joinName">Your name</label>
      <input id="joinName" placeholder="e.g. Sam" maxlength="24" autocomplete="name">
      <div class="field-error" id="joinErr" style="display:none"></div>
      <button id="joinGo" style="margin-top:4px">Join Night</button>

      <div class="divider" style="margin-top:10px"><span class="bar"></span>or<span class="bar"></span></div>

      <div style="font-size:13px;color:var(--dim);margin-top:2px">Hosting tonight?</div>
      <button class="secondary" id="goStart">Start a Night</button>

      <div style="font-size:13px;color:var(--dim);margin-top:6px">Already hosted before?</div>
      <button class="secondary" id="goSignIn">Sign In</button>
    </div>`;

  // Live-format as you type: uppercase, no spaces. The server already
  // does upper(trim(...)) on submit — this is purely so what you see
  // matches what will actually be checked, nothing more.
  $('#joinCode').oninput = e => {
    const pos = e.target.selectionStart;
    const before = e.target.value.length;
    e.target.value = e.target.value.toUpperCase().replace(/\s+/g, '');
    const after = e.target.value.length;
    e.target.setSelectionRange(pos - (before - after), pos - (before - after));
    e.target.classList.remove('input-error');
  };

  $('#joinGo').onclick = async () => {
    const c = $('#joinCode').value.trim();
    const n = $('#joinName').value.trim() || 'Guest';
    const err = $('#joinErr');
    err.style.display = 'none';
    $('#joinCode').classList.remove('input-error');

    if(!c){ $('#joinCode').classList.add('input-error'); err.textContent = 'Enter the invite code.'; err.style.display='block'; return; }

    $('#joinGo').disabled = true;
    $('#joinGo').textContent = 'Joining…';
    const { data, error } = await sb.rpc('join_night', { p_code: c, p_display_name: n });
    if(error){
      err.textContent = error.message; err.style.display = 'block';
      $('#joinGo').disabled = false; $('#joinGo').textContent = 'Join Night';
      return;
    }
    const { data: person, error: pErr } = await sb.from('person').select('*').eq('id', me.id).single();
    if(pErr || !person){
      err.textContent = 'Joined, but could not reload your profile: ' + (pErr?.message ?? 'not found');
      err.style.display = 'block';
      $('#joinGo').disabled = false; $('#joinGo').textContent = 'Join Night';
      return;
    }
    me = person;
    await load(data);
  };
  $('#goStart').onclick = () => promptStart();
  $('#goSignIn').onclick = () => promptSignIn();
}

function promptSignIn(){
  overlay('Sign in', 'Get back into an account you\'ve already linked an email to.');
  $('#ovBody').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px;width:100%">
      <label class="field-label" for="signInEmail">Email</label>
      <input id="signInEmail" type="email" placeholder="you@example.com" autocomplete="email">
      <div class="field-error" id="signInErr" style="display:none"></div>
      <button id="sendSignIn" style="margin-top:4px">Send Sign-In Link</button>
      <button class="secondary" id="backToJoin3">Back</button>
    </div>`;
  $('#sendSignIn').onclick = async () => {
    const email = $('#signInEmail').value.trim();
    const err = $('#signInErr');
    err.style.display = 'none';
    $('#signInEmail').classList.remove('input-error');
    if(!email){ $('#signInEmail').classList.add('input-error'); err.textContent = 'Enter your email.'; err.style.display='block'; return; }

    $('#sendSignIn').disabled = true;
    $('#sendSignIn').textContent = 'Sending…';
    const redirectTo = location.href.split('?')[0].split('#')[0];
    // shouldCreateUser:false — this is for someone getting back into an
    // account they already have, not creating a new one. If the email
    // isn't registered yet, error out and point them at Start instead.
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
    });
    if(error){
      err.textContent = error.message.match(/signup|not allowed|not found/i)
        ? 'No account found for that email — use "Start a Night" to create one.'
        : error.message;
      err.style.display = 'block';
      $('#sendSignIn').disabled = false; $('#sendSignIn').textContent = 'Send Sign-In Link';
      return;
    }
    overlay('Check your email', `Sent a sign-in link to <code>${email}</code>.<br><br>Tap it — you'll land back here signed in, on any device.`);
  };
  $('#backToJoin3').onclick = () => promptJoin(new URLSearchParams(location.search).get('code') || '');
}

function promptStart(){
  overlay('Start a Night Out', 'Give it a name — or skip and we\'ll date-stamp it.');
  $('#ovBody').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px;width:100%">
      <label class="field-label" for="hostName">Your name</label>
      <input id="hostName" placeholder="e.g. Rick" maxlength="24" autocomplete="name"
        value="${me.display_name && me.display_name !== 'Guest' ? me.display_name : ''}">
      <label class="field-label" for="nightTitle">Night name (optional)</label>
      <input id="nightTitle" placeholder="e.g. Dave's Birthday" maxlength="60">
      <label class="field-label" for="startStopName">Where does the night begin? (optional)</label>
      <input id="startStopName" placeholder="e.g. Marlowe's" maxlength="60">
      <button id="createGo" style="margin-top:4px">Create Night</button>
      <button class="secondary" id="backToJoin">Back</button>
    </div>`;
  $('#createGo').onclick = async () => {
    $('#createGo').disabled = true;
    $('#createGo').textContent = 'Creating…';
    const { data, error } = await sb.rpc('create_night', {
      p_title: $('#nightTitle').value.trim() || null,
      p_display_name: $('#hostName').value.trim() || null
    });
    if(error){
      $('#ovSub').textContent = error.message;
      $('#createGo').disabled = false; $('#createGo').textContent = 'Create Night';
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const { data: person } = await sb.from('person').select('*').eq('id', me.id).single();
    if(person) me = person;

    // create_night() already auto-creates Stop 1 (unnamed) server-side —
    // this just names it, same table/RLS path "We moved" already uses to
    // create later stops. Not fatal if it fails: the night's already
    // created either way, this is a nice-to-have, not a blocker.
    const stopName = $('#startStopName').value.trim();
    if(stopName){
      const { error: stopErr } = await sb.from('stop')
        .update({ name: stopName }).eq('night_id', row.night_id).eq('seq', 1);
      if(stopErr) console.error('Could not name the first stop:', stopErr);
    }

    showNightCreated(row.night_id, row.join_code);
  };
  $('#backToJoin').onclick = () => promptJoin(new URLSearchParams(location.search).get('code') || '');
}

function showNightCreated(nightId, code){
  overlay('Night Out Started', 'Share this code, or let them scan in.');
  const inviteUrl = `${location.origin}${location.pathname}?code=${code}`;
  $('#ovBody').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px;width:100%">
      <div class="code-display">${groupCode(code)}</div>
      <div class="qr-wrap"><canvas id="qrCanvas"></canvas></div>
      <button id="shareInviteBtn" style="margin-top:4px">Share Invite</button>
      <button class="secondary" id="copyCode">Copy Code</button>
      <button id="goInside" style="margin-top:8px">Open the Night</button>
    </div>`;
  // Dark-on-light regardless of app theme — QR scanability needs real
  // contrast, not palette-matching. Not yet confirmed against a live phone
  // camera (see handoff open gaps); encodes the exact same invite URL that
  // Share/Copy use, nothing derived separately.
  renderInviteQR($('#qrCanvas'), inviteUrl).catch(e => console.error('QR render failed:', e));
  $('#shareInviteBtn').onclick = async () => {
    const result = await shareInvite(code, 'your night');
    if(result === 'shared') toast('Shared');
  };
  $('#copyCode').onclick = async () => {
    try{
      await navigator.clipboard.writeText(code);
      const btn = $('#copyCode');
      btn.classList.add('copied'); btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy Code'; }, 1800);
      toast('Copied');
    } catch { toast('Copy failed — code is ' + code, true); }
  };
  $('#goInside').onclick = () => load(nightId);
}

async function load(nightId){
  overlay('Loading','Pulling the tab…');

  const [n, mem, st, exp, bal] = await Promise.all([
    sb.from('night').select('*').eq('id', nightId).single(),
    sb.from('night_member').select('*, person(*)').eq('night_id', nightId),
    sb.from('stop').select('*').eq('night_id', nightId).order('seq'),
    sb.from('expense').select('*, allocation(*)').eq('night_id', nightId).order('occurred_at'),
    sb.from('night_balance').select('*').eq('night_id', nightId),
  ]);

  night    = n.data;
  members  = (mem.data || []).sort((a,b)=> new Date(a.joined_at) - new Date(b.joined_at));
  stops    = st.data || [];
  expenses = exp.data || [];
  balances = bal.data || [];

  await refreshPlan();
  hideOverlay();
  subscribe(nightId);
  renderAll();
}

async function refreshPlan(){
  if(!night) return;

  if(night.status === 'closed'){
    // Once closed, the settlement is a fact of record — read the
    // snapshot written at close time, not a live recomputation. A live
    // recompute is exactly what broke: if anyone with financial
    // history leaves afterward, the ledger can no longer balance and
    // this silently returned nothing instead of the real numbers.
    const { data, error } = await sb.from('settlement').select('*').eq('night_id', night.id);
    if(error){ console.error(error); plan = []; return; }
    plan = (data || []).map(s => ({
      id: s.id, from_person: s.from_person, to_person: s.to_person,
      amount_cents: s.amount_cents, is_dust: false, status: s.status
    }));
    return;
  }

  const { data, error } = await sb.rpc('settle_night',
    { p_night_id: night.id, p_dust_cents: DUST_CENTS });
  if(error) console.error('settle_night failed:', error);
  plan = error ? [] : (data || []);
}

/* live sync — any write by anyone reloads the affected slices */
let currentChannel = null;
function subscribe(nightId){
  if(currentChannel) sb.removeChannel(currentChannel);
  currentChannel = sb.channel('night:' + nightId)
    .on('postgres_changes', { event:'*', schema:'public', table:'expense',      filter:`night_id=eq.${nightId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'allocation'    }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'night_member', filter:`night_id=eq.${nightId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'night',        filter:`id=eq.${nightId}` }, refresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'stop',         filter:`night_id=eq.${nightId}` }, refresh)
    .subscribe(status => {
      if(status === 'SUBSCRIBED' && night){
        const t = $('#htLive');
        t.className = 'ht-live' + (isOpen() ? '' : ' closed');
        t.innerHTML = `<span class="dot"></span>${isOpen() ? 'Live' : 'Ended'}`;
      }
    });
}

let refreshT;
function refresh(){
  clearTimeout(refreshT);
  refreshT = setTimeout(async () => {
    const [n, mem, st, exp, bal] = await Promise.all([
      sb.from('night').select('*').eq('id', night.id).single(),
      sb.from('night_member').select('*, person(*)').eq('night_id', night.id),
      sb.from('stop').select('*').eq('night_id', night.id).order('seq'),
      sb.from('expense').select('*, allocation(*)').eq('night_id', night.id).order('occurred_at'),
      sb.from('night_balance').select('*').eq('night_id', night.id),
    ]);
    night    = n.data ?? night;
    members  = (mem.data || members).sort((a,b)=> new Date(a.joined_at) - new Date(b.joined_at));
    stops    = st.data || stops;
    expenses = exp.data || expenses;
    balances = bal.data || balances;
    await refreshPlan();
    renderAll();
  }, 220);
}

/* ============================================================
   RENDER
   ============================================================ */
const avatar = id => `<div class="av" style="background:${colorFor(id)}">${initials(nameOf(id))}</div>`;

let currentTab = 'tonight';

function renderHeader(){
  if(!night) return;
  const now = new Date();
  const live = expenses.filter(e => e.status !== 'disputed' && e.status !== 'void');
  const grand = live.reduce((s,e)=> s + totalOf(e), 0);
  $('#htName').textContent = night.title;
  // money() — the exact same cents-precise formatter used for every
  // expense/settlement amount elsewhere — not a second rounding path.
  $('#htTotal').textContent = money(grand);

  const activeCount = members.filter(m => presentAt(m, now)).length;
  $('#htStatus').textContent = !isOpen() ? 'Night ended'
    : activeCount === 0 ? 'Everyone left'
    : `${activeCount} out`;

  const liveEl = $('#htLive');
  liveEl.className = 'ht-live' + (isOpen() ? '' : ' closed');
  liveEl.innerHTML = `<span class="dot"></span>${isOpen() ? 'Live' : 'Ended'}`;
  liveEl.setAttribute('aria-label', isOpen() ? 'Night is live' : 'Night has ended');

  updateFabVisibility();
  updateNightMenu();

  const lcFab = $('#btnLastCallFab');
  if(lcFab){
    lcFab.disabled = !isHost();
    lcFab.title = isHost() ? 'Close the night' : `Only ${nameOf(night.host_id)} can close the night`;
  }
}

function renderTonight(){
  const events = [];
  expenses.forEach(e => events.push({ t: new Date(e.occurred_at), type:'exp', e }));
  members.forEach(m => {
    const first = members[0] && new Date(members[0].joined_at);
    if(first && new Date(m.joined_at) - first > 60000) events.push({ t:new Date(m.joined_at), type:'in', m });
    if(m.left_at) events.push({ t:new Date(m.left_at), type:'out', m });
  });

  const buckets = stops.map((s,i) => {
    const from = new Date(s.arrived_at);
    const to   = stops[i+1] ? new Date(stops[i+1].arrived_at) : new Date(8640000000000000);
    return { s, i, rows: events.filter(v => v.t >= from && v.t < to).sort((a,b)=>a.t-b.t) };
  }).filter(b => b.rows.length);

  const html = buckets.map(({s,i,rows}) => {
    const sub = rows.filter(v => v.type==='exp' && v.e.status!=='disputed').reduce((a,v)=>a+totalOf(v.e),0);
    return `<div class="stop">
      <div class="stop-head">
        <div class="stop-idx">${i+1}</div>
        <div class="stop-name">${s.name ?? 'Stop ' + (i+1)}</div>
        <div class="stop-time">${clock(s.arrived_at)} · ${money0(sub)}</div>
      </div>
      ${rows.map(v => {
        if(v.type !== 'exp'){
          return `<div class="tapline ${v.type}"><span class="bar"></span>
            ${nameOf(v.m.person_id)} ${v.type==='in'?'tapped in':'tapped out'} · ${clock(v.t)}
            <span class="bar"></span></div>`;
        }
        const e = v.e, uneven = e.allocation.some(a => Number(a.weight) !== 1);
        const participants = e.allocation.length;
        // "N-way"/"shares" was internal bill-splitting jargon on the card
        // itself; plain participant count now, uneven split still called
        // out in words. The exact per-person weight math is untouched and
        // still lives in the edit sheet where it's actually adjusted.
        const participantPhrase = participants === 1 ? '1 participant'
          : uneven ? `${participants} participants · uneven split`
          : `${participants} participants`;
        const stopLabel = s.name ?? 'Stop ' + (i+1);
        return `<div class="exp ${e.status}" ${isOpen() ? `data-edit="${e.id}" role="button" tabindex="0"` : ''}>
          ${avatar(e.payer_id)}
          <div class="exp-mid">
            <div class="exp-head">
              <div class="exp-note">${e.note ?? 'Expense'}</div>
              ${e.status==='disputed' ? '<span class="exp-flagtag">Flagged</span>' : ''}
            </div>
            <div class="exp-meta">${nameOf(e.payer_id)} paid · ${participantPhrase}</div>
            ${e.description ? `<div class="exp-desc">${escapeHtml(e.description)}</div>` : ''}
            <div class="exp-sub">${clock(e.occurred_at)} · ${stopLabel}${e.tip_cents ? ` · ${money(e.tip_cents)} tip` : ''}</div>
          </div>
          <div class="exp-amt-col">
            <div class="exp-amt">${money(totalOf(e))}</div>
            <button class="receipt-btn ${e.receipt_url?'on':''}" data-receipt="${e.receipt_url?e.id:''}"
              aria-label="${e.receipt_url ? 'View attached receipt' : 'No receipt attached'}"
              title="${e.receipt_url ? 'View receipt' : 'No receipt attached'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
          </div>
          <button class="flag ${e.status==='disputed'?'on':''}" data-flag="${e.id}"
            aria-label="${e.status==='disputed' ? 'Remove dispute flag — include this back in the tab' : 'Flag as disputed — hold this out of the tab'}"
            title="${e.status==='disputed' ? 'Unflag' : 'Flag as disputed'}">
            <span class="flag-ico" aria-hidden="true">⚑</span><span class="flag-lbl">${e.status==='disputed'?'Flagged':'Flag'}</span>
          </button>
          ${isOpen() ? '<span class="exp-chev" aria-hidden="true">›</span>' : ''}
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  $('#pane-tonight').innerHTML = html || `<div class="empty-tonight">
      <div class="empty-title">No rounds yet</div>
      <p class="empty-sub">Add the first round and choose who was included.</p>
      <button class="empty-cta" id="emptyAddRound">+ Add First Round</button>
    </div>`;

  if($('#emptyAddRound')) $('#emptyAddRound').onclick = () => openAdd('round');

  $('#pane-tonight').querySelectorAll('[data-flag]').forEach(b => b.onclick = async ev => {
    ev.stopPropagation();
    const e = expenses.find(x => x.id === b.dataset.flag);
    const next = e.status === 'disputed' ? 'confirmed' : 'disputed';
    const { error } = await sb.from('expense').update({ status: next }).eq('id', e.id);
    if(error) return toast(error.message, true);
    toast(next === 'disputed' ? 'Flagged — held out of the tab' : 'Unflagged');
  });
  // Only wired when a receipt actually exists (data-receipt is empty
  // otherwise) — with nothing attached, the tap just bubbles up to the
  // card's own edit handler, which is exactly where attaching happens.
  $('#pane-tonight').querySelectorAll('[data-receipt]:not([data-receipt=""])').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const e = expenses.find(x => x.id === b.dataset.receipt);
    if(e?.receipt_url) viewReceipt(e.receipt_url);
  });
  $('#pane-tonight').querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = () => openEdit(b.dataset.edit);
    b.onkeydown = ev => {
      if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); openEdit(b.dataset.edit); }
    };
  });
}

// Full-size receipt view — reuses the existing overlay() mechanism (same
// one used for Connecting/Join/the info guide), no new modal machinery.
function viewReceipt(url){
  overlay('Receipt', '');
  const isImage = /\.(jpe?g|png|gif|webp|heic|heif)(\?|$)/i.test(url);
  $('#ovBody').innerHTML = isImage
    ? `<img src="${url}" alt="Receipt photo" class="receipt-view-img">
       <button id="receiptViewClose" style="margin-top:14px">Close</button>`
    : `<p class="hint" style="margin-bottom:14px">This receipt is a file, not a photo — open it to view it.</p>
       <a class="confirm" href="${url}" target="_blank" rel="noopener" style="display:block;text-decoration:none;text-align:center">Open Receipt</a>
       <button id="receiptViewClose" style="margin-top:10px">Close</button>`;
  $('#receiptViewClose').onclick = hideOverlay;
}

function renderCrew(){
  const now = new Date();
  const t0 = members.length ? new Date(members[0].joined_at) : now;
  const span = Math.max(now - t0, 1);

  $('#pane-crew').innerHTML =
    `<details class="crew-intro" id="crewIntro" ${crewIntroOpen ? 'open' : ''}>
      <summary class="crew-intro-summary">
        <span class="crew-intro-head">Only pay for what you were there for</span>
        <span class="crew-intro-hint">Join code &amp; share</span>
      </summary>
      <div class="crew-intro-body">
        <p style="margin:0">People only split expenses logged while they're out.<br>Tap someone out when they leave.</p>
        ${isHost() ? `<div class="crew-code-row">
            <span class="crew-code-label">Join code:</span>
            <span class="code-chip">${night.join_code}</span>
            <button class="crew-btn primary" id="btnShareInvite">Share Invite</button>
            <button class="crew-btn ghost" id="btnCopyCode">Copy Code</button>
          </div>` : ''}
      </div>
    </details>` +
    `<div class="section-lbl">Who was out</div>` +
    members.map(m => {
      const b = balances.find(x => x.person_id === m.person_id) ?? {paid_cents:0,owed_cents:0,net_cents:0};
      const jt = new Date(m.joined_at), lt = m.left_at ? new Date(m.left_at) : now;
      const start = ((jt - t0)/span)*100, end = ((lt - t0)/span)*100;
      const here = presentAt(m, now);
      const isMe = m.person_id === me.id;
      const canEdit = isMe || isHost();

      // Presence state in one sentence — the two things eligible() actually
      // checks (presentAt, and is_dry for round-kind only), nothing more.
      const stateLine = here
        ? `Still out since ${clock(m.joined_at)}${m.is_dry ? ' <span class="qual">· off rounds</span>' : ''}`
        : `Left at ${clock(m.left_at)}`;

      const netLabel = b.net_cents >= 0 ? 'Is owed' : 'Owes';
      const netClass = b.net_cents >= 0 ? 'pos' : 'neg';

      const timelineAria = here
        ? `Present from ${clock(m.joined_at)} to now`
        : `Present from ${clock(m.joined_at)} to ${clock(m.left_at)}`;

      // The rounds toggle only ever excludes someone from round-kind
      // expenses (see eligible() — the is_dry check is gated on
      // kind==='round'). It has no effect on food/other expenses, so the
      // explanation says that explicitly rather than leaving it implied.
      const dryExplain = 'Excludes them from drink-round expenses only — food and other expenses still include them while present.';

      return `<div class="prow">
        <div class="ptop">
          ${avatar(m.person_id)}
          <div class="pname">${m.person.display_name}${isMe?' (you)':''}
            ${m.role==='host'?'<span class="ptag tag-host">Host</span>':''}</div>
        </div>
        <div class="pstate">${stateLine}</div>
        <div class="pnums">
          <span class="lbl">Paid</span><span class="val">${money(b.paid_cents)}</span>
          <span class="lbl">Current share</span><span class="val">${money(b.owed_cents)}</span>
          <span class="lbl">${netLabel}</span><span class="val strong ${netClass}">${money(Math.abs(b.net_cents))}</span>
        </div>
        <div class="track" role="img" aria-label="${timelineAria}">
          <div class="span" style="left:${start}%;width:${Math.max(end-start,2)}%;background:${colorFor(m.person_id)}"></div>
        </div>
        <div class="pmeta"><span>Arrived ${clock(m.joined_at)}</span>
          <span>${m.left_at ? 'Left ' + clock(m.left_at) : 'Present now'}</span></div>
        ${canEdit && isOpen() ? `<div class="pbtns">
          <button class="mini-btn warn ${!here?'on':''}" data-tap="${m.person_id}">${here?'Tap Out':'Tap Back In'}</button>
          <button class="mini-btn ${m.is_dry?'on':''}" data-dry="${m.person_id}"
            title="${dryExplain}" aria-label="${m.is_dry ? 'Include back in rounds. ' : 'Skip rounds. '}${dryExplain}">${m.is_dry?'Include in Rounds':'Skip Rounds'}</button>
        </div>` : ''}
      </div>`;
    }).join('');

  $('#pane-crew').querySelectorAll('[data-tap]').forEach(b => b.onclick = async () => {
    const m = M(b.dataset.tap), now = new Date();
    const patch = presentAt(m, now) ? { left_at: now.toISOString() } : { left_at: null };
    const { error } = await sb.from('night_member').update(patch)
      .eq('night_id', night.id).eq('person_id', m.person_id);
    if(error) return toast(error.message, true);
    toast(patch.left_at ? `${nameOf(m.person_id)} tapped out` : `${nameOf(m.person_id)} is back in`);
  });
  $('#pane-crew').querySelectorAll('[data-dry]').forEach(b => b.onclick = async () => {
    const m = M(b.dataset.dry);
    const { error } = await sb.from('night_member').update({ is_dry: !m.is_dry })
      .eq('night_id', night.id).eq('person_id', m.person_id);
    if(error) return toast(error.message, true);
  });

  const si = $('#btnShareInvite');
  if(si) si.onclick = async () => {
    const result = await shareInvite(night.join_code, night.title);
    if(result === 'shared') toast('Shared');
  };
  // Same clipboard pattern already used on the "Night Out Started" screen —
  // not a new copy mechanism, just available here too, ongoing.
  const cc = $('#btnCopyCode');
  if(cc) cc.onclick = async () => {
    try{
      await navigator.clipboard.writeText(night.join_code);
      cc.classList.add('copied'); cc.textContent = 'Copied ✓';
      setTimeout(() => { cc.classList.remove('copied'); cc.textContent = 'Copy Code'; }, 1800);
      toast('Copied');
    } catch { toast('Copy failed — code is ' + night.join_code, true); }
  };

  const ci = $('#crewIntro');
  ci.ontoggle = () => { crewIntroOpen = ci.open; };
}

function confirmSwitchNight(){
  overlay('Switch away from this night?', 'You\'re not leaving — you\'ll still be a member here. This just takes you to the chooser so you can join or start another.');
  $('#ovBody').innerHTML = `
    <div style="display:flex;gap:10px;width:100%;max-width:260px;margin-top:6px">
      <button id="switchCancel" style="flex:1;background:none;border:1px solid var(--line);color:var(--paper)">Stay here</button>
      <button id="switchConfirm" style="flex:1;background:var(--amber);color:var(--ink)">Switch</button>
    </div>`;
  $('#switchCancel').onclick = hideOverlay;
  $('#switchConfirm').onclick = () => {
    // Doesn't delete or leave anything — you're still a member of this
    // night. Just re-opens the chooser so you can join or start another.
    // Whichever one you enter next becomes the resume target on reload,
    // since boot() picks the most recently joined membership.
    promptJoin(new URLSearchParams(location.search).get('code') || '');
  };
}

function confirmLeaveNight(){
  overlay('Leave this night?', 'You\'ll stop seeing it entirely — anyone still in it keeps their tab as-is.');
  $('#ovBody').innerHTML = `
    <div style="display:flex;gap:10px;width:100%;max-width:260px;margin-top:6px">
      <button id="leaveCancel" style="flex:1;background:none;border:1px solid var(--line);color:var(--paper)">Stay</button>
      <button id="leaveConfirm" style="flex:1;background:var(--magenta)">Leave</button>
    </div>`;
  $('#leaveCancel').onclick = hideOverlay;
  $('#leaveConfirm').onclick = async () => {
    $('#leaveConfirm').textContent = 'Leaving…';
    const { error } = await sb.rpc('leave_night', { p_night_id: night.id });
    if(error){ $('#ovSub').textContent = error.message; $('#leaveConfirm').textContent = 'Leave'; return; }
    if(currentChannel){ sb.removeChannel(currentChannel); currentChannel = null; }
    night = null; members = []; stops = []; expenses = []; balances = []; plan = [];
    promptJoin('');
  };
}

function renderTab(){
  const live = expenses.filter(e => e.status !== 'disputed' && e.status !== 'void');
  const grand = live.reduce((s,e)=>s+totalOf(e),0);
  const tips  = live.reduce((s,e)=>s+e.tip_cents,0);
  const flagged = expenses.filter(e => e.status === 'disputed');
  const collect = plan.filter(p => !p.is_dust);
  const dust    = plan.filter(p =>  p.is_dust);
  const dustTot = dust.reduce((s,p)=>s+p.amount_cents,0);
  const naive = expenses.filter(e=>e.status!=='disputed')
    .reduce((n,e)=> n + e.allocation.filter(a=>a.person_id!==e.payer_id).length, 0);

  const final = !isOpen();
  const stopsLine = stops.map(s=>s.name).filter(Boolean).join(' → ');
  // Real per-payment status only exists once closed — while running, plan
  // rows come straight from the live settle_night() preview and have no
  // stable id to act on yet. Same reasoning for gating Pay-in-Venmo below:
  // encouraging real money against a total that's still moving is how
  // someone overpays a stale preview.
  const showSettle = final && collect.some(p => p.status !== 'marked_paid');

  $('#pane-tab').innerHTML =
    `<div class="receipt">
      <div class="r-center">
        <div class="r-title">LAST CALL</div>
        ${final
          ? `<div class="r-status final">FINAL TAB</div>
             <div class="r-status-sub">Night closed${night.closed_at ? ' at ' + clock(night.closed_at) : ''}</div>`
          : `<div class="r-status running">RUNNING TAB</div>
             <div class="r-status-sub">Night still open</div>`}
        <div class="r-muted" style="margin-top:6px">${night.title}</div>
        ${stopsLine ? `<div class="r-muted r-name" style="max-width:100%;margin:0 auto">${stopsLine}</div>` : ''}
      </div>
      ${!final ? `<div class="r-preview-note">These numbers update as people log rounds and leave the night.</div>` : ''}
      <div class="r-rule"></div>
      <div class="r-line"><span>Subtotal</span><span>${money(grand-tips)}</span></div>
      <div class="r-line"><span>Tips</span><span>${money(tips)}</span></div>
      <div class="r-line"><b>NIGHT TOTAL</b><b>${money(grand)}</b></div>
      <div class="r-rule"></div>
      <div class="r-center r-big" id="whoPaysWhoHeading">WHO PAYS WHO</div>
      <div class="r-center r-muted" style="margin-bottom:8px">${naive} debts → ${collect.length} payment${collect.length===1?'':'s'}</div>
      ${collect.length ? collect.map((p,i) => {
        const marked = p.status === 'marked_paid';
        const canAct = final && p.id;
        const iAmOwer = p.from_person === me.id;
        const handle = M(p.to_person)?.person?.venmo_handle;
        return `<div class="r-pay ${marked?'settled':''}" style="animation-delay:${i*.08}s">
          <div class="r-pay-top">
            <span class="r-pay-line"><b>${nameOf(p.from_person)}</b> pays <b>${nameOf(p.to_person)}</b></span>
            <span class="r-pay-amt">${money(p.amount_cents)}</span>
          </div>
          <div class="r-pay-status">${marked ? 'Marked paid' : 'Unpaid'}</div>
          ${(canAct && !marked) ? (iAmOwer
            ? `<a class="venmo" target="_blank" rel="noopener"
                 href="https://venmo.com/?txn=pay${handle?'&audience=private&recipients='+encodeURIComponent(handle):''}&amount=${(p.amount_cents/100).toFixed(2)}&note=${encodeURIComponent(night.title)}">Pay in Venmo</a>`
            : `<button class="venmo" data-pay="${p.id}">Mark received</button>`) : ''}
        </div>`;
      }).join('') : `<div class="r-center" style="padding:10px 0">
          <div class="r-big">ALL SQUARE</div><div class="r-muted">No payments needed.</div></div>`}
      ${dustTot ? `<div class="r-dust">Written off under $${(DUST_CENTS/100).toFixed(2)}: ${money(dustTot)}
        (${dust.map(p=>nameOf(p.from_person)).join(', ')})</div>` : ''}
      ${flagged.length ? `<div class="r-rule"></div>
        <div class="r-muted r-center"><span aria-hidden="true">⚑</span> ${flagged.length} flagged &amp; excluded</div>
        ${flagged.map(e=>`<div class="r-line r-muted"><span class="r-name">${e.note}</span><span>${money(totalOf(e))}</span></div>`).join('')}`:''}
      ${playfulStatsHtml()}
      <div class="r-rule"></div>
      <div class="r-center r-muted">*** THAT'S LAST CALL, FOLKS ***</div>
    </div>` +
    `<div class="tab-actions">
      <button class="tab-action-btn" id="btnShareSummary">Share Summary</button>
      ${showSettle ? `<button class="tab-action-btn primary" id="btnSettleUp">Settle Up</button>` : ''}
      <button class="tab-action-btn" id="btnToggleDetails">Details</button>
    </div>` +
    `<div class="tab-details" id="tabDetails">
      ${balances.map(b => `<div class="tab-details-row">
          <span class="nm">${nameOf(b.person_id)}</span>
          <span class="tab-details-nums"><span>Paid ${money(b.paid_cents)}</span><span>Share ${money(b.owed_cents)}</span></span>
        </div>`).join('') || `<div class="tab-details-row"><span class="nm">No one on the tab yet.</span></div>`}
    </div>` +
    (final && isHost()
      ? `<button class="lastcall" id="btnReopen" style="margin-top:14px;background:linear-gradient(135deg,var(--teal),#1d9e7a)">
           Reopen this night<small>ADD MORE · RE-SETTLE LATER</small></button>`
      : '');

  $('#pane-tab').querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { error } = await sb.from('settlement')
      .update({ status: 'marked_paid', marked_paid_at: new Date().toISOString() })
      .eq('id', b.dataset.pay);
    if(error){ b.disabled = false; return toast(error.message, true); }
    await refreshPlan();
    toast('Marked received — we never move the money');
    renderTab();
  });

  $('#btnShareSummary').onclick = () => shareTabSummary(grand, collect, final);

  const su = $('#btnSettleUp');
  if(su) su.onclick = () => {
    const mine = collect.find(p => p.from_person === me.id && p.status !== 'marked_paid');
    if(mine){
      const handle = M(mine.to_person)?.person?.venmo_handle;
      const url = `https://venmo.com/?txn=pay${handle?'&audience=private&recipients='+encodeURIComponent(handle):''}&amount=${(mine.amount_cents/100).toFixed(2)}&note=${encodeURIComponent(night.title)}`;
      window.open(url, '_blank', 'noopener');
    } else {
      $('#whoPaysWhoHeading')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  };

  $('#btnToggleDetails').onclick = () => $('#tabDetails').classList.toggle('on');

  const rp = $('#btnReopen');
  if(rp) rp.onclick = async () => {
    const { error } = await sb.rpc('reopen_night', { p_night_id: night.id });
    if(error) return toast(error.message, true);
    toast('Reopened — back to logging rounds');
    goTab('tonight');
  };
}

// Gates the receipt's personality stats only — see PLAYFUL_SUMMARIES in
// config.js. The closing tagline below is signature chrome, not gated.
function playfulStatsHtml(){
  if(!PLAYFUL_SUMMARIES) return '';
  return `<div class="r-rule"></div>
    <div class="r-stat"><span>Rounds bought</span><span>${expenses.filter(e=>e.kind==='round').length}</span></div>
    <div class="r-stat"><span>Most generous</span><span>${extreme(1)}</span></div>
    <div class="r-stat"><span>Cheapest date</span><span>${extreme(-1)}</span></div>`;
}
function extreme(dir){
  const s = [...balances].sort((a,b)=> dir*(b.paid_cents - a.paid_cents))[0];
  // money(), not money0() — every other figure on this receipt is cents-
  // precise; this was the one place still rounding to whole dollars.
  return s ? `${nameOf(s.person_id)} (${money(s.paid_cents)})` : '—';
}
const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Deliberately minimal — names and net payment amounts only, the same
// figures already visible to the whole group in the receipt. No Venmo
// handles, no per-person paid/share breakdown, no join code.
async function shareTabSummary(grand, collect, final){
  const lines = [`${night.title} — ${final ? 'final tab' : 'running tab'}: ${money(grand)}`];
  if(collect.length){
    collect.forEach(p => lines.push(`${nameOf(p.from_person)} pays ${nameOf(p.to_person)}: ${money(p.amount_cents)}`));
  } else {
    lines.push('All square — no payments needed.');
  }
  const text = lines.join('\n');
  if(navigator.share){
    try{ await navigator.share({ title: 'Last Call', text }); return; }
    catch(e){ if(e.name === 'AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(text); toast('Summary copied'); }
  catch{ toast('Could not share — try again', true); }
}

function renderAll(){ if(!night) return; renderHeader(); renderTonight(); renderCrew(); renderTab(); }

/* ---------- tabs ---------- */
function updateFabVisibility(){
  $('#fab').style.display = (currentTab === 'tab' || !isOpen() || (currentTab === 'tonight' && !expenses.length))
    ? 'none' : 'flex';
}

document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + b.dataset.tab));
  currentTab = b.dataset.tab;
  updateFabVisibility();
  $('main').scrollTop = 0;
  closeNightMenu();
});
const goTab = n => document.querySelector(`nav button[data-tab="${n}"]`).click();

/* ---------- last call ---------- */
function confirmLastCall(){
  // Reuses the exact same figures the rest of the dashboard already
  // computes — grand total via totalOf() (same as the header), presence
  // via presentAt() (same as the header's Active count), and the live
  // settle_night plan (same rows the Tab pane renders) — nothing here is
  // a separate calculation invented for this sheet.
  const now = new Date();
  const live = expenses.filter(e => e.status !== 'disputed' && e.status !== 'void');
  const grand = live.reduce((s,e)=> s + totalOf(e), 0);
  const stillOut = members.filter(m => presentAt(m, now)).length;
  const unresolved = plan.filter(p => !p.is_dust).length;

  $('#lcSummary').innerHTML = `
    <div class="lc-row"><span>Current total</span><b>${money(grand)}</b></div>
    <div class="lc-row"><span>People still out</span><b>${stillOut} of ${members.length}</b></div>
    <div class="lc-row"><span>Unresolved balances</span><b>${unresolved}</b></div>`;

  $('#scrim').classList.add('on');
  $('#lastCallSheet').classList.add('on');
}
function closeLastCallSheet(){
  $('#lastCallSheet').classList.remove('on');
  $('#scrim').classList.remove('on');
}
$('#lcKeepBtn').onclick = closeLastCallSheet;
$('#lcEndBtn').onclick  = () => { closeLastCallSheet(); doLastCall(); };

async function doLastCall(){
  overlay('Closing out','NETTING THE LEDGER…');
  const { error } = await sb.rpc('close_night', { p_night_id: night.id, p_dust_cents: DUST_CENTS });
  if(error){ hideOverlay(); return toast(error.message, true); }
  await refresh();
  setTimeout(() => { hideOverlay(); goTab('tab'); toast('Tab closed.'); }, 900);
}

/* ============================================================
   ADD / EDIT SHEET
   ============================================================ */
let draft = null;
const baseOf = () => draft.editing ? draft.base : parseInt(draft.digits || '0', 10);
const tipOf  = () => {
  if(draft.editing) return draft.fixedTip;
  return draft.tip ? Math.round(baseOf() * draft.tip / 100) : 0;
};
const wSum = () => draft.alloc.reduce((s,a)=>s+a.w, 0);

function eligible(kind, at){
  return members.filter(m => presentAt(m, at) && !(kind === 'round' && m.is_dry)).map(m => m.person_id);
}

function applyKindLabels(){
  $('#shTitle').textContent = draft.kind === 'round' ? 'Add Round' : 'Add Expense';
  // No permanent helper paragraph — "Split a round to keep things fair"
  // was exactly the boilerplate this pass asked to remove from a
  // repeated action. Hidden entirely for add-mode; openEdit() below
  // still uses #shHint for one-time context about the specific expense
  // being edited, which is genuinely per-instance info, not boilerplate.
  $('#shHint').style.display = 'none';
  $('#toggleKind').textContent = draft.kind === 'round' ? 'Other expense' : 'Log a round instead';
}

function openAdd(kind){
  const at = new Date();
  draft = { editing:null, kind, payer: me.id, digits:'', tip: 0, description:'',
            receiptUrl: null, receiptFileName: null, receiptUploading: false, receiptError: null,
            payerOpen: false, tipCustomOpen: false,
            showShares:false, at, alloc: eligible(kind, at).map(p => ({p, w:1})) };
  applyKindLabels();
  $('#toggleKind').style.display = 'inline-block';
  $('#pad').style.display = 'grid';
  $('#voidBtn').style.display = 'none';
  show();
}
function openEdit(id){
  if(!isOpen()) return toast('Tab is closed', true);
  const e = expenses.find(x => x.id === id);
  draft = { editing:id, kind:e.kind, payer:e.payer_id, base:e.base_cents, fixedTip:e.tip_cents,
            description: e.description || '', receiptUrl: e.receipt_url || null, receiptFileName: null,
            receiptUploading: false, receiptError: null, payerOpen: false, tipCustomOpen: false,
            showShares: e.allocation.some(a => Number(a.weight) !== 1), at: new Date(e.occurred_at),
            alloc: e.allocation.map(a => ({ p:a.person_id, w:Number(a.weight) })) };
  $('#shTitle').textContent = 'Edit expense';
  // Editing is a one-off action on a specific, already-existing expense —
  // this context line is genuinely new information each time, not a
  // repeated boilerplate explanation, so it stays visible here.
  $('#shHint').textContent = `${e.note ?? 'Expense'}${e.description ? ' — ' + e.description : ''} · logged ${clock(e.occurred_at)}. Drop someone out or give them a bigger share.`;
  $('#shHint').style.display = 'block';
  $('#toggleKind').style.display = 'none';
  $('#pad').style.display = 'none';
  $('#voidBtn').style.display = 'block';
  show();
}
$('#toggleKind').onclick = () => {
  draft.kind = draft.kind === 'round' ? 'other' : 'round';
  draft.alloc = eligible(draft.kind, draft.at).map(p => ({ p, w:1 }));
  applyKindLabels();
  renderSheet();
};
function show(){ renderSheet(); $('#scrim').classList.add('on'); $('#sheet').classList.add('on'); }
function close(){
  $('#scrim').classList.remove('on'); $('#sheet').classList.remove('on');
  // Abandoning the whole flow closes any child sheet left open too.
  $('#editSplitSheet').classList.remove('on');
  $('#detailsSheet').classList.remove('on');
}

// Drag-to-dismiss, from the header zone (handle/title/hint) only —
// not the interactive body — so it doesn't hijack typing or tapping
// the keypad. Pulling past the threshold closes it; short of that,
// it springs back. touch-action:none on the handle + setPointerCapture
// stop the browser's own scroll/bounce gesture from competing with
// the drag on a real touchscreen — without both, this "works" with a
// mouse and does nothing reliable on an actual phone.
function makeSwipeToClose(sheetEl, closeFn){
  const DISMISS_PX = 90;
  const handle = sheetEl.querySelector('.sheet-handle');
  let startY = null, dragging = false;

  handle.addEventListener('pointerdown', e => {
    startY = e.clientY;
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    sheetEl.style.transition = 'none';
  });
  handle.addEventListener('pointermove', e => {
    if(!dragging) return;
    e.preventDefault();
    const dy = e.clientY - startY;
    if(dy > 0) sheetEl.style.transform = `translateY(${dy}px)`;
  });
  const release = e => {
    if(!dragging) return;
    dragging = false;
    sheetEl.style.transition = '';
    const dy = e.clientY - startY;
    sheetEl.style.transform = '';
    if(dy > DISMISS_PX) closeFn();
  };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
}
makeSwipeToClose($('#stopSheet'), closeStopSheet);
// Big sheets (Add Round + its two children) use an explicit × close
// button instead of swipe-to-dismiss, matching the near-full-screen
// header pattern — no makeSwipeToClose() call for these three.

function renderSheet(){
  const at = draft.at;

  // Paid-by — collapsed pill showing the current payer; tapping it
  // reveals the same selection row used before (unchanged click logic),
  // and picking someone auto-collapses it back down.
  const payer = M(draft.payer);
  $('#payerPillAvatar').style.background = colorFor(draft.payer);
  $('#payerPillAvatar').textContent = initials(payer?.person?.display_name);
  $('#payerPillName').textContent = payer?.person?.display_name ?? '—';
  $('#payerPill').setAttribute('aria-expanded', String(draft.payerOpen));
  $('#payerPill').onclick = () => {
    draft.payerOpen = !draft.payerOpen;
    renderSheet();
    if(draft.payerOpen) requestAnimationFrame(() =>
      ($('#payerRow').querySelector('[data-payer].on') || $('#payerRow').querySelector('[data-payer]'))?.focus());
  };
  $('#payerRow').style.display = draft.payerOpen ? 'flex' : 'none';
  $('#payerRow').innerHTML = members.map(m => `
    <button class="${draft.payer===m.person_id?'on':''} ${presentAt(m,at)?'':'away'}" data-payer="${m.person_id}"
      aria-pressed="${draft.payer===m.person_id}">
      <span class="mini" style="background:${colorFor(m.person_id)}">${initials(m.person.display_name)}</span>${m.person.display_name}</button>`).join('');
  $('#payerRow').querySelectorAll('[data-payer]').forEach(b => b.onclick = () => {
    draft.payer = b.dataset.payer;
    draft.payerOpen = false;
    renderSheet();
  });

  // Amount — tip presets are always visible now (not opt-in). draft.tip
  // is 0 until a preset or custom % is actively chosen; nothing is
  // pre-selected. Same base*tip%/100 math as before either way.
  const tot = baseOf() + tipOf(), W = wSum() || 1;
  const sub = draft.tip
    ? `${money(baseOf())} + ${money(tipOf())} tip · ${money(tot)} total`
    : (draft.alloc.length ? `${money(Math.round(tot/W))}/person` : '');
  // No "tap the keypad" helper at $0 anymore — the keypad being right
  // there already makes the interaction obvious.
  $('#amtDisp').innerHTML = tot
    ? `${money(baseOf())}${sub ? `<span style="font-size:12px;color:var(--dim2);display:block;margin-top:2px">${sub}</span>` : ''}`
    : `$0.00`;

  $('#tipRow').style.display = draft.editing ? 'none' : 'flex';
  $('#tipRow').querySelectorAll('.chip[data-tip]').forEach(c => {
    const on = String(draft.tip) === c.dataset.tip;
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', String(on));
    c.onclick = () => {
      draft.tip = (String(draft.tip) === c.dataset.tip) ? 0 : +c.dataset.tip;
      draft.tipCustomOpen = false;
      renderSheet();
    };
  });
  const customActive = draft.tip && ![18,20].includes(draft.tip);
  $('#tipCustomBtn').classList.toggle('on', customActive || draft.tipCustomOpen);
  $('#tipCustomBtn').setAttribute('aria-pressed', String(customActive || draft.tipCustomOpen));
  $('#tipCustomBtn').onclick = () => { draft.tipCustomOpen = !draft.tipCustomOpen; renderSheet(); };
  $('#tipCustomInput').style.display = (!draft.editing && draft.tipCustomOpen) ? 'block' : 'none';
  if(draft.tipCustomOpen && document.activeElement !== $('#tipCustomInput')){
    $('#tipCustomInput').value = customActive ? draft.tip : '';
  }
  $('#tipCustomInput').oninput = e => {
    draft.tip = Math.max(0, Math.min(100, +e.target.value || 0));
    const t2 = baseOf() + tipOf();
    const s2 = draft.tip ? `${money(baseOf())} + ${money(tipOf())} tip · ${money(t2)} total`
                          : (draft.alloc.length ? `${money(Math.round(t2/(wSum()||1)))}/person` : '');
    const subEl = $('#amtDisp').querySelector('span');
    if(subEl) subEl.textContent = s2;
    updateSplitSummary();
    updateConfirmAndWarnings();
  };

  updateSplitSummary();

  // Details row — one line summarizing both note and receipt state.
  // Neither field is ever shown expanded on the main screen anymore;
  // both live in the Round Details child sheet.
  const hasNote = !!draft.description, hasReceipt = !!draft.receiptUrl;
  $('#detailsRow').classList.toggle('filled', hasNote || hasReceipt);
  $('#detailsRowLabel').textContent =
    hasNote && hasReceipt ? 'Note + receipt added'
    : hasNote ? 'Note added'
    : hasReceipt ? 'Receipt attached'
    : 'Add note or receipt';
  $('#detailsRow').onclick = showDetails;

  $('#splitSummaryRow').onclick = showEditSplit;

  updateConfirmAndWarnings();
}

// Split summary — shown on the main screen and recomputed on every
// amount/tip/participant change. Reused verbatim by the Edit Split
// sheet's own header line.
function splitSummaryText(){
  const tot = baseOf() + tipOf(), W = wSum() || 1;
  const uneven = draft.alloc.some(a => a.w !== 1);
  const names = draft.alloc.map(a => nameOf(a.p));
  let namesLine = '';
  if(names.length > 4){
    namesLine = `${names.slice(0,3).join(', ')} +${names.length-3} more`;
  } else if(names.length === 2){
    namesLine = names.join(' and ');
  } else if(names.length > 2){
    namesLine = `${names.slice(0,-1).join(', ')} and ${names[names.length-1]}`;
  } else {
    namesLine = names.join('');
  }

  if(!draft.alloc.length) return { headline: 'No one selected yet', names: '' };
  if(uneven) return { headline: `Uneven split · ${draft.alloc.length} people`, names: namesLine };
  if(!tot) return { headline: `${draft.alloc.length} people selected`, names: namesLine };
  if(draft.alloc.length === 1) return { headline: `${names[0]} covers ${money(tot)}`, names: '' };
  return { headline: `Split ${draft.alloc.length} ways · ${money(Math.round(tot/W))} each`, names: namesLine };
}
function updateSplitSummary(){
  const { headline, names } = splitSummaryText();
  $('#splitSummaryHeadline').textContent = headline;
  $('#splitSummaryNames').textContent = names;
}

// Split out so the tip-custom-input's live update (which deliberately
// skips a full renderSheet() to avoid resetting its own cursor) can
// still keep the confirm button and warnings in sync.
function updateConfirmAndWarnings(){
  const tot = baseOf() + tipOf(), W = wSum() || 1;
  const ok = draft.alloc.length > 0 && (draft.editing || baseOf() > 0);
  $('#confirmBtn').disabled = !ok || draft.receiptUploading;
  $('#confirmBtn').textContent = !draft.alloc.length ? "Pick who it's for"
    : draft.editing ? 'Save Changes'
    : `${draft.kind === 'round' ? 'Log Round' : 'Log Expense'} · ${money(tot)}`;

  // Inline warnings, close to the split — real rules only (no invented
  // "shares don't reconcile" check: uneven shares are weight-based, so
  // they always sum correctly by construction, there's no mismatch
  // state to detect).
  const warn = $('#splitWarning');
  const payerIncluded = draft.alloc.some(a => a.p === draft.payer);
  let msg = '';
  if(!draft.alloc.length){
    msg = 'Choose at least one person.';
  } else if(!payerIncluded){
    msg = `${nameOf(draft.payer)} paid but isn't included in this split.`;
  } else if(draft.alloc.length === 1 && tot > 0){
    msg = `${nameOf(draft.alloc[0].p)} will cover the full ${money(tot)}.`;
  } else if(draft.receiptUploading){
    msg = 'Receipt is still uploading. You can log the round without it.';
  }
  warn.textContent = msg;
  warn.style.display = msg ? 'block' : 'none';
}

$('#pad').innerHTML = ['1','2','3','4','5','6','7','8','9','·','0','⌫']
  .map(k => {
    const label = k === '·' ? 'double zero' : k === '⌫' ? 'Delete last digit' : k;
    return `<button data-k="${k}" aria-label="${label}">${k}</button>`;
  }).join('');
$('#pad').querySelectorAll('button').forEach(b => b.onclick = () => {
  const k = b.dataset.k;
  if(k === '⌫') draft.digits = draft.digits.slice(0,-1);
  else if(k === '·') draft.digits += '00';
  else if(draft.digits.length < 7) draft.digits += k;
  renderSheet();
});

// ---------- Edit Split (child sheet) ----------
// Same draft.alloc mutations as before the restructure — only the
// container moved. "Current Crew" is the renamed, reintroduced
// presence-default reset (eligible()); "Everyone" and "Clear" are
// unchanged; "Clear" is styled quiet (.link.quiet) per spec, since an
// accidental full clear is the one genuinely dangerous action here.
function showEditSplit(){
  renderEditSplitSheet();
  $('#editSplitSheet').classList.add('on');
}
function closeEditSplit(){ $('#editSplitSheet').classList.remove('on'); renderSheet(); }
function renderEditSplitSheet(){
  const at = draft.at;
  const { headline } = splitSummaryText();
  $('#editSplitSummary').textContent = headline;

  const inSplit = id => draft.alloc.some(a => a.p === id);
  $('#editSplitRow').innerHTML = members.map(m => `
    <button class="${inSplit(m.person_id)?'on':''} ${presentAt(m,at)?'':'away'}" data-split="${m.person_id}"
      aria-pressed="${inSplit(m.person_id)}">
      <span class="mini" style="background:${colorFor(m.person_id)}">${initials(m.person.display_name)}</span>${m.person.display_name}</button>`).join('');
  $('#editSplitRow').querySelectorAll('[data-split]').forEach(b => b.onclick = () => {
    const id = b.dataset.split;
    draft.alloc = inSplit(id) ? draft.alloc.filter(a => a.p !== id) : [...draft.alloc, {p:id, w:1}];
    renderEditSplitSheet();
  });

  const away = members.filter(m => !presentAt(m, at));
  const dry  = members.filter(m => m.is_dry && presentAt(m, at));
  const bits = [];
  if(away.length) bits.push(`${away.map(m=>m.person.display_name).join(', ')} not here — excluded automatically.`);
  if(dry.length && draft.kind === 'round') bits.push(`${dry.map(m=>m.person.display_name).join(', ')} off rounds — skipped automatically.`);
  $('#editSplitAutoNote').textContent = bits.join(' ');

  $('#tglShares').textContent = draft.showShares ? 'Even split' : 'Uneven shares';
  const tot = baseOf() + tipOf(), W = wSum() || 1;
  const sp = $('#sharesPanel');
  sp.style.display = draft.showShares ? 'block' : 'none';
  if(draft.showShares){
    sp.innerHTML = draft.alloc.map(a => `
      <div class="shrow">
        <span class="mini" style="background:${colorFor(a.p)};width:20px;height:20px;border-radius:50%;
          display:grid;place-items:center;font-family:'IBM Plex Mono';font-size:8px;color:var(--ink);font-weight:600">${initials(nameOf(a.p))}</span>
        <span class="nm">${nameOf(a.p)}</span>
        <span class="stepper"><button data-w="${a.p}" data-d="-1">−</button><span>${a.w}×</span><button data-w="${a.p}" data-d="1">+</button></span>
        <span class="amt">${money(Math.round(tot*a.w/W))}</span></div>`).join('')
      || `<div style="font-size:11px;color:var(--dim2);padding:4px 0">Nobody on this expense yet.</div>`;
    sp.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      const a = draft.alloc.find(x => x.p === b.dataset.w);
      a.w = Math.max(1, Math.min(6, a.w + (+b.dataset.d)));
      renderEditSplitSheet();
    });
  }
}
$('#editSplitCloseBtn').onclick = closeEditSplit;
$('#applySplitBtn').onclick = closeEditSplit; // mutations are already immediate/committed — Apply just returns
$('#selCurrentCrew').onclick = () => { draft.alloc = eligible(draft.kind, draft.at).map(p=>({p,w:1})); renderEditSplitSheet(); };
$('#selAll').onclick    = () => { draft.alloc = members.map(m=>({p:m.person_id,w:1})); renderEditSplitSheet(); };
$('#selNone').onclick   = () => { draft.alloc = []; renderEditSplitSheet(); };
$('#tglShares').onclick = () => { if(draft.showShares) draft.alloc.forEach(a=>a.w=1); draft.showShares=!draft.showShares; renderEditSplitSheet(); };

// ---------- Round Details (child sheet: Note + Receipt) ----------
// Same draft.description / draft.receiptUrl mutations as before — only
// the container moved. "Save Details" just closes, same reasoning as
// Apply Split above.
function showDetails(){
  renderDetailsSheet();
  $('#detailsSheet').classList.add('on');
  requestAnimationFrame(() => $('#expDesc').focus());
}
function closeDetails(){ $('#detailsSheet').classList.remove('on'); renderSheet(); }
function renderDetailsSheet(){
  $('#expDesc').value = draft.description || '';
  $('#expDesc').oninput = e => { draft.description = e.target.value; };

  const rBtn = $('#receiptAttachBtn');
  rBtn.classList.toggle('on', !!draft.receiptUrl);
  rBtn.disabled = draft.receiptUploading;
  rBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
    <span>${draft.receiptUploading ? 'Uploading…' : draft.receiptUrl ? 'Replace Receipt' : 'Attach Receipt'}</span>`;
  $('#receiptRemoveBtn').style.display = (draft.receiptUrl && !draft.receiptUploading) ? 'block' : 'none';
  $('#receiptError').textContent = draft.receiptError || '';
  $('#receiptError').style.display = draft.receiptError ? 'block' : 'none';
}
$('#detailsCloseBtn').onclick = closeDetails;
$('#saveDetailsBtn').onclick = closeDetails;
$('#expDesc').addEventListener('focus', () => {
  setTimeout(() => $('#expDesc').scrollIntoView({
    block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth'
  }), 300); // after the keyboard animates in, not before
});

$('#receiptAttachBtn').onclick = () => $('#receiptFile').click();
$('#receiptRemoveBtn').onclick = () => {
  draft.receiptUrl = null;
  draft.receiptFileName = null;
  draft.receiptError = null;
  renderDetailsSheet();
  renderSheet();
};
$('#receiptFile').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = ''; // allow re-selecting the same file later (e.g. after removing)
  if(!file) return;
  if(file.size > 10 * 1024 * 1024){
    draft.receiptError = 'That file is too large (10MB max).';
    renderDetailsSheet();
    return toast(draft.receiptError, true);
  }

  draft.receiptUploading = true;
  draft.receiptFileName = file.name;
  draft.receiptError = null;
  renderDetailsSheet();

  // Path is namespaced by night, not by expense — for a brand-new
  // expense we don't have an expense id yet at upload time. A random
  // filename is enough; the bucket is public (see KNOWLEDGE.md), so the
  // path itself isn't relied on for access control.
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
  const path = `${night.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage.from('receipts').upload(path, file);
  draft.receiptUploading = false;
  if(upErr){
    draft.receiptFileName = null;
    draft.receiptError = upErr.message;
    renderDetailsSheet();
    return toast(upErr.message, true);
  }
  const { data: pub } = sb.storage.from('receipts').getPublicUrl(path);
  draft.receiptUrl = pub.publicUrl;
  renderDetailsSheet();
  renderSheet();
  toast('Receipt attached');
};
$('#btnRound').onclick   = () => openAdd('round');
$('#btnLastCallFab').onclick = () => { if(isHost()) confirmLastCall(); };
$('#btnStop').onclick    = () => openNewStop();
$('#cancelBtn').onclick  = close;
$('#sheetCloseBtn').onclick = close;
$('#scrim').onclick      = () => {
  if($('#editSplitSheet').classList.contains('on')) return closeEditSplit();
  if($('#detailsSheet').classList.contains('on')) return closeDetails();
  close(); closeStopSheet(); closeLastCallSheet();
};

function openNewStop(){
  $('#stopName').value = '';
  $('#scrim').classList.add('on');
  $('#stopSheet').classList.add('on');
}
function closeStopSheet(){ $('#stopSheet').classList.remove('on'); $('#scrim').classList.remove('on'); }
$('#stopCancel').onclick = closeStopSheet;
$('#stopGo').onclick = async () => {
  $('#stopGo').disabled = true;
  const { error } = await sb.rpc('add_stop', { p_night_id: night.id, p_name: $('#stopName').value.trim() || null });
  closeStopSheet();
  $('#stopGo').disabled = false;
  toast(error ? error.message : 'Logged the move', !!error);
};

$('#voidBtn').onclick = async () => {
  const { error } = await sb.from('expense').delete().eq('id', draft.editing);
  close();
  toast(error ? error.message : 'Voided', !!error);
};

$('#confirmBtn').onclick = async () => {
  const prevLabel = $('#confirmBtn').textContent;
  $('#confirmBtn').disabled = true;
  $('#confirmBtn').textContent = draft.editing ? 'Saving…' : 'Logging…';

  if(draft.editing){
    const { error: e1 } = await sb.from('expense')
      .update({ payer_id: draft.payer, description: draft.description?.trim() || null,
                 receipt_url: draft.receiptUrl || null })
      .eq('id', draft.editing);
    if(e1){ $('#confirmBtn').disabled = false; $('#confirmBtn').textContent = prevLabel; return toast(e1.message, true); }
    await sb.from('allocation').delete().eq('expense_id', draft.editing);
    const { error: e2 } = await sb.from('allocation').insert(
      draft.alloc.map(a => ({ expense_id: draft.editing, person_id: a.p, weight: a.w })));
    close();
    return toast(e2 ? e2.message : 'Updated — balances recalculated', !!e2);
  }

  const stop = stops[stops.length - 1];
  const n = expenses.filter(e => e.kind === 'round').length + 1;
  const { data, error } = await sb.from('expense').insert({
    night_id: night.id, stop_id: stop?.id ?? null, payer_id: draft.payer,
    base_cents: baseOf(), tip_cents: tipOf(), kind: draft.kind,
    note: draft.kind === 'round' ? `Round ${n}` : 'Expense',
    description: draft.description?.trim() || null,
    receipt_url: draft.receiptUrl || null,
    created_by: me.id
  }).select().single();

  if(error){ $('#confirmBtn').disabled = false; $('#confirmBtn').textContent = prevLabel; return toast(error.message, true); }

  const { error: aerr } = await sb.from('allocation').insert(
    draft.alloc.map(a => ({ expense_id: data.id, person_id: a.p, weight: a.w })));
  close();
  if(aerr) return toast(aerr.message, true);
  // Undo reuses the exact delete-by-id already proven out by voidBtn —
  // no new deletion path, just the same one triggered from a toast
  // instead of the edit sheet, while the row is still fresh.
  toast(`Logged · ${money(baseOf()+tipOf())} across ${draft.alloc.length}`, false, {
    label: 'Undo',
    onAction: async () => {
      const { error: uerr } = await sb.from('expense').delete().eq('id', data.id);
      toast(uerr ? uerr.message : 'Round removed', !!uerr);
    }
  });
};

/* ---------- chrome ---------- */
let tT;
function toast(msg, isErr = false, action = null){
  const t = $('#toast');
  t.textContent = '';
  if(action){
    const span = document.createElement('span');
    span.textContent = msg;
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.onclick = () => { t.className = 'toast'; clearTimeout(tT); action.onAction(); };
    t.append(span, btn);
  } else {
    t.textContent = msg;
  }
  t.className = 'toast on' + (isErr ? ' err' : '') + (action ? ' actionable' : '');
  t.setAttribute('aria-live', isErr ? 'assertive' : 'polite');
  clearTimeout(tT);
  tT = setTimeout(() => t.className = 'toast', action ? 4200 : 3200);
}
function overlay(title, sub){
  $('#ovTitle').textContent = title;
  $('#ovSub').innerHTML = sub;
  $('#ovBody').innerHTML = '';
  $('#overlay').classList.add('on');
}
function hideOverlay(){ $('#overlay').classList.remove('on'); }

// Quick guide — reuses the same overlay used for Connecting/Join/etc.
// Just shows/hides on top of whatever's already rendered underneath;
// doesn't touch night/members/expenses state, so it's safe to open
// mid-session and dismiss back into exactly where you were.
function showGuide(){
  overlay('', 'A quick guide to how this works.');
  $('#ovTitle').innerHTML = brandBlock();
  $('#ovBody').innerHTML = `
    <div class="guide-list">
      <div class="guide-item"><b>Presence drives the split.</b> Tap someone out when they leave — new rounds skip them automatically.</div>
      <div class="guide-item"><b>Add Round</b> when someone buys. The split defaults to whoever's here.</div>
      <div class="guide-item"><b>Add Stop</b> when the group moves to a new place.</div>
      <div class="guide-item"><b>Last Call</b> closes the night and works out who pays who.</div>
      <div class="guide-item">Everything updates live for the whole group.</div>
    </div>
    <button id="guideClose" style="margin-top:6px">Got it</button>`;
  $('#guideClose').onclick = hideOverlay;
}

$('#htMark').innerHTML = compactMark();

// Overflow menu — the shared integration point for this and future
// prompts. Populated only with actions that already had real, working
// handlers elsewhere (Crew's former intro-card buttons, the old info
// guide button) — no empty/disabled placeholders for Join Code or
// Share, which are explicitly deferred to a later prompt.
function updateNightMenu(){
  const canLeave = !isHost() || !isOpen();
  $('#htLeaveNight').style.display = canLeave ? 'block' : 'none';
  $('#htCloseNight').style.display = canLeave ? 'none' : 'block';
}
function closeNightMenu(){
  $('#htMenu').style.display = 'none';
  $('#htMenuBtn').setAttribute('aria-expanded', 'false');
}
$('#htMenuBtn').onclick = () => {
  const open = $('#htMenu').style.display === 'block';
  $('#htMenu').style.display = open ? 'none' : 'block';
  $('#htMenuBtn').setAttribute('aria-expanded', String(!open));
};
document.addEventListener('click', e => {
  if($('#htMenu').style.display === 'block' &&
     !$('#htMenu').contains(e.target) && !$('#htMenuBtn').contains(e.target)){
    closeNightMenu();
  }
});
$('#htGuide').onclick = () => { closeNightMenu(); showGuide(); };
$('#htSwitchNight').onclick = () => { closeNightMenu(); confirmSwitchNight(); };
$('#htLeaveNight').onclick  = () => { closeNightMenu(); confirmLeaveNight(); };
$('#htCloseNight').onclick  = () => { closeNightMenu(); if(isHost()) confirmLastCall(); };

boot().catch(e => overlay('Something broke', e.message));