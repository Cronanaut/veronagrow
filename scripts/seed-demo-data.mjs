// scripts/seed-demo-data.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

// ---- sanity check (masked) ----
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const mask = (s) => (s ? s.slice(0, 10) + '…' : '(missing)');

console.log('[seed:demo] ENV check:',
  '\n  URL =', url,
  '\n  SERVICE =', mask(serviceKey)
);

if (!url || !serviceKey) {
  console.error('[seed:demo] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Customize if you changed the seed user
const SEED_EMAIL = 'dev@veronagrow.local';

async function getUserIdByEmail(email) {
  // Supabase Admin API: list users and find by email
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  return user?.id || null;
}

async function ensureProfile(userId, username = 'dev') {
  // profiles.id == auth.uid()
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id' });
  if (error) throw error;
}

async function seed() {
  try {
    console.log('[seed:demo] Locating user:', SEED_EMAIL);
    const userId = await getUserIdByEmail(SEED_EMAIL);
    if (!userId) {
      console.error(`[seed:demo] Could not find user ${SEED_EMAIL}. Run "npm run seed:dev:user" first.`);
      process.exit(1);
    }
    console.log('[seed:demo] User id:', userId);

    await ensureProfile(userId, 'dev');

    // ----- Insert Plant Batches -----
    const plantBatches = [
      {
        user_id: userId,
        name: 'Northern Lights #1',
        strain: 'Northern Lights',
        plant_type: 'cannabis',
        start_date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
        stage: 'veg',
        notes: 'First demo plant in vegetative stage.'
      },
      {
        user_id: userId,
        name: 'Blue Dream #A',
        strain: 'Blue Dream',
        plant_type: 'cannabis',
        start_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10),
        stage: 'flower',
        notes: 'Ten days into flower.'
      },
    ];

    console.log('[seed:demo] Inserting plant batches…');
    const { data: pbRows, error: pbErr } = await admin
      .from('plant_batches')
      .insert(plantBatches)
      .select('id,name');
    if (pbErr) throw pbErr;
    console.log('[seed:demo] plant_batches ->', pbRows.map((r) => `${r.name} (${r.id})`).join(', '));

    const batch1 = pbRows[0]?.id;
    const batch2 = pbRows[1]?.id;

    // ----- Insert Inventory Items -----
    // Keep columns conservative (omit "notes" if your table doesn’t have it)
    const inventory = [
      {
        user_id: userId,
        name: '3-gal Fabric Pots',
        category: 'pots',
        quantity: 8,
        unit: 'pcs',
        unit_cost: 4.00
      },
      {
        user_id: userId,
        name: 'Coco Coir 50L',
        category: 'medium',
        quantity: 2,
        unit: 'bag',
        unit_cost: 18.50
      },
      {
        user_id: userId,
        name: 'Cal-Mag 1L',
        category: 'nutrients',
        quantity: 1,
        unit: 'bottle',
        unit_cost: 14.99
      },
      {
        user_id: userId,
        name: 'pH Down 500ml',
        category: 'additive',
        quantity: 1,
        unit: 'bottle',
        unit_cost: 9.50
      },
    ];

    console.log('[seed:demo] Inserting inventory items…');
    const { data: invRows, error: invErr } = await admin
      .from('inventory_items')
      .insert(inventory)
      .select('id,name');
    if (invErr) throw invErr;
    console.log('[seed:demo] inventory_items ->', invRows.map((r) => `${r.name} (${r.id})`).join(', '));

    // ----- Insert Diary Entries -----
    const diary = [
      {
        user_id: userId,
        batch_id: batch1,
        title: 'Transplanted to 3-gal',
        content: 'Moved seedlings into 3-gallon fabric pots. Light at 40%.'
      },
      {
        user_id: userId,
        batch_id: batch1,
        title: 'Light watering',
        content: '500ml per plant, runoff minimal. Looking perky.'
      },
      {
        user_id: userId,
        batch_id: batch2,
        title: 'Day 10 Flower',
        content: 'Slight defoliation. Pistils forming nicely.'
      },
    ];

    console.log('[seed:demo] Inserting diary entries…');
    const { data: deRows, error: deErr } = await admin
      .from('diary_entries')
      .insert(diary)
      .select('id,title');
    if (deErr) throw deErr;
    console.log('[seed:demo] diary_entries ->', deRows.map((r) => `${r.title} (${r.id})`).join(', '));

    // ----- Insert Cost Items -----
    // Minimal required columns: user_id, amount; plus batch_id & description for context
    const costs = [
      {
        user_id: userId,
        batch_id: batch1,
        type: 'supplies',
        description: 'Coco coir (half bag)',
        amount: 9.25
      },
      {
        user_id: userId,
        batch_id: batch1,
        type: 'nutrients',
        description: 'Cal-Mag (50ml est.)',
        amount: 0.75
      },
      {
        user_id: userId,
        batch_id: batch2,
        type: 'electricity',
        description: 'Lights 18/6 for 3 days (est.)',
        amount: 2.40
      },
    ];

    console.log('[seed:demo] Inserting cost items…');
    const { data: costRows, error: costErr } = await admin
      .from('cost_items')
      .insert(costs)
      .select('id,description,amount');
    if (costErr) throw costErr;
    console.log('[seed:demo] cost_items ->', costRows.map((r) => `${r.description} $${r.amount}`).join(' | '));

    console.log('\n[seed:demo] ✅ Done. Open the app and check:');
    console.log('  • Plants:      http://localhost:3000/plants');
    console.log('  • Inventory:   http://localhost:3000/inventory');
    console.log('  • Batch diary: http://localhost:3000/plants/<batch-id>');
    process.exit(0);
  } catch (e) {
    console.error('[seed:demo] Failed:', e?.message || e);
    process.exit(1);
  }
}

await seed();