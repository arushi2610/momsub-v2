import React, { useState, useEffect } from 'react';
import { WeeklySchedule, Shift, User, Approval, UserRole, ScheduleStatus } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { Clock, CheckCircle2, AlertCircle, MessageSquare, ChevronDown, ChevronUp, Save, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { calculateShiftHours, calculateTotalHours, snapTime15, TIME_OPTIONS, formatTimeLabel, formatHours } from '../lib/utils';
import { getErrorMessage } from '../lib/firebase';
import DisputeChat from './DisputeChat';
import VisualCalendar from './VisualCalendar';

interface ScheduleCardProps {
  schedule: WeeklySchedule;
  user: User;
  match: any;
  onRefresh?: () => void;
  onNavigateWeek?: (dir: 'prev' | 'next', targetWeek: string) => void;
  key?: React.Key;
}

export default function ScheduleCard({ schedule, user, match, onRefresh, onNavigateWeek }: ScheduleCardProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedShifts, setEditedShifts] = useState<Shift[]>([]);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const [localWeek, setLocalWeek] = useState(() => {
    if (schedule.weekStartDate && String(schedule.weekStartDate).toLowerCase() !== 'undefined') {
       return schedule.weekStartDate as string;
    }
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (schedule.weekStartDate && String(schedule.weekStartDate).toLowerCase() !== 'undefined') {
       setLocalWeek(schedule.weekStartDate as string);
    }
  }, [schedule.weekStartDate]);

  const handleNavigateWeek = (e: React.MouseEvent, dir: 'prev' | 'next') => {
      e.stopPropagation();
      const [y, m, d] = String(localWeek).split('-');
      const date = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
      date.setDate(date.getDate() + (dir === 'next' ? 7 : -7));
      const nextWeekStr = date.toISOString().split('T')[0];
      if (onNavigateWeek) onNavigateWeek(dir, nextWeekStr);
  };

  useEffect(() => {
    const qShifts = query(collection(db, `schedules/${schedule.id}/shifts`));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    });

    const qApprovals = query(collection(db, `schedules/${schedule.id}/approvals`));
    const unsubApprovals = onSnapshot(qApprovals, (snap) => {
      setApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Approval)));
    });

    return () => {
      unsubShifts();
      unsubApprovals();
    };
  }, [schedule.id]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const isAdmin = () => user.role === 'ADMIN';

  const handleApprove = async () => {
    if (!match?.id) {
      handleFirestoreError(new Error('No match found'), OperationType.WRITE, 'schedules');
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'schedules', schedule.id), { status: 'APPROVED' });
      onRefresh?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `schedules/${schedule.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!isEditing || !explanation.trim() || editedShifts.length === 0) {
      alert('Please enter a reason for the adjustment');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'schedules', schedule.id), {
        status: isAdmin() ? 'APPROVED' : 'PENDING_PARENT',
        adjustmentsCount: (schedule.adjustmentsCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      for (const existingShift of shifts) {
        batch.delete(doc(db, `schedules/${schedule.id}/shifts`, existingShift.id));
      }

      for (const newShift of editedShifts) {
        batch.set(doc(db, `schedules/${schedule.id}/shifts`, newShift.id), newShift);
      }

      await addDoc(collection(db, `schedules/${schedule.id}/audit`), {
        action: 'ADJUSTED',
        role: user.role,
        reason: explanation.trim(),
        timestamp: serverTimestamp(),
        previousStatus: schedule.status,
        newStatus: isAdmin() ? 'APPROVED' : 'PENDING_PARENT',
      });

      await batch.commit();
      setIsEditing(false);
      setEditedShifts([]);
      setExplanation('');
      onRefresh?.();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `schedules/${schedule.id}`);
    } finally {
      setLoading(false);
    }
  };

  const startAdjusting = () => {
    setIsEditing(true);
    setEditedShifts(JSON.parse(JSON.stringify(shifts)));
    setExplanation('');
  };

  const updateEditedShift = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setEditedShifts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const getStatusLabel = () => {
    switch (schedule.status) {
      case 'PENDING_NANNY': return 'Awaiting Nanny';
      case 'PENDING_PARENT': return 'Awaiting Parent';
      case 'APPROVED': return 'Approved';
      case 'DISPUTE': return 'Disputed';
      default: return schedule.status;
    }
  };

  const getBorderClass = (status: ScheduleStatus) => {
    switch (status) {
      case 'APPROVED': return 'border-success/50 shadow-lg shadow-success/10';
      case 'DISPUTE': return 'border-error/50 shadow-lg shadow-error/10';
      default: return 'border-border-theme shadow-sm';
    }
  };

  return (
    <div id={`schedule-${schedule.id}`} className={`bg-white border transition-all duration-300 rounded-xl overflow-hidden ${getBorderClass(schedule.status)}`}>
      <div className="px-6 py-4 bg-surface border-b border-border-theme flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-text-main tracking-tight uppercase">
                {(() => {
                  try {
                    const [y, m, d] = String(localWeek).split('-');
                    const startDate = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
                    if (isNaN(startDate.getTime())) return localWeek;
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    return `${startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
                  } catch(e) {
                    return String(localWeek) || 'Unknown';
                  }
                })()}
              </h3>
              {onNavigateWeek && (
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={(e) => handleNavigateWeek(e, 'prev')} className="p-1 hover:bg-black/5 rounded text-text-sub hover:text-text-main transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => handleNavigateWeek(e, 'next')} className="p-1 hover:bg-black/5 rounded text-text-sub hover:text-text-main transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${schedule.type === 'WEEKLY_ACTUAL' ? 'bg-warning/10 text-warning' : schedule.type === 'STANDARD' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-primary/10 text-primary'}`}>
                 {schedule.type.replace('WEEKLY_', '')}
              </span>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                 <span className={`w-1.5 h-1.5 rounded-full ${schedule.status === 'APPROVED' ? 'bg-success' : schedule.status === 'DISPUTE' ? 'bg-error' : schedule.status === 'PENDING_PARENT' ? 'bg-primary' : 'bg-warning'}`}></span>
                 <p className={`text-[10px] font-bold uppercase tracking-tight ${schedule.status === 'APPROVED' ? 'text-success' : schedule.status === 'DISPUTE' ? 'text-error' : schedule.status === 'PENDING_PARENT' ? 'text-primary' : 'text-warning'}`}>{getStatusLabel()}</p>
               </div>
               {(schedule.status === 'PENDING_PARENT' || schedule.status === 'PENDING_NANNY') && schedule.updatedAt && (() => {
                 const daysPending = Math.floor((Date.now() - (schedule.updatedAt.seconds ? schedule.updatedAt.seconds * 1000 : Date.now())) / (1000 * 60 * 60 * 24));
                 if (daysPending >= 3) {
                   return (
                     <span className="text-[9px] font-bold text-warning uppercase px-1.5 py-0.5 rounded bg-warning/10">
                       Pending {daysPending}d
                     </span>
                   );
                 }
               })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xl font-bold text-text-main font-mono italic tracking-tighter">
              {formatHours(isEditing ? calculateTotalHours(editedShifts) : schedule.totalHours)}
              <span className="text-[10px] font-bold text-text-sub ml-1 uppercase not-italic">hrs</span>
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-border-theme/30 rounded-lg transition-colors text-text-sub"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-6 space-y-6">
          {isEditing ? (
            <div className="bg-surface rounded-xl border border-border-theme overflow-hidden">
              {editedShifts.length === 0 ? (
                <div className="px-6 py-12 text-center text-text-sub italic text-sm">
                  No shifts recorded yet.
                </div>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-4 px-6 py-2 bg-border-theme/20 border-b border-border-theme text-[9px] font-bold text-text-sub uppercase tracking-widest">
                    <span>Day</span>
                    <span>Timeline</span>
                    <span className="text-right col-span-2">Hours</span>
                  </div>
                  <div className="divide-y divide-border-theme">
                    {editedShifts.sort((a,b) => days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek)).map((s) => (
                      <div key={s.id} className="flex flex-col sm:grid sm:grid-cols-4 px-4 sm:px-6 py-3 sm:items-center hover:bg-white transition-colors gap-2 sm:gap-0">
                        <span className="text-[11px] font-bold text-text-main uppercase tracking-tight">{s.dayOfWeek.slice(0, 3)}</span>
                        <div className="sm:col-span-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={s.startTime}
                              onChange={e => updateEditedShift(s.id, 'startTime', e.target.value)}
                              className="text-[11px] font-bold bg-white border border-border-theme rounded px-1.5 py-0.5 outline-none focus:border-primary appearance-none min-w-[70px] flex-1 sm:flex-none text-center"
                            >
                               {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                            </select>
                            <span className="text-[10px] text-text-sub">/</span>
                            <select
                              value={s.endTime}
                              onChange={e => updateEditedShift(s.id, 'endTime', e.target.value)}
                              className="text-[11px] font-bold bg-white border border-border-theme rounded px-1.5 py-0.5 outline-none focus:border-primary appearance-none min-w-[70px] flex-1 sm:flex-none text-center"
                            >
                               {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                            </select>
                          </div>
                        </div>
                        <p className="text-left sm:text-right text-[11px] font-bold text-text-main font-mono italic">
                          {formatHours(calculateShiftHours(s.startTime, s.endTime))} <span className="text-[9px] not-italic text-text-sub uppercase">hrs</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {shifts.length === 0 ? (
                <div className="p-12 text-center text-text-sub italic text-sm bg-surface rounded-xl border border-border-theme">
                  No shifts recorded for this schedule.
                </div>
              ) : (
                <VisualCalendar shifts={shifts} scheduleStatus={schedule.status} weekStartDate={localWeek} />
              )}
            </>
          )}

          {isEditing && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-wider block">Note / Reason</label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                placeholder="Briefly state the reason for adjustment..."
                className="w-full bg-white border border-border-theme rounded-xl p-3 text-xs min-h-[80px] outline-none focus:border-primary transition-all text-text-main"
              />
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 pt-4 md:pt-6 border-t border-border-theme">
             <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
               {schedule.adjustmentsCount ? (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-warning/30 bg-warning/5 text-warning">
                   <AlertCircle className="w-3 h-3" />
                   <span className="text-[9px] font-bold uppercase tracking-tight">Adjusted {schedule.adjustmentsCount}x</span>
                 </div>
               ) : null}
             </div>

             <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                {isEditing && (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-2 rounded-lg text-[10px] font-bold text-text-sub border border-border-theme hover:bg-surface transition-all uppercase tracking-widest"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleAdjustment}
                      disabled={loading || (!explanation && user.role !== 'ADMIN')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-4 md:px-6 py-3 md:py-2 rounded-lg text-[10px] font-bold shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 uppercase tracking-widest"
                    >
                      {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Changes
                    </button>
                  </>
                )}

                {!isEditing && schedule.status !== 'APPROVED' && schedule.status !== 'DISPUTE' && !isAdmin() && (
                  (user.role === 'NANNY' && schedule.status === 'PENDING_NANNY') ||
                  (user.role === 'PARENT' && schedule.status === 'PENDING_PARENT') ? (
                    <>
                      <button
                        onClick={startAdjusting}
                        className="px-6 py-2 rounded-lg text-[10px] font-bold text-text-sub border border-border-theme hover:bg-surface transition-all uppercase tracking-widest"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={loading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-8 py-2 rounded-lg text-[10px] font-bold shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 uppercase tracking-widest"
                      >
                        {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-text-sub italic bg-surface px-4 py-2 rounded-lg uppercase tracking-wider border border-border-theme">Awaiting Other Party...</span>
                  )
                )}

                {!isEditing && schedule.status === 'DISPUTE' && !isAdmin() && (
                   <span className="text-[10px] font-bold text-error italic bg-error/5 px-4 py-2 rounded-lg uppercase tracking-wider border border-error/20 flex items-center gap-2">
                     <AlertCircle className="w-3.5 h-3.5" /> Awaiting Admin
                   </span>
                )}

                {schedule.status === 'APPROVED' && (
                  <div className="flex items-center gap-2 text-success font-bold uppercase text-[10px] tracking-widest bg-success/5 px-4 py-2 rounded-lg border border-success/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved
                  </div>
                )}
             </div>
          </div>

          {schedule.status === 'DISPUTE' && schedule.explanation && (
            <div className="p-4 bg-error/5 rounded-xl border border-error/10 flex gap-3">
              <MessageSquare className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-error uppercase tracking-widest mb-1">Reason</p>
                <p className="text-[11px] text-text-main italic leading-relaxed">"{schedule.explanation}"</p>
              </div>
            </div>
          )}

          {schedule.status === 'DISPUTE' && (
            <DisputeChat scheduleId={schedule.id} user={user} />
          )}
        </div>
      )}
    </div>
  );
}
