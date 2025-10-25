// scripts/seed-dev-user.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Explicitly load .env.local from project root
config({ path: '.env.local' });

// ---- sanity check (masked) ----
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const mask = (s) => (s ? s.slice(0, 10) + '…' : '(missing)');
console.log('[seed] ENV check:',
  '\n  URL =', url,
  '\n  ANON =', mask(anon),
  '\n  SERVICE =', mask(serviceKey)
);

// Hard-stop if missing
if (!url || !serviceKey) {
  console.error('[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client (local-only use of service role)
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Customize these as you like (LOCAL ONLY)
const email = 'dev@veronagrow.local';
const password = 'Passw0rd!123';
const username = 'dev';

try {
  // Create (or ensure) user
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;

  const userId = data.user?.id;

  // Ensure a profile row exists (if your app expects it)
  if (userId) {
    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert({ id: userId, username }, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;
  }

  console.log(`[seed] Created/ensured user: ${email} (${userId})`);
  process.exit(0);
} catch (e) {
  console.error('[seed] Failed:', e?.message || e);
  process.exit(1);
}