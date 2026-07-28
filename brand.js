/* ============================================================
   BRAND — logo mark + wordmark + tagline. Used only on the
   join/start landing overlay (see app.js promptJoin()) — the one
   "hero" moment; deliberately not repeated on every sub-screen.
   ============================================================ */

// Logo mark — circular arrows (the "session recirculates" motif) around an
// L/C monogram. Inline SVG rather than an asset file, so it inherits the
// palette without an extra request and never asks for image handoff.
// Hex values hardcoded rather than var(--...) — presentation attributes on
// <stop>/<text> don't reliably resolve custom properties across browsers
// when the SVG is injected as an innerHTML string.
const LC_MARK = `<svg viewBox="0 0 100 100" class="lc-mark" aria-hidden="true">
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
    ${LC_MARK}
    <div>
      <div class="brand-word">Last Call</div>
      <div class="brand-tag">One night out&nbsp; · &nbsp;Zero confusion.</div>
    </div>
  </div>`;
