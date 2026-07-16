import React, { useState } from 'react';
import { Shift, User, UserRole, ScheduleStatus, WeekView, Match } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Clock, CheckCircle2, AlertCircle, MessageSquare, Save, Plus, Trash2, Lock, Repeat } from 'lucide-react';
import { calculateShiftHours, calculateTotalHours, TIME_OPTIONS, formatTimeLabel, formatHours, validateTimeRange } from '../lib/utils';
import { daysUntilLocked, formatWeekRange } from '../lib/week';
import DisputeChat from './DisputeChat';
import VisualCalendar from './VisualCalendar';

const DAYS: Shift['dayOfWeek'][] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

interface ScheduleCardProps {
  weekView: WeekView;
  user: User;
  match: Match | undefined;
  onChanged?: () => void;
}

type DraftShift = { key: string; dayOfWeek: Shift['dayOfWeek']; startTime: string; endTime: string };

/** Who the ball is with after `actor` adjusts a week. Admin is the arbiter: their word is final. */
function statusAfterAdjustment(actor: UserRole): ScheduleStatus {
  if (actor === 'PARENT') return 'PENDING_NANNY';
  if (actor === 'NANNY') return 'PENDING_PARENT';
  return 'APPROVED';
}

function canApprove(status: ScheduleStatus, role: UserRole): boolean {
  if (role === 'ADMIN') return status !== 'APPROVED';
  if (status === 'PENDING_NANNY') return role === 'NANNY';
  if (status === 'PENDING_PARENT') return role === 'PARENT';
  return false;
}

