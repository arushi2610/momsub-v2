export type UserRole = 'ADMIN' | 'PARENT' | 'NANNY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  requestedHours?: number;
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
export type ScheduleType = 'STANDARD' | 'WEEKLY_PLANNED' | 'WEEKLY_ACTUAL';

export interface WeeklySchedule {
  id: string;
  matchId: string;
  weekStartDate: string; // YYYY-MM-DD
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

export interface Shift {
  id: string;
  scheduleId: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  totalHours: number;
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
