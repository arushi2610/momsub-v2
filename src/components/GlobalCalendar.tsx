import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { Shift, WeeklySchedule } from '../types';
import VisualCalendar from './VisualCalendar';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GlobalCalendarProps {
  schedules: WeeklySchedule[];
}

export default function GlobalCalendar({ schedules }: GlobalCalendarProps) {
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize selected week to current local week's Monday
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - daysToSubtract);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const getWeekStartStr = (offsetWeeks: number) => {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + (offsetWeeks * 7));
    return d.toISOString().split('T')[0];
  };

  const formattedWeekLabel = useMemo(() => {
    if (!selectedWeek) return 'Unknown Week';
    const [y, m, d] = selectedWeek.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(date.getTime())) return `Week of ${selectedWeek}`;
    return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
  }, [selectedWeek]);

  useEffect(() => {
    let active = true;
    const unsubscribers: (() => void)[] = [];

    const normalizeWeekStart = (dateValue: any): string => {
      let date: Date;

      if (typeof dateValue === 'string') {
        const [y, m, d] = dateValue.split('-');
        date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      } else if (dateValue instanceof Date) {
        date = new Date(dateValue);
      } else if (dateValue && typeof dateValue.toDate === 'function') {
        date = new Date(dateValue.toDate());
      } else {
        return String(dateValue);
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const setupShiftListeners = () => {
      setLoading(true);
      const shiftsArray: Shift[] = [];

      const relevantSchedules = schedules.filter(s =>
        s.status === 'APPROVED' &&
        normalizeWeekStart(s.weekStartDate) === selectedWeek
      );

      const matchColors = [
        'bg-primary shadow-primary/20',
        'bg-success shadow-success/20',
        'bg-warning shadow-warning/20',
        'bg-error shadow-error/20',
        'bg-blue-500 shadow-blue-500/20',
        'bg-purple-500 shadow-purple-500/20',
        'bg-pink-500 shadow-pink-500/20',
        'bg-teal-500 shadow-teal-500/20',
      ];

      const matchIdToColor = new Map<string, string>();
      let colorCounter = 0;
      let loadedSchedules = 0;

      if (relevantSchedules.length === 0) {
        if (active) {
          setAllShifts([]);
          setLoading(false);
        }
        return;
      }

      const allScheduleShifts: { [scheduleId: string]: Shift[] } = {};

      for (const schedule of relevantSchedules) {
        if (!matchIdToColor.has(schedule.matchId)) {
          matchIdToColor.set(schedule.matchId, matchColors[colorCounter % matchColors.length]);
          colorCounter++;
        }
        const colorClass = matchIdToColor.get(schedule.matchId)!;

        const q = query(collection(db, `schedules/${schedule.id}/shifts`));
        const unsub = onSnapshot(q, (snapshot) => {
          allScheduleShifts[schedule.id] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            colorClass
          } as Shift));

          if (active) {
            const combined = Object.values(allScheduleShifts).flat();
            setAllShifts(combined);
            setLoading(false);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'shifts');
          loadedSchedules++;
          if (loadedSchedules === relevantSchedules.length && active) {
            setLoading(false);
          }
        });

        unsubscribers.push(unsub);
      }
    };

    setupShiftListeners();

    return () => {
      active = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [schedules, selectedWeek]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">Family Calendar</h3>
          <p className="text-xs text-text-sub">Combined work schedule view for the selected week.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedWeek(getWeekStartStr(-1))}
            className="p-1.5 rounded-lg border border-border-theme hover:bg-surface text-text-sub hover:text-text-main transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold w-32 text-center text-text-main">
            {formattedWeekLabel}
          </span>
          <button 
            onClick={() => setSelectedWeek(getWeekStartStr(1))}
            className="p-1.5 rounded-lg border border-border-theme hover:bg-surface text-text-sub hover:text-text-main transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="bg-surface rounded-xl border border-border-theme h-[400px] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : allShifts.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border-theme h-[400px] flex flex-col items-center justify-center p-6 text-center">
          <p className="text-text-main font-bold mb-2">No Active Shifts Found</p>
          <p className="text-xs text-text-sub max-w-[250px]">No approved or pending shifts are scheduled for {formattedWeekLabel}.</p>
        </div>
      ) : (
        <VisualCalendar shifts={allShifts} scheduleStatus="APPROVED" />
      )}
    </div>
  );
}
