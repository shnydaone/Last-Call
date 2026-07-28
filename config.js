import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ============================================================
   CONFIG
   ============================================================ */
export const SUPABASE_URL  = 'https://rkxmpvkhrchgkqocguwt.supabase.co';
export const PUBLISHABLE   = 'sb_publishable_vF8xIr2yzxZRk_ozdHT-bQ_kcOiAEel';
export const DUST_CENTS    = 200;           // $2 materiality threshold

export const sb = createClient(SUPABASE_URL, PUBLISHABLE);
