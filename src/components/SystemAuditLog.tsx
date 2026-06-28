import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Match, User, WeeklySchedule, DisputeMessage, Approval } from '../types';
import { formatHours } from '../lib/utils';
import { Clock, ShieldCheck, AlertCircle, MessageSquare, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface SystemAuditLogProps {
  schedules: WeeklySchedule[];
  matches: Match[];
  users: User[];
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  type: 'SCHEDULE_CREATED' | 'SCHEDULE_APPROVED' | 'DISPUTE_OPENED' | 'DISPUTE_MESSAGE' | 'HOURS_WORKED';
  title: string;
  description: string;
  matchId: string;
  scheduleId?: string;
  relatedUser?: string;
}

export default function SystemAuditLog({ schedules, matches, users }: SystemAuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const buildAuditLog = async () => {
      setLoading(true);
      try {
        const tempLogs: AuditLogEntry[] = [];

        // 1. Log Matches Created
        matches.forEach(m => {
          if (m.createdAt) {
            const parent = users.find(u => u.id === m.parentId);
            const nanny = users.find(u => u.id === m.nannyId);
            tempLogs.push({
              id: `match_${m.id}`,
              timestamp: m.createdAt.seconds || 0,
              type: 'SCHEDULE_CREATED',
              title: `Match Created`,
              description: `Pair formed: ${parent?.name || 'Unknown'} & ${nanny?.name || 'Unknown'}`,
              matchId: m.id
            });
          }
        });

        // 2. Fetch history for each schedule
        for (const s of schedules) {
          const match = matches.find(m => m.id === s.matchId);
          const parent = users.find(u => u.id === match?.parentId);
          const nanny = users.find(u => u.id === match?.nannyId);
          const pairNames = `${parent?.name?.split(' ')[0]} & ${nanny?.name?.split(' ')[0]}`;

          // Schedule latest update
          if (s.updatedAt) {
            let type: AuditLogEntry['type'] = 'SCHEDULE_CREATED';
            let title = `Schedule Updated`;
            if (s.status === 'APPROVED') {
               type = 'HOURS_WORKED';
               title = `Hours Logged & Approved`;
            } else if (s.status === 'DISPUTE') {
               type = 'DISPUTE_OPENED';
               title = `Dispute Opened`;
            }

            tempLogs.push({
              id: `sched_${s.id}_${s.updatedAt.seconds}`,
              timestamp: s.updatedAt.seconds || 0,
              type,
              title: `${title} (${pairNames})`,
              description: `Week of ${s.weekStartDate} | Total Hours: ${formatHours(s.totalHours)} | Status: ${s.status}`,
              matchId: s.matchId,
              scheduleId: s.id
            });
          }

          // Approvals
          try {
             const qApprovals = query(collection(db, `schedules/${s.id}/approvals`));
             const snapApprovals = await getDocs(qApprovals);
             snapApprovals.forEach(doc => {
                const a = doc.data() as Approval;
                if (a.timestamp) {
                   const approver = users.find(u => u.id === a.userId);
                   tempLogs.push({
                     id: `app_${doc.id}`,
                     timestamp: a.timestamp.seconds || 0,
                     type: a.status === 'APPROVED' ? 'SCHEDULE_APPROVED' : 'DISPUTE_OPENED',
                     title: `Schedule ${a.status === 'APPROVED' ? 'Approved' : 'Changes Requested'}`,
                     description: `By ${approver?.name || a.role} | Week of ${s.weekStartDate}`,
                     matchId: s.matchId,
                     scheduleId: s.id
                   });
                }
             });
          } catch(e) {}

          // Messages
          try {
             const qMsgs = query(collection(db, `schedules/${s.id}/messages`));
             const snapMsgs = await getDocs(qMsgs);
             snapMsgs.forEach(doc => {
                const mData = doc.data() as DisputeMessage;
                if (mData.createdAt) {
                   tempLogs.push({
                     id: `msg_${doc.id}`,
                     timestamp: mData.createdAt.seconds || 0,
                     type: 'DISPUTE_MESSAGE',
                     title: `Message in Dispute`,
                     description: `${mData.senderName}: "${mData.text.length > 50 ? mData.text.slice(0, 50) + '...' : mData.text}"`,
                     matchId: s.matchId,
                     scheduleId: s.id
                   });
                }
             });
          } catch(e) {}
        }

        // Sort by timestamp desc
        tempLogs.sort((a, b) => b.timestamp - a.timestamp);

        if (active) {
           setLogs(tempLogs);
        }
      } catch (err) {
        console.error("Failed to build audit log", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    buildAuditLog();

    return () => {
      active = false;
    };
  }, [schedules, matches, users]);

  if (loading) {
     return (
       <div className="p-12 flex justify-center">
         <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
       </div>
     );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-8">
       <div className="mb-8">
         <h2 className="text-xl font-extrabold text-text-main tracking-tight uppercase">Audit Logs</h2>
         <p className="text-sm text-text-sub">A chronological history of all schedules, hours worked, approvals, and dispute communications.</p>
       </div>

       <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-theme before:to-transparent">
          {logs.map((log, index) => (
             <motion.div 
               key={log.id}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.3 }}
               className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
             >
               <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 text-primary">
                 {log.type === 'SCHEDULE_CREATED' && <Clock className="w-4 h-4" />}
                 {log.type === 'HOURS_WORKED' && <CheckCircle2 className="w-4 h-4 text-success" />}
                 {log.type === 'DISPUTE_OPENED' && <AlertCircle className="w-4 h-4 text-error" />}
                 {log.type === 'DISPUTE_MESSAGE' && <MessageSquare className="w-4 h-4 text-warning" />}
                 {log.type === 'SCHEDULE_APPROVED' && <ShieldCheck className="w-4 h-4 text-success" />}
               </div>
               
               <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border-theme bg-white shadow-sm transition-all hover:shadow-md">
                 <div className="flex items-center justify-between mb-1">
                   <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{new Date(log.timestamp * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                   {log.type === 'HOURS_WORKED' && <span className="px-2 py-0.5 rounded bg-success/10 text-success text-[9px] font-bold uppercase">Logged</span>}
                   {log.type === 'DISPUTE_OPENED' && <span className="px-2 py-0.5 rounded bg-error/10 text-error text-[9px] font-bold uppercase">Dispute</span>}
                 </div>
                 <h4 className="text-sm font-bold text-text-main mb-1">{log.title}</h4>
                 <p className="text-xs text-text-sub font-medium leading-relaxed">{log.description}</p>
                 <div className="mt-2 text-[9px] font-bold text-text-sub/50 uppercase">Match ID: {log.matchId.slice(0, 8)}</div>
               </div>
             </motion.div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-12 text-sm font-bold text-text-sub relative z-10 bg-surface/50 rounded-xl border border-dashed border-border-theme">
               No system events recorded yet.
            </div>
          )}
       </div>
    </div>
  );
}
