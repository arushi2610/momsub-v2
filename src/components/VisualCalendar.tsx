import React from 'react';
import { Shift, WeeklySchedule } from '../types';
import { formatHours } from '../lib/utils';

interface VisualCalendarProps {
  shifts: Shift[];
  scheduleStatus: WeeklySchedule['status'];
  weekStartDate?: string;
}

const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function VisualCalendar({ shifts, scheduleStatus, weekStartDate }: VisualCalendarProps) {
  // Determine color theme based on schedule status
  const getColorClasses = () => {
    switch (scheduleStatus) {
      case 'APPROVED':
        return 'bg-success shadow-success/20';
      case 'DISPUTE':
        return 'bg-error shadow-error/20';
      default:
        return 'bg-primary shadow-primary/20';
    }
  };

  const getDayInitial = (day: string) => {
    const map: Record<string, string> = {
      'MONDAY': 'M', 'TUESDAY': 'T', 'WEDNESDAY': 'W', 'THURSDAY': 'T', 
      'FRIDAY': 'F', 'SATURDAY': 'S', 'SUNDAY': 'S'
    };
    return map[day];
  };

  const totalHours = shifts.reduce((sum, shift) => sum + shift.totalHours, 0);

  const getExactDate = (dayIndex: number) => {
    if (!weekStartDate || String(weekStartDate).toLowerCase() === 'undefined') return null;
    try {
      const parts = weekStartDate.split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts;
      const date = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
      date.setDate(date.getDate() + dayIndex);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    } catch(e) {
      return null;
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border-theme overflow-hidden flex flex-col">
      {/* Total Hours Summary */}
      <div className="px-4 py-3 bg-white border-b border-border-theme flex justify-between items-center">
        <span className="text-[10px] font-bold text-text-sub uppercase tracking-widest">Weekly Total</span>
        <span className="text-lg font-black font-mono italic text-text-main">{formatHours(totalHours)} <span className="text-xs not-italic font-bold uppercase opacity-70 tracking-tight">Hrs</span></span>
      </div>

      <div className="flex pl-8 md:pl-10 border-b border-border-theme bg-white">
        {days.map((day, index) => (
          <div 
            key={day} 
            className="flex-1 text-center py-2 text-[10px] font-bold text-text-sub uppercase tracking-widest border-r border-border-theme last:border-r-0 flex flex-col items-center justify-center gap-0.5"
          >
            <div>
              <span className="hidden md:inline">{day.slice(0, 3)}</span>
              <span className="inline md:hidden">{getDayInitial(day)}</span>
            </div>
            {weekStartDate && getExactDate(index) && (
               <div className="text-[9px] opacity-70 font-mono tracking-tighter normal-case">
                  {getExactDate(index)}
               </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Grid Body */}
      <div className="relative h-[280px] md:h-[320px] flex bg-white/50">
        {/* Y-axis (Time markers) */}
        <div className="w-8 md:w-10 flex flex-col justify-between py-2 text-[9px] font-bold text-text-sub/70 pr-2 text-right border-r border-border-theme bg-surface z-10">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>

        {/* Grid Columns container */}
        <div className="flex-1 flex relative">
          {/* Background Grid Lines (Horizontal for time intervals) */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20 z-0">
            <div className="border-t border-border-theme w-full" />
            <div className="border-t border-border-theme w-full" />
            <div className="border-t border-border-theme w-full" />
            <div className="border-t border-border-theme w-full" />
            <div className="border-t border-border-theme w-full" />
          </div>

          {/* Vertical Day Columns & Shift Blocks */}
          {days.map((day) => {
            const dayShifts = shifts.filter(s => s.dayOfWeek === day);

            return (
              <div key={day} className="flex-1 border-r border-border-theme/50 last:border-r-0 relative group/col hover:bg-black/[0.02] transition-colors z-10">
                {dayShifts.map((shift, i) => {
                  const [sh, sm] = shift.startTime.split(':').map(Number);
                  const [eh, em] = shift.endTime.split(':').map(Number);
                  const startMins = sh * 60 + sm;
                  let endMins = eh * 60 + em;
                  if (endMins <= startMins) endMins += 24 * 60;
                  
                  let top = (startMins / 1440) * 100;
                  let height = ((endMins - startMins) / 1440) * 100;
                  if (height > 100 - top) height = 100 - top;

                  return (
                    <div 
                      key={`${day}-${i}`}
                      className={`absolute left-0.5 right-0.5 md:left-1 md:right-1 rounded-md md:rounded-lg overflow-hidden shadow-md cursor-default group/shift hover:scale-[1.02] hover:z-20 transition-all ${shift.colorClass || getColorClasses()}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <div className="w-full h-full p-1 flex flex-col items-center justify-center relative">
                        {/* Hover Overlay with precise times */}
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center opacity-0 group-hover/shift:opacity-100 transition-opacity z-10 text-white p-1">
                          <span className="text-[9px] md:text-[10px] font-bold font-mono">{shift.startTime}</span>
                          <span className="text-[8px] text-white/50 my-0.5">to</span>
                          <span className="text-[9px] md:text-[10px] font-bold font-mono">{shift.endTime}</span>
                        </div>
                        
                        {/* Default View (when tall enough) */}
                        {height > 12 && (
                          <span className="text-[10px] md:text-sm font-black text-white tracking-tight opacity-100 group-hover/shift:opacity-0 transition-opacity">
                            {formatHours(shift.totalHours)}<span className="text-[8px] font-bold opacity-80 uppercase ml-0.5 hidden md:inline">hrs</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
