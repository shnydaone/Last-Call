import QRCode from 'https://esm.sh/qrcode@1.5.3';

/* ============================================================
   QR — invite-code QR rendering, isolated so the qrcode dependency
   has exactly one point of contact with the rest of the app.
   Dark-on-light regardless of app theme — QR scanability needs real
   contrast, not palette-matching. Not yet confirmed against a live
   phone camera (see KNOWLEDGE.md open gaps).
   ============================================================ */
export function renderInviteQR(canvas, url){
  return QRCode.toCanvas(canvas, url, {
    width: 150, margin: 1, color: { dark: '#1A1520', light: '#F5EFE6' }
  });
}
