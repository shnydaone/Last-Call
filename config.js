import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ============================================================
   CONFIG
   ============================================================ */
export const SUPABASE_URL  = 'https://rkxmpvkhrchgkqocguwt.supabase.co';
export const PUBLISHABLE   = 'sb_publishable_vF8xIr2yzxZRk_ozdHT-bQ_kcOiAEel';
export const DUST_CENTS    = 200;           // $2 materiality threshold

// No settings framework exists in this app yet — this is the single flag
// that gates the receipt's personality lines (Rounds bought / Most
// generous / Cheapest date). Flip to false to drop them without touching
// renderTab()'s structure. Does NOT gate the closing tagline ("THAT'S LAST
// CALL, FOLKS") — that's signature receipt chrome, not a "stat."
export const PLAYFUL_SUMMARIES = true;

export const sb = createClient(SUPABASE_URL, PUBLISHABLE);
