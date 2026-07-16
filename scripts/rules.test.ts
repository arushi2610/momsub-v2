import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
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

  const parent = env.authenticatedContext(PARENT).firestore();
  const nanny = env.authenticatedContext(NANNY).firestore();
  const admin = env.authenticatedContext(ADMIN).firestore();
  const stranger = env.authenticatedContext(STRANGER).firestore();

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

  await env.cleanup();
  console.log(fails === 0 ? '\nAll rules checks passed.' : `\n${fails} FAILED`);
  process.exit(fails ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
