import React, { useState, useEffect, useMemo } from 'react';
import { User, Match, WeeklySchedule, Shift, WeekView } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import ScheduleCard from './ScheduleCard';
import {
  getWeekStart,
  addWeeks,
  formatWeekRangeLong,
  describeWeekOffset,
  isWeekLocked,
  normalizeWeekStart,
} from '../lib/week';

interface WeekNavigatorProps {
  match: Match;
  user: User;
  /** Name of the person on the other side, for context under the title. */
  counterpartName?: string;
}

/**
 * The one place a week is assembled. Every week in history and every week in the
 * future is viewable: if it has no WEEKLY record it renders the pair's recurring
 * STANDARD schedule instead, so there is always something to see and adjust.
 */
export default function WeekNavigator({ match, user, counterpartName }: WeekNavigatorProps) {
  const [week, setWeek] = useState(() => getWeekStart());
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [shiftsBySchedule, setShiftsBySchedule] = useState<Record<string, Shift[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'schedules'), where('matchId', '==', match.id));
    const unsub = onSnapshot(q, snap => {
      setSchedules(
        snap.docs.map(d => {
          const data = d.data() as WeeklySchedule;
          return {
            ...data,
            id: d.id,
            // Legacy rows were stored with whatever day the picker happened to be on.
            weekStartDate: data.weekStartDate ? normalizeWeekStart(data.weekStartDate) : data.weekStartDate,
          };
        })
      );
      setLoading(false);
    });
    return () => unsub();
  }, [match.id]);

  const standard = useMemo(() => schedules.find(s => s.type === 'STANDARD') || null, [schedules]);
  const weekly = useMemo(
    () => schedules.find(s => s.type === 'WEEKLY' && s.weekStartDate === week) || null,
    [schedules, week]
  );
  const active = weekly ?? standard;

  useEffect(() => {
    if (!active) return;
    const q = query(collection(db, `schedules/${active.id}/shifts`));
    const unsub = onSnapshot(q, snap => {
      setShiftsBySchedule(prev => ({
        ...prev,
        [active.id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)),
      }));
    });
    return () => unsub();
  }, [active?.id]);

  const weekView: WeekView = {
    weekStartDate: week,
    matchId: match.id,
    schedule: weekly,
    shifts: active ? shiftsBySchedule[active.id] ?? [] : [],
    isStandard: !weekly,
    locked: isWeekLocked(week),
  };

  const offsetLabel = describeWeekOffset(week);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 bg-white border border-border-theme rounded-xl px-3 sm:px-4 py-3">
        <button
          onClick={() => setWeek(w => addWeeks(w, -1))}
          className="p-2 rounded-lg border border-border-theme text-text-sub hover:text-text-main hover:bg-surface transition-colors shrink-0"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center min-w-0">
          <div className="flex items-center justify-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-text-sub shrink-0" />
            <p className="text-sm font-bold text-text-main tracking-tight truncate">{formatWeekRangeLong(week)}</p>
          </div>
          <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest mt-0.5">
            {offsetLabel}
            {counterpartName ? ` · ${counterpartName}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {week !== getWeekStart() && (
            <button
              onClick={() => setWeek(getWeekStart())}
              className="hidden sm:block px-3 py-2 rounded-lg border border-border-theme text-[10px] font-bold text-text-sub hover:text-text-main hover:bg-surface transition-colors uppercase tracking-widest"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeek(w => addWeeks(w, 1))}
            className="p-2 rounded-lg border border-border-theme text-text-sub hover:text-text-main hover:bg-surface transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-xl border border-border-theme animate-pulse" />
      ) : !standard && !weekly ? (
        <div className="bg-white p-12 rounded-xl border border-dashed border-border-theme text-center">
          <p className="text-xs text-text-sub font-bold uppercase tracking-widest mb-1">No recurring schedule</p>
          <p className="text-xs text-text-sub">
            An admin needs to set the recurring schedule for this pair before weeks can be adjusted.
          </p>
        </div>
      ) : (
        <ScheduleCard weekView={weekView} user={user} match={match} />
      )}
    </div>
  );
}
