import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, query, where, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

const PROJECT = 'momsub-rules-test';
const ADMIN = 'admin1', PARENT = 'parent1', NANNY = 'nanny1', STRANGER = 'stranger1';
const MATCH = 'match1', STD = 'std1', WEEK = 'week1';

let env: RulesTestEnvironment;
let fails = 0;

async function expectAllow(label: string, p: Promise<any>) {
  try { await assertSucceeds(p); console.log(`PASS  ALLOW  ${label}`); }
  catch (e: any) { fails++; console.log(`FAIL  ALLOW  ${label}\n        was denied: ${e.message?.slice(0, 110)}`); }
}
async function expectDeny(label: string, p: Promise<any>) {
  try { await assertFails(p); console.log(`PASS  DENY   ${label}`); }
  catch { fails++; console.log(`FAIL  DENY   ${label}\n        was ALLOWED but must not be`); }
}

const scheduleFields = (over: any = {}) => ({
  matchId: MATCH, type: 'WEEKLY', status: 'PENDING_NANNY',
  totalHours: 8, version: 1, updatedAt: serverTimestamp(), updatedBy: PARENT, ...over,
});
const shiftFields = (sid: string) => ({
  scheduleId: sid, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', totalHours: 8,
});

async function main() {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });

  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN),    { email: 'a@x.com', name: 'Admin',  role: 'ADMIN',  createdAt: new Date() });
    await setDoc(doc(db, 'users', PARENT),   { email: 'p@x.com', name: 'Parent', role: 'PARENT', createdAt: new Date() });
    await setDoc(doc(db, 'users', NANNY),    { email: 'n@x.com', name: 'Nanny',  role: 'NANNY',  createdAt: new Date() });
    await setDoc(doc(db, 'users', STRANGER), { email: 's@x.com', name: 'Nosy',   role: 'PARENT', createdAt: new Date() });
    await setDoc(doc(db, 'matches', MATCH), { parentId: PARENT, nannyId: NANNY, adminId: ADMIN, status: 'ACTIVE', createdAt: new Date() });
    // The pair's recurring schedule.
    await setDoc(doc(db, 'schedules', STD), scheduleFields({ type: 'STANDARD', status: 'APPROVED', updatedBy: ADMIN }));
    await setDoc(doc(db, `schedules/${STD}/shifts`, 's1'), shiftFields(STD));
    // A week both sides already approved.
    await setDoc(doc(db, 'schedules', WEEK), scheduleFields({ type: 'WEEKLY', status: 'APPROVED', weekStartDate: '2026-07-06' }));
  });

  const parent = env.authenticatedContext(PARENT, { email: 'p@x.com' }).firestore();
  const nanny = env.authenticatedContext(NANNY, { email: 'n@x.com' }).firestore();
  const admin = env.authenticatedContext(ADMIN, { email: 'a@x.com' }).firestore();
  const stranger = env.authenticatedContext(STRANGER, { email: 's@x.com' }).firestore();

  // --- THE CORE FLOW: parent adjusts a week that has never been adjusted. The schedule,
  // its shifts and the approval record are all created in a SINGLE batch. This is what
  // getAfter() exists for; with plain get() every one of these is denied.
  await expectAllow('parent materializes a fresh week (schedule+shifts+approval in one batch)', (async () => {
    const b = writeBatch(parent);
    const ref = doc(collection(parent, 'schedules'));
    b.set(ref, scheduleFields({ weekStartDate: '2026-07-13', status: 'PENDING_NANNY' }));
    b.set(doc(collection(parent, `schedules/${ref.id}/shifts`)), shiftFields(ref.id));
    b.set(doc(collection(parent, `schedules/${ref.id}/approvals`)), {
      scheduleId: ref.id, userId: PARENT, role: 'PARENT', status: 'CHANGES_REQUESTED', timestamp: serverTimestamp(),
    });
    return b.commit();
  })());

  // --- "Even if approved by both, either party can still request further adjustment."
  await expectAllow('nanny re-adjusts an APPROVED week',
    updateDoc(doc(nanny, 'schedules', WEEK), { status: 'PENDING_PARENT', totalHours: 6, version: 2, updatedAt: serverTimestamp(), updatedBy: NANNY }));
  await expectAllow('parent re-adjusts an APPROVED week',
    updateDoc(doc(parent, 'schedules', WEEK), { status: 'PENDING_NANNY', totalHours: 7, version: 3, updatedAt: serverTimestamp(), updatedBy: PARENT }));

  // --- "Only admin can change the recurring standard schedule."
  await expectDeny('parent edits the RECURRING schedule',
    updateDoc(doc(parent, 'schedules', STD), { totalHours: 99, version: 2, updatedAt: serverTimestamp(), updatedBy: PARENT }));
  await expectDeny('nanny edits the RECURRING schedule',
    updateDoc(doc(nanny, 'schedules', STD), { totalHours: 99, version: 2, updatedAt: serverTimestamp(), updatedBy: NANNY }));
  await expectDeny('nanny edits shifts ON the recurring schedule',
    setDoc(doc(nanny, `schedules/${STD}/shifts`, 's1'), shiftFields(STD)));
  await expectDeny('parent creates a NEW recurring schedule',
    setDoc(doc(collection(parent, 'schedules')), scheduleFields({ type: 'STANDARD' })));
  await expectAllow('admin edits the recurring schedule',
    updateDoc(doc(admin, 'schedules', STD), { totalHours: 20, version: 2, updatedAt: serverTimestamp(), updatedBy: ADMIN }));
  await expectAllow('admin edits shifts on the recurring schedule',
    setDoc(doc(admin, `schedules/${STD}/shifts`, 's1'), shiftFields(STD)));

  // --- A week must not be able to disguise itself as the recurring schedule.
  await expectDeny('parent reclassifies a week as STANDARD',
    updateDoc(doc(parent, 'schedules', WEEK), { type: 'STANDARD', totalHours: 8, version: 4, updatedAt: serverTimestamp(), updatedBy: PARENT }));
  // Admin may retype — the migration depends on it.
  await expectAllow('admin retypes a legacy week (migration)',
    updateDoc(doc(admin, 'schedules', WEEK), { type: 'WEEKLY_SUPERSEDED', totalHours: 8, version: 5, updatedAt: serverTimestamp(), updatedBy: ADMIN }));

  // --- Isolation between families.
  await expectDeny('unrelated user reads a schedule', getDoc(doc(stranger, 'schedules', STD)));
  await expectDeny('unrelated user adjusts a week',
    updateDoc(doc(stranger, 'schedules', WEEK), { status: 'APPROVED', totalHours: 8, version: 6, updatedAt: serverTimestamp(), updatedBy: STRANGER }));

  // ===================== SIGN-UP / ACCOUNT CREATION =====================
  // The outage: nobody could create an account at all. These lock that shut.

  // An admin pre-created records for two people who have not signed up yet. New
  // records are keyed by email, which is what the ADMIN pre-authorization reads.
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'dina@x.com'), {
      email: 'dina@x.com', name: 'Dina', role: 'PARENT', createdAt: new Date(),
    });
    await setDoc(doc(db, 'users', 'reeva@x.com'), {
      email: 'reeva@x.com', name: 'Reeva', role: 'ADMIN', createdAt: new Date(),
    });
  });

  // Brand new sign-ups: authenticated, but with no user record of their own yet.
  const dina = env.authenticatedContext('dina-uid', { email: 'dina@x.com' }).firestore();
  const reeva = env.authenticatedContext('reeva-uid', { email: 'reeva@x.com' }).firestore();
  const walkin = env.authenticatedContext('walkin-uid', { email: 'walkin@x.com' }).firestore();

  const newUser = (over: any = {}) => ({
    email: 'walkin@x.com', name: 'Walk In', role: 'PARENT', createdAt: serverTimestamp(), ...over,
  });

  // THE OUTAGE ITSELF — this was denied before, which is why nobody could sign up.
  await expectAllow('brand-new person creates their own PARENT record',
    setDoc(doc(walkin, 'users', 'walkin-uid'), newUser()));

  const walkin2 = env.authenticatedContext('walkin2-uid', { email: 'walkin2@x.com' }).firestore();
  await expectAllow('brand-new person creates their own NANNY record',
    setDoc(doc(walkin2, 'users', 'walkin2-uid'),
      newUser({ email: 'walkin2@x.com', name: 'Walk In 2', role: 'NANNY' })));

  // Having signed up as a PARENT, they must not be able to re-write their own role.
  await expectDeny('user changes their OWN role after signup',
    setDoc(doc(walkin, 'users', 'walkin-uid'), newUser({ role: 'NANNY' })));

  // Dina finds the record the admin pre-created for her, by her own email.
  await expectAllow('new user queries users by their OWN email',
    getDocs(query(collection(dina, 'users'), where('email', '==', 'dina@x.com'))));
  // ...but must not be able to enumerate every family's contact details.
  await expectDeny('new user lists ALL users',
    getDocs(collection(dina, 'users')));
  await expectDeny('new user queries someone ELSE\'s email',
    getDocs(query(collection(dina, 'users'), where('email', '==', 'p@x.com'))));

  // Privilege escalation: the whole reason open sign-up is safe.
  await expectDeny('walk-in self-assigns ADMIN at signup',
    setDoc(doc(walkin, 'users', 'walkin-uid'), newUser({ role: 'ADMIN' })));
  await expectDeny('walk-in creates a record under someone else\'s id',
    setDoc(doc(walkin, 'users', 'someone-else'), newUser()));
  await expectDeny('parent promotes THEMSELVES to ADMIN',
    updateDoc(doc(parent, 'users', PARENT), { email: 'p@x.com', name: 'Parent', role: 'ADMIN', createdAt: new Date() }));

  // ---- ADMIN ACCESS CODE (server-enforced) ----
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'config', 'admin'), { code: 'REAL-SECRET-CODE' });
  });

  const coder = env.authenticatedContext('coder-uid', { email: 'coder@x.com' }).firestore();

  // The code itself must be unreachable from any client, or it is not a secret.
  await expectDeny('client reads the admin code',
    getDoc(doc(coder, 'config', 'admin')));
  await expectDeny('client overwrites the admin code',
    setDoc(doc(coder, 'config', 'admin'), { code: 'hacked' }));

  // Verification succeeds only with the true code.
  await expectDeny('wrong admin code is rejected',
    setDoc(doc(coder, 'admin_verifications', 'coder-uid'), { code: 'GUESS', verifiedAt: serverTimestamp() }));
  // ...and without it, no ADMIN record can be created.
  await expectDeny('ADMIN signup without verifying the code',
    setDoc(doc(coder, 'users', 'coder-uid'), newUser({ email: 'coder@x.com', role: 'ADMIN' })));

  await expectAllow('correct admin code verifies',
    setDoc(doc(coder, 'admin_verifications', 'coder-uid'), { code: 'REAL-SECRET-CODE', verifiedAt: serverTimestamp() }));
  await expectDeny('verification cannot be read back',
    getDoc(doc(coder, 'admin_verifications', 'coder-uid')));
  // Having proven the code, ADMIN signup is now permitted.
  await expectAllow('ADMIN signup AFTER verifying the code',
    setDoc(doc(coder, 'users', 'coder-uid'), newUser({ email: 'coder@x.com', role: 'ADMIN' })));

  // Nobody can forge a verification for someone else.
  await expectDeny('forging a verification for another user',
    setDoc(doc(walkin, 'admin_verifications', 'coder-uid'), { code: 'REAL-SECRET-CODE' }));

  // Reeva was pre-authorized as ADMIN by a real admin, so her claim is allowed.
  await expectAllow('pre-authorized ADMIN claims their account',
    setDoc(doc(reeva, 'users', 'reeva-uid'), {
      email: 'reeva@x.com', name: 'Reeva', role: 'ADMIN', createdAt: new Date(),
    }));

  // Admin powers.
  await expectAllow('admin creates another ADMIN',
    setDoc(doc(admin, 'users', 'newadmin@x.com'), {
      email: 'newadmin@x.com', name: 'New Admin', role: 'ADMIN', createdAt: new Date(),
    }));
  await expectAllow('admin promotes an existing parent to ADMIN',
    updateDoc(doc(admin, 'users', PARENT), { email: 'p@x.com', name: 'Parent', role: 'ADMIN', createdAt: new Date() }));

  // Claiming removes the leftover placeholder record.
  await expectAllow('user deletes the placeholder holding their own email',
    deleteDoc(doc(dina, 'users', 'dina@x.com')));
  await expectDeny('user deletes someone else\'s record',
    deleteDoc(doc(walkin, 'users', NANNY)));

  await env.cleanup();
  console.log(fails === 0 ? '\nAll rules checks passed.' : `\n${fails} FAILED`);
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
