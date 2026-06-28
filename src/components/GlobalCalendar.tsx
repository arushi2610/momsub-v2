import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
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
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    return d.toISOString().split('T')[0];
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

    const fetchShiftsForWeek = async () => {
      setLoading(true);
      try {
        const shiftsArray: Shift[] = [];
        
        // Target specifically APPROVED schedules for the selected week
        const relevantSchedules = schedules.filter(s =>
          s.status === 'APPROVED' &&
          s.weekStartDate === selectedWeek
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

        for (const schedule of relevantSchedules) {
          if (!matchIdToColor.has(schedule.matchId)) {
            matchIdToColor.set(schedule.matchId, matchColors[colorCounter % matchColors.length]);
            colorCounter++;
          }
          const colorClass = matchIdToColor.get(schedule.matchId)!;

          const q = query(collection(db, `schedules/${schedule.id}/shifts`));
          const snapshot = await getDocs(q);
          const mapped = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            colorClass
          } as Shift));
          shiftsArray.push(...mapped);
        }

        if (active) {
          setAllShifts(shiftsArray);
          setLoading(false);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'shifts');
        if (active) setLoading(false);
      }
    };

    fetchShiftsForWeek();

    return () => {
      active = false;
    };
  }, [schedules, selectedWeek]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">Master Calendar</h3>
          <p className="text-xs text-text-sub">Combined schedule view for the selected week.</p>
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
