import { Shift } from '../types';

export function calculateShiftHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  if (endMinutes < startMinutes) {
    // Overlap to next day
    endMinutes += 24 * 60;
  }
  
  return (endMinutes - startMinutes) / 60;
}

export const TIME_OPTIONS = Array.from({ length: 24 * 4 }).map((_, i) => {
  const hours = Math.floor(i / 4).toString().padStart(2, '0');
  const mins = ((i % 4) * 15).toString().padStart(2, '0');
  return `${hours}:${mins}`;
});

export function formatTimeLabel(timeStr: string) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function snapTime15(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  
  const remainder = m % 15;
  if (remainder !== 0) {
    m = Math.round(m / 15) * 15;
    if (m === 60) {
      m = 0;
      h = (h + 1) % 24;
    }
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatHours(hours: number): string {
  return Number(hours.toFixed(2)).toString();
}

export function calculateTotalHours(shifts: Partial<Shift>[]): number {
  return shifts.reduce((total, shift) => {
    if (shift.startTime && shift.endTime) {
      return total + calculateShiftHours(shift.startTime, shift.endTime);
    }
    return total;
  }, 0);
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) return { valid: false, error: 'Email is required' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) return { valid: false, error: 'Password is required' };
  if (password.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
  return { valid: true };
}

export function validateTimeRange(startTime: string, endTime: string): { valid: boolean; error?: string } {
  if (!startTime || !endTime) return { valid: false, error: 'Start and end time are required' };
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMin = startH * 60 + startM;
  let endMin = endH * 60 + endM;
  if (endMin === startMin) return { valid: false, error: 'End time must be after start time' };
  if (endMin < startMin) endMin += 24 * 60;
  if (endMin - startMin > 12 * 60) return { valid: false, error: 'Shift cannot exceed 12 hours' };
  return { valid: true };
}

export function validateHours(hours: number): { valid: boolean; error?: string } {
  if (typeof hours !== 'number' || hours < 0) return { valid: false, error: 'Hours must be positive' };
  if (hours > 168) return { valid: false, error: 'Hours cannot exceed 168 (one week)' };
  if (hours === 0) return { valid: false, error: 'Hours must be greater than 0' };
  return { valid: true };
}

export function getScheduleRetentionDate(monthsToKeep: number = 3): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsToKeep);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isScheduleArchivable(schedule: any, monthsToKeep: number = 3): boolean {
  if (!schedule.updatedAt) return false;
  const scheduleDate = schedule.updatedAt.seconds
    ? new Date(schedule.updatedAt.seconds * 1000)
    : new Date(schedule.updatedAt);
  const cutoffDate = getScheduleRetentionDate(monthsToKeep);
  return scheduleDate < cutoffDate && schedule.status === 'APPROVED';
}

export function checkShiftOverlap(
  shifts: Array<{ dayOfWeek: string; startTime: string; endTime: string }>,
  existingShifts: Array<{ dayOfWeek: string; startTime: string; endTime: string }>
): { hasOverlap: boolean; conflict?: string } {
  for (const newShift of shifts) {
    for (const existing of existingShifts) {
      if (newShift.dayOfWeek !== existing.dayOfWeek) continue;

      const [nStartH, nStartM] = newShift.startTime.split(':').map(Number);
      const [nEndH, nEndM] = newShift.endTime.split(':').map(Number);
      const [eStartH, eStartM] = existing.startTime.split(':').map(Number);
      const [eEndH, eEndM] = existing.endTime.split(':').map(Number);

      const nStart = nStartH * 60 + nStartM;
      let nEnd = nEndH * 60 + nEndM;
      const eStart = eStartH * 60 + eStartM;
      let eEnd = eEndH * 60 + eEndM;

      if (nEnd < nStart) nEnd += 24 * 60;
      if (eEnd < eStart) eEnd += 24 * 60;

      if ((nStart < eEnd && nEnd > eStart) || (eStart < nEnd && eEnd > nStart)) {
        return {
          hasOverlap: true,
          conflict: `Overlaps with existing shift on ${newShift.dayOfWeek} (${existing.startTime}-${existing.endTime})`
        };
      }
    }
  }
  return { hasOverlap: false };
}