export default function ScheduleCard({ weekView, user, match, onChanged }: ScheduleCardProps) {
  const { schedule, shifts, isStandard, locked, weekStartDate, matchId } = weekView;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DraftShift[]>([]);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status: ScheduleStatus = schedule?.status ?? 'APPROVED';
  const totalHours = isEditing ? calculateTotalHours(draft) : calculateTotalHours(shifts);
  const graceDays = daysUntilLocked(weekStartDate);

  const startAdjusting = () => {
    setDraft(
      shifts
        .slice()
        .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek))
        .map((s, i) => ({ key: `${s.id || 'std'}-${i}`, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }))
    );
    setExplanation('');
    setError(null);
    setIsEditing(true);
  };

  const addDay = () =>
    setDraft(d => [...d, { key: `new-${Date.now()}-${d.length}`, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }]);

  const removeDay = (key: string) => setDraft(d => d.filter(s => s.key !== key));

  const updateDraft = (key: string, field: keyof DraftShift, value: string) =>
    setDraft(d => d.map(s => (s.key === key ? { ...s, [field]: value } : s)));

  const otherPartyId = () => {
    if (!match) return null;
    if (user.role === 'PARENT') return match.nannyId;
    if (user.role === 'NANNY') return match.parentId;
    return null;
  };

  /**
   * Writes the week's CURRENT schedule. If the week was still inheriting the
   * standard, this is where it becomes a real record — the standard itself is
   * never touched.
   */
  const saveAdjustment = async () => {
    if (!explanation.trim()) {
      setError('Please say why you are adjusting this week.');
      return;
    }
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
      const newStatus = statusAfterAdjustment(user.role);
      const newTotal = calculateTotalHours(draft);
      const scheduleRef = schedule ? doc(db, 'schedules', schedule.id) : doc(collection(db, 'schedules'));

      if (schedule) {
        batch.update(scheduleRef, {
          status: newStatus,
          totalHours: newTotal,
          version: (schedule.version || 1) + 1,
          adjustmentsCount: (schedule.adjustmentsCount || 0) + 1,
          lastAdjustedByRole: user.role,
          explanation: explanation.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.id,
        });
        // Shifts are replaced wholesale: an adjustment can add, remove or move days.
        for (const existing of shifts) {
          if (existing.id) batch.delete(doc(db, `schedules/${schedule.id}/shifts`, existing.id));
        }
      } else {
        batch.set(scheduleRef, {
          matchId,
          weekStartDate,
          type: 'WEEKLY',
          status: newStatus,
          totalHours: newTotal,
          version: 1,
          adjustmentsCount: 1,
          lastAdjustedByRole: user.role,
          explanation: explanation.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.id,
        });
      }

      for (const s of draft) {
        batch.set(doc(collection(db, `schedules/${scheduleRef.id}/shifts`)), {
          scheduleId: scheduleRef.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          totalHours: calculateShiftHours(s.startTime, s.endTime),
        });
      }

      batch.set(doc(collection(db, `schedules/${scheduleRef.id}/approvals`)), {
        scheduleId: scheduleRef.id,
        userId: user.id,
        role: user.role,
        status: 'CHANGES_REQUESTED',
        explanation: explanation.trim(),
        timestamp: serverTimestamp(),
      });

      const week = formatWeekRange(weekStartDate);
      const recipients =
        user.role === 'ADMIN'
          ? [match?.parentId, match?.nannyId].filter(Boolean)
          : [otherPartyId()].filter(Boolean);

      for (const uid of recipients) {
        batch.set(doc(collection(db, 'notifications')), {
          userId: uid,
          scheduleId: scheduleRef.id,
          message:
            user.role === 'ADMIN'
              ? `Admin adjusted the schedule for ${week}.`
              : `${user.name} requested a schedule change for ${week}. Please review.`,
          type: 'SCHEDULE_ADJUSTED',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setIsEditing(false);
      setDraft([]);
      setExplanation('');
      onChanged?.();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'schedules');
      setError('Could not save the adjustment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!schedule) return;
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'schedules', schedule.id), {
        status: 'APPROVED',
        totalHours: schedule.totalHours,
        version: (schedule.version || 1) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: user.id,
      });

      batch.set(doc(collection(db, `schedules/${schedule.id}/approvals`)), {
        scheduleId: schedule.id,
        userId: user.id,
        role: user.role,
        status: 'APPROVED',
        timestamp: serverTimestamp(),
      });

      const target = otherPartyId();
      if (target) {
        batch.set(doc(collection(db, 'notifications')), {
          userId: target,
          scheduleId: schedule.id,
          message: `${user.name} approved the schedule for ${formatWeekRange(weekStartDate)}.`,
          type: 'SCHEDULE_APPROVED',
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      onChanged?.();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${schedule.id}`);
      setError('Could not approve. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = () => {
    if (isStandard) return 'Standard schedule';
    switch (status) {
      case 'PENDING_NANNY': return 'Awaiting nanny';
      case 'PENDING_PARENT': return 'Awaiting parent';
      case 'APPROVED': return 'Approved by both';
      case 'DISPUTE': return 'Disputed';
    }
  };

  const statusTone = () => {
    if (isStandard) return { dot: 'bg-indigo-500', text: 'text-indigo-600' };
    switch (status) {
      case 'APPROVED': return { dot: 'bg-success', text: 'text-success' };
      case 'DISPUTE': return { dot: 'bg-error', text: 'text-error' };
      default: return { dot: 'bg-warning', text: 'text-warning' };
    }
  };
  const tone = statusTone();

  const showApprove = !isEditing && !locked && !isStandard && canApprove(status, user.role);
  const showAdjust = !isEditing && !locked;

  return (
    <div className="bg-white border border-border-theme rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 sm:px-6 py-4 bg-surface border-b border-border-theme flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
              <p className={`text-[10px] font-bold uppercase tracking-tight ${tone.text}`}>{statusLabel()}</p>
              {isStandard && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase">
                  <Repeat className="w-2.5 h-2.5" /> Recurring
                </span>
              )}
              {locked && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-text-sub bg-border-theme/40 px-1.5 py-0.5 rounded uppercase">
                  <Lock className="w-2.5 h-2.5" /> Closed
                </span>
              )}
            </div>
            {schedule?.adjustmentsCount ? (
              <p className="text-[10px] text-text-sub mt-0.5">Adjusted {schedule.adjustmentsCount}x</p>
            ) : (
              <p className="text-[10px] text-text-sub mt-0.5">
                {isStandard ? 'Inherited from the recurring schedule' : 'No changes yet'}
              </p>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-text-main font-mono italic tracking-tighter">
            {formatHours(totalHours)}
            <span className="text-[10px] font-bold text-text-sub ml-1 uppercase not-italic">hrs</span>
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {isEditing ? (
          <div className="space-y-3">
            {draft.length === 0 && (
              <div className="px-6 py-10 text-center text-text-sub italic text-sm bg-surface rounded-xl border border-dashed border-border-theme">
                No days scheduled. This week would be zero hours.
              </div>
            )}
            {draft.map(s => (
              <div key={s.key} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-surface p-3 rounded-xl border border-border-theme">
                <select
                  value={s.dayOfWeek}
                  onChange={e => updateDraft(s.key, 'dayOfWeek', e.target.value)}
                  className="border border-border-theme bg-white rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-primary flex-1 min-w-[110px]"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                </select>
                <div className="flex items-center gap-2 flex-1 min-w-[170px]">
                  <select
                    value={s.startTime}
                    onChange={e => updateDraft(s.key, 'startTime', e.target.value)}
                    className="w-full border border-border-theme bg-white rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-primary appearance-none"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                  </select>
                  <span className="text-text-sub text-xs">to</span>
                  <select
                    value={s.endTime}
                    onChange={e => updateDraft(s.key, 'endTime', e.target.value)}
                    className="w-full border border-border-theme bg-white rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-primary appearance-none"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                  </select>
                </div>
                <span className="text-[11px] font-bold text-text-main font-mono italic w-14 text-right">
                  {formatHours(calculateShiftHours(s.startTime, s.endTime))}h
                </span>
                <button
                  type="button"
                  onClick={() => removeDay(s.key)}
                  title="Remove this day"
                  className="p-2 text-error bg-error/10 hover:bg-error hover:text-white rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addDay}
              className="w-full py-3 border-2 border-dashed border-border-theme text-primary font-bold text-xs rounded-xl hover:bg-surface hover:border-primary transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Plus className="w-3.5 h-3.5" /> Add a day
            </button>

            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5">
                Reason for this change <span className="text-error">*</span>
              </label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                placeholder="e.g. Wednesday is cancelled, we're travelling."
                className="w-full bg-white border border-border-theme rounded-xl p-3 text-xs min-h-[72px] outline-none focus:border-primary transition-all text-text-main"
              />
            </div>
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-10 text-center text-text-sub italic text-sm bg-surface rounded-xl border border-border-theme">
            No hours scheduled for this week.
          </div>
        ) : (
          <VisualCalendar shifts={shifts} scheduleStatus={status} weekStartDate={weekStartDate} />
        )}

        {schedule?.explanation && !isEditing && (
          <div className="p-4 bg-surface rounded-xl border border-border-theme flex gap-3">
            <MessageSquare className="w-4 h-4 text-text-sub shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-bold text-text-sub uppercase tracking-widest mb-1">
                Reason from {schedule.lastAdjustedByRole?.toLowerCase() ?? 'requester'}
              </p>
              <p className="text-[11px] text-text-main italic leading-relaxed">"{schedule.explanation}"</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-error/10 text-error text-xs font-bold rounded-lg">{error}</div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 border-t border-border-theme">
          <p className="text-[10px] text-text-sub">
            {locked
              ? 'This week is closed. Changes were allowed until 7 days after it ended.'
              : `Adjustable for ${graceDays} more day${graceDays === 1 ? '' : 's'}.`}
          </p>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); setError(null); }}
                  className="flex-1 md:flex-none px-5 py-2.5 rounded-lg text-[10px] font-bold text-text-sub border border-border-theme hover:bg-surface transition-all uppercase tracking-widest"
                >
                  Discard
                </button>
                <button
                  onClick={saveAdjustment}
                  disabled={loading}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-[10px] font-bold hover:bg-primary/90 disabled:opacity-50 uppercase tracking-widest transition-all"
                >
                  {loading
                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Save className="w-3.5 h-3.5" />}
                  {user.role === 'ADMIN' ? 'Save' : 'Send request'}
                </button>
              </>
            ) : (
              <>
                {showAdjust && (
                  <button
                    onClick={startAdjusting}
                    className="flex-1 md:flex-none px-5 py-2.5 rounded-lg text-[10px] font-bold text-text-sub border border-border-theme hover:bg-surface transition-all uppercase tracking-widest"
                  >
                    Adjust
                  </button>
                )}
                {showApprove && (
                  <button
                    onClick={approve}
                    disabled={loading}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg text-[10px] font-bold hover:bg-primary/90 disabled:opacity-50 uppercase tracking-widest transition-all"
                  >
                    {loading
                      ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                )}
                {!showApprove && !isStandard && status !== 'APPROVED' && status !== 'DISPUTE' && (
                  <span className="text-[10px] font-bold text-text-sub italic bg-surface px-4 py-2.5 rounded-lg uppercase tracking-wider border border-border-theme">
                    {statusLabel()}
                  </span>
                )}
                {status === 'DISPUTE' && user.role !== 'ADMIN' && (
                  <span className="text-[10px] font-bold text-error italic bg-error/5 px-4 py-2.5 rounded-lg uppercase tracking-wider border border-error/20 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Awaiting admin
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {status === 'DISPUTE' && schedule && <DisputeChat scheduleId={schedule.id} user={user} />}
      </div>
    </div>
  );
}
