export type UserRole = 'ADMIN' | 'PARENT' | 'NANNY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  requestedHours?: number;
  // Missing status is treated as ACTIVE everywhere — existing records predate this field.
  status?: 'ACTIVE' | 'ARCHIVED';
  createdAt: any;
}

export interface Match {
  id: string;
  parentId: string;
  nannyId: string;
  adminId: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: any;
  // Join data
  parentName?: string;
  nannyName?: string;
}

export type ScheduleStatus = 'PENDING_NANNY' | 'PENDING_PARENT' | 'APPROVED' | 'DISPUTE';

// STANDARD: the recurring schedule for a pair. Admin-owned, has no weekStartDate,
//   and populates every week that has no WEEKLY record of its own.
// WEEKLY: one week that has been adjusted away from the standard. Exactly one per
//   week per match — it is that week's CURRENT schedule.
// WEEKLY_SUPERSEDED: a duplicate week left over from the old model, kept for the
//   record but ignored everywhere. Only the migration produces these.
export type ScheduleType = 'STANDARD' | 'WEEKLY' | 'WEEKLY_SUPERSEDED';

export interface WeeklySchedule {
  id: string;
  matchId: string;
  weekStartDate: string; // YYYY-MM-DD, always a Monday. Absent on STANDARD.
  type: ScheduleType;
  status: ScheduleStatus;
  totalHours: number;
  version: number;
  adjustmentsCount?: number;
  lastAdjustedByRole?: UserRole;
  updatedAt: any;
  updatedBy: string;
  explanation?: string;
}

/**
 * What a given week actually looks like. If no WEEKLY record exists the week is
 * still fully defined — it inherits the pair's STANDARD schedule — so the UI
 * always has something to show and something to adjust.
 */
export interface WeekView {
  weekStartDate: string;
  matchId: string;
  schedule: WeeklySchedule | null; // null while the week is still the plain standard
  shifts: Shift[];
  isStandard: boolean; // true = inherited, never adjusted
  locked: boolean; // past the 7-day-after-Sunday deadline
}

export interface Shift {
  id: string;
  scheduleId: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  totalHours: number;
  colorClass?: string; // UI-only: assigned for calendar rendering
}

export interface Approval {
  id: string;
  scheduleId: string;
  userId: string;
  role: UserRole;
  status: 'APPROVED' | 'CHANGES_REQUESTED';
  explanation?: string;
  timestamp: any;
}

export interface DisputeMessage {
  id: string;
  scheduleId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: string;
  read: boolean;
  link?: string;
  scheduleId?: string;
  createdAt: any;
}
