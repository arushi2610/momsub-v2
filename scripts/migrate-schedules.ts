/**
 * One-off migration from the old schedule model to the week-based one.
 *
 *   Old: every submission created a new doc, typed WEEKLY_PLANNED / WEEKLY_ACTUAL,
 *        with weekStartDate set to whatever day the date picker landed on. Several
 *        docs could claim the same week.
 *   New: exactly one WEEKLY doc per (match, Monday). Everything else inherits the
 *        pair's STANDARD schedule.
 *
 * What it does:
 *   - Retypes WEEKLY_PLANNED / WEEKLY_ACTUAL  ->  WEEKLY
 *   - Snaps every weekStartDate back to its Monday
 *   - Where several docs claim one week, keeps the most recently updated as that
 *     week's CURRENT schedule and marks the rest WEEKLY_SUPERSEDED (kept, not deleted)
 *   - Marks the admin-owned STANDARD schedule APPROVED (it needs no one's approval)
 *
 * Dry run by default. Nothing is written without --apply.
 *
 *   npx tsx scripts/migrate-schedules.ts                 # show me what would change
 *   npx tsx scripts/migrate-schedules.ts --apply         # do it
 *
 * Credentials come from the environment and are never written anywhere:
 *   MOMSUB_ADMIN_EMAIL=you@example.com MOMSUB_ADMIN_PASSWORD=... npx tsx scripts/migrate-schedules.ts
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APPLY = process.argv.includes('--apply');
const EMAIL = process.env.MOMSUB_ADMIN_EMAIL;
const PASSWORD = process.env.MOMSUB_ADMIN_PASSWORD;

const LEGACY_WEEK_TYPES = ['WEEKLY_PLANNED', 'WEEKLY_ACTUAL'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing this date string. Local time: toISOString() would shift the day. */
function mondayOf(value: string): string | null {
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return null;
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toDateKey(d);
}

function updatedAtMs(s: any): number {
  if (s.updatedAt?.seconds) return s.updatedAt.seconds * 1000;
  if (s.updatedAt?.toMillis) return s.updatedAt.toMillis();
  return 0;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Set MOMSUB_ADMIN_EMAIL and MOMSUB_ADMIN_PASSWORD (an ADMIN account).');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {}, (firebaseConfig as any).firestoreDatabaseId);
  const auth = getAuth(app);

  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log(`Signed in as ${EMAIL}\n`);

  const snap = await getDocs(collection(db, 'schedules'));
  const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  console.log(`Found ${all.length} schedule docs.\n`);

  type Change = { id: string; label: string; patch: Record<string, any> };
  const changes: Change[] = [];

  // 1. The recurring schedules. Admin-owned, so they need no approval.
  for (const s of all.filter(s => s.type === 'STANDARD')) {
    if (s.status !== 'APPROVED') {
      changes.push({
        id: s.id,
        label: `STANDARD (match ${s.matchId}): status ${s.status} -> APPROVED`,
        patch: { status: 'APPROVED' },
      });
    }
  }

  // 2. Legacy week docs, grouped by the week they actually belong to.
  const legacy = all.filter(s => LEGACY_WEEK_TYPES.includes(s.type));
  const groups = new Map<string, any[]>();
  const undated: any[] = [];

  for (const s of legacy) {
    const monday = s.weekStartDate ? mondayOf(s.weekStartDate) : null;
    if (!monday) {
      undated.push(s);
      continue;
    }
    const key = `${s.matchId}::${monday}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ ...s, _monday: monday });
  }

  for (const [key, docs] of groups) {
    const [, monday] = key.split('::');
    // Most recently updated doc wins the week; version breaks a tie.
    const sorted = docs.sort(
      (a, b) => updatedAtMs(b) - updatedAtMs(a) || (b.version || 0) - (a.version || 0)
    );
    const [winner, ...losers] = sorted;

    const patch: Record<string, any> = { type: 'WEEKLY' };
    if (winner.weekStartDate !== monday) patch.weekStartDate = monday;
    if (typeof winner.totalHours !== 'number') patch.totalHours = 0;
    if (typeof winner.version !== 'number') patch.version = 1;

    changes.push({
      id: winner.id,
      label:
        `WEEK ${monday} (match ${winner.matchId}): ${winner.type} -> WEEKLY` +
        (patch.weekStartDate ? `, weekStartDate ${winner.weekStartDate} -> ${monday}` : '') +
        (losers.length ? `  [wins over ${losers.length} duplicate(s)]` : ''),
      patch,
    });

    for (const l of losers) {
      changes.push({
        id: l.id,
        label: `  duplicate for ${monday} (match ${l.matchId}): ${l.type} -> WEEKLY_SUPERSEDED (kept, hidden)`,
        patch: { type: 'WEEKLY_SUPERSEDED' },
      });
    }
  }

  for (const s of undated) {
    changes.push({
      id: s.id,
      label: `NO WEEK (match ${s.matchId}): ${s.type} -> WEEKLY_SUPERSEDED (cannot tell which week it belongs to)`,
      patch: { type: 'WEEKLY_SUPERSEDED' },
    });
  }

  if (changes.length === 0) {
    console.log('Nothing to migrate — no legacy records found.');
    process.exit(0);
  }

  console.log(`${changes.length} change(s):\n`);
  for (const c of changes) console.log(`  ${c.label}`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.');
    process.exit(0);
  }

  // Batches cap at 500 writes.
  for (let i = 0; i < changes.length; i += 400) {
    const batch = writeBatch(db);
    for (const c of changes.slice(i, i + 400)) {
      batch.update(doc(db, 'schedules', c.id), c.patch);
    }
    await batch.commit();
  }

  console.log(`\nApplied ${changes.length} change(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nMigration failed:', err.message || err);
  process.exit(1);
});
