import React, { useState, useEffect } from 'react';
import { User, Match, WeeklySchedule, Shift } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Repeat, Plus, Trash2, Save, Info } from 'lucide-react';
import { calculateShiftHours, calculateTotalHours, TIME_OPTIONS, formatTimeLabel, formatHours, validateTimeRange } from '../lib/utils';

const DAYS: Shift['dayOfWeek'][] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

type DraftShift = { key: string; dayOfWeek: Shift['dayOfWeek']; startTime: string; endTime: string };

/**
 * The pair's recurring schedule. Admin-only by design: parents and nannies adjust
 * individual weeks, but only an admin changes the baseline those weeks inherit.
 * Editing it never rewrites a week that has already been adjusted.
 */
export default function StandardScheduleEditor({ match, admin }: { match: Match; admin: User }) {
  const [standard, setStandard] = useState<WeeklySchedule | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [draft, setDraft] = useState<DraftShift[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'schedules'), where('matchId', '==', match.id), where('type', '==', 'STANDARD'));
    const unsub = onSnapshot(q, snap => {
      const d = snap.docs[0];
      setStandard(d ? ({ id: d.id, ...d.data() } as WeeklySchedule) : null);
    });
    return () => unsub();
  }, [match.id]);

  useEffect(() => {
    if (!standard) return;
    const q = query(collection(db, `schedules/${standard.id}/shifts`));
    const unsub = onSnapshot(q, snap => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift))));
    return () => unsub();
  }, [standard?.id]);

  const startEditing = () => {
    setDraft(
      shifts
        .slice()
        .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek))
        .map((s, i) => ({ key: `${s.id}-${i}`, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }))
    );
    setError(null);
    setIsEditing(true);
  };

  const save = async () => {
    for (const s of draft) {
      const check = validateTimeRange(s.startTime, s.endTime);
      if (!check.valid) {
        setError(`${s.dayOfWeek.slice(0, 3)}: ${check.error}`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const total = calculateTotalHours(draft);
      const ref = standard ? doc(db, 'schedules', standard.id) : doc(collection(db, 'schedules'));

      if (standard) {
        batch.update(ref, {
          totalHours: total,
          version: (standard.version || 1) + 1,
          updatedAt: serverTimestamp(),
          updatedBy: admin.id,
        });
        for (const s of shifts) batch.delete(doc(db, `schedules/${standard.id}/shifts`, s.id));
      } else {
        batch.set(ref, {
          matchId: match.id,
          type: 'STANDARD',
          status: 'APPROVED',
          totalHours: total,
          version: 1,
          updatedAt: serverTimestamp(),
          updatedBy: admin.id,
        });
      }

      for (const s of draft) {
        batch.set(doc(collection(db, `schedules/${ref.id}/shifts`)), {
          scheduleId: ref.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          totalHours: calculateShiftHours(s.startTime, s.endTime),
        });
      }

      for (const uid of [match.parentId, match.nannyId]) {
        batch.set(doc(collection(db, 'notifications')), {
          userId: uid,
          message: 'Admin updated the recurring weekly schedule.',
          type: 'STANDARD_UPDATED',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'schedules');
      setError('Could not save the recurring schedule.');
    } finally {
      setLoading(false);
    }
  };

  const sorted = shifts.slice().sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek));
  const total = isEditing ? calculateTotalHours(draft) : calculateTotalHours(shifts);

  return (
    <div className="bg-white border border-indigo-500/30 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-indigo-500/5 border-b border-indigo-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Repeat className="w-4 h-4 text-indigo-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Recurring schedule</p>
            <p className="text-[10px] text-text-sub">Applies to every week that hasn't been adjusted</p>
          </div>
        </div>
        <span className="text-sm font-bold text-text-main font-mono italic shrink-0">{formatHours(total)}h</span>
      </div>

      <div className="p-4 space-y-3">
        {isEditing ? (
          <>
            {draft.map(s => (
              <div key={s.key} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-surface p-2.5 rounded-lg border border-border-theme">
                <select
                  value={s.dayOfWeek}
                  onChange={e => setDraft(d => d.map(x => (x.key === s.key ? { ...x, dayOfWeek: e.target.value as Shift['dayOfWeek'] } : x)))}
                  className="border border-border-theme bg-white rounded-lg px-2 py-1.5 text-xs font-bold outline-none flex-1 min-w-[105px]"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                </select>
                <div className="flex items-center gap-2 flex-1 min-w-[165px]">
                  <select
                    value={s.startTime}
                    onChange={e => setDraft(d => d.map(x => (x.key === s.key ? { ...x, startTime: e.target.value } : x)))}
                    className="w-full border border-border-theme bg-white rounded-lg px-2 py-1.5 text-xs font-bold outline-none appearance-none"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                  </select>
                  <span className="text-text-sub text-xs">to</span>
                  <select
                    value={s.endTime}
                    onChange={e => setDraft(d => d.map(x => (x.key === s.key ? { ...x, endTime: e.target.value } : x)))}
                    className="w-full border border-border-theme bg-white rounded-lg px-2 py-1.5 text-xs font-bold outline-none appearance-none"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => setDraft(d => d.filter(x => x.key !== s.key))}
                  className="p-1.5 text-error bg-error/10 hover:bg-error hover:text-white rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setDraft(d => [...d, { key: `new-${Date.now()}-${d.length}`, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }])}
              className="w-full py-2.5 border-2 border-dashed border-border-theme text-primary font-bold text-xs rounded-lg hover:bg-surface hover:border-primary transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Plus className="w-3.5 h-3.5" /> Add a day
            </button>

            <div className="flex items-start gap-2 p-3 bg-surface rounded-lg border border-border-theme">
              <Info className="w-3.5 h-3.5 text-text-sub shrink-0 mt-0.5" />
              <p className="text-[10px] text-text-sub leading-relaxed">
                Weeks that have already been adjusted keep their own schedule. Only untouched weeks pick this up.
              </p>
            </div>

            {error && <div className="p-3 bg-error/10 text-error text-xs font-bold rounded-lg">{error}</div>}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => { setIsEditing(false); setError(null); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-[10px] font-bold text-text-sub border border-border-theme hover:bg-surface uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-[10px] font-bold hover:bg-indigo-700 disabled:opacity-50 uppercase tracking-widest transition-all"
              >
                {loading
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save className="w-3.5 h-3.5" />}
                Save recurring
              </button>
            </div>
          </>
        ) : (
          <>
            {sorted.length === 0 ? (
              <p className="text-xs text-text-sub italic text-center py-6">No recurring schedule set for this pair.</p>
            ) : (
              <div className="divide-y divide-border-theme">
                {sorted.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2">
                    <span className="text-[11px] font-bold text-text-main uppercase w-12">{s.dayOfWeek.slice(0, 3)}</span>
                    <span className="text-[11px] text-text-sub">
                      {formatTimeLabel(s.startTime)} – {formatTimeLabel(s.endTime)}
                    </span>
                    <span className="text-[11px] font-bold text-text-main font-mono italic">
                      {formatHours(calculateShiftHours(s.startTime, s.endTime))}h
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={startEditing}
              className="w-full py-2.5 rounded-lg text-[10px] font-bold text-indigo-700 border border-indigo-500/30 hover:bg-indigo-500/5 uppercase tracking-widest transition-all"
            >
              {sorted.length === 0 ? 'Set recurring schedule' : 'Edit recurring schedule'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
