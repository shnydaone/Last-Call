/* ============================================================
   BRAND — logo mark, wordmark, tagline.
   - brandBlock(): logo + wordmark + tagline. Used on the join/start
     landing overlay (the one "hero" moment) and the info guide.
   - headerBrand(): logo + wordmark only, sized down, wrapped in the
     page's one <h1> — used in the persistent app header.
   ============================================================ */

// Logo mark — circular arrows (the "session recirculates" motif) around an
// L/C monogram. Inline SVG rather than an asset file, so it inherits the
// palette without an extra request. Same markup everywhere it appears;
// only the wrapper class changes so CSS can size it per context.
// Hex values hardcoded rather than var(--...) — presentation attributes on
// <stop>/<text> don't reliably resolve custom properties across browsers
// when the SVG is injected as an innerHTML string.
const lcMark = (cls) => `<svg viewBox="0 0 100 100" class="${cls}" aria-hidden="true">
  <defs>
    <linearGradient id="lcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E8A33D"/>
      <stop offset="100%" stop-color="#FFC061"/>
    </linearGradient>
    <marker id="lcArrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse">
      <path d="M0,0 L7,3.5 L0,7 Z" fill="#FFC061"/>
    </marker>
  </defs>
  <path d="M50,9 A41,41 0 0 1 89,50" fill="none" stroke="url(#lcGrad)" stroke-width="5" stroke-linecap="round" marker-end="url(#lcArrow)"/>
  <path d="M50,91 A41,41 0 0 1 11,50" fill="none" stroke="url(#lcGrad)" stroke-width="5" stroke-linecap="round" marker-end="url(#lcArrow)"/>
  <line x1="80" y1="20" x2="20" y2="80" stroke="#F5EFE6" stroke-width="3"/>
  <text x="25" y="46" font-family="Georgia, 'Playfair Display', serif" font-weight="700" font-size="32" fill="#F5EFE6">L</text>
  <text x="46" y="79" font-family="Georgia, 'Playfair Display', serif" font-weight="700" font-size="32" fill="#F5EFE6">C</text>
</svg>`;

export const brandBlock = () => `
  <div class="brand">
    ${lcMark('lc-mark')}
    <div>
      <div class="brand-word">Last Call</div>
      <div class="brand-tag">One night out&nbsp; · &nbsp;Zero confusion.</div>
    </div>
  </div>`;

// Bare mark only, for the compact scroll-reminder bar — sizing is handled
// entirely by that bar's own CSS container, not a dedicated class here.
export const compactMark = () => lcMark('');

// Compact version for the persistent app header — logo + wordmark, no
// tagline (repeating the tagline on every screen would dilute it; it
// stays on the landing overlay and the info guide). Keeps the page's
// single <h1> for document structure instead of a plain <div>.
export const headerBrand = () => `
  <div class="hdr-brand">
    ${lcMark('lc-mark-sm')}
    <h1 class="hdr-brand-word">Last Call</h1>
  </div>`;
