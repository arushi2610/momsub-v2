import React, { useState, useEffect } from 'react';
import { User, Match, WeeklySchedule, Shift } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Calendar, Users, ArrowUpRight, LayoutDashboard, MessageSquare, CheckCircle2, Plus, Clock, FileText } from 'lucide-react';
import GlobalCalendar from './GlobalCalendar';
import ScheduleCard from './ScheduleCard';
import MatchChat from './MatchChat';
import { motion, AnimatePresence } from 'motion/react';
import { calculateShiftHours, calculateTotalHours, snapTime15, TIME_OPTIONS, formatTimeLabel, validateTimeRange, validateHours, checkShiftOverlap } from '../lib/utils';

interface ParentDashboardProps {
  parent: User;
}

export default function ParentDashboard({ parent }: ParentDashboardProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [nannies, setNannies] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'messages'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const [isEditingHours, setIsEditingHours] = useState(false);
  const [newRequestedHours, setNewRequestedHours] = useState(parent.requestedHours || 0);

  useEffect(() => {
    const handleOpenSchedule = () => setActiveTab('schedules');
    window.addEventListener('open-schedule', handleOpenSchedule);
    return () => window.removeEventListener('open-schedule', handleOpenSchedule);
  }, []);

  useEffect(() => {
    const qMatches = query(collection(db, 'matches'), where('parentId', '==', parent.id));
    
    const unsubMatches = onSnapshot(qMatches, async (snap) => {
      const matchData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(matchData);

      // Fetch nanny profiles
      const nannyIds = Array.from(new Set(matchData.map(m => m.nannyId)));
      const nannyDocs: Record<string, User> = {};
      
      for (const id of nannyIds) {
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) {
          nannyDocs[id] = { id: uDoc.id, ...uDoc.data() } as User;
        }
      }
      setNannies(nannyDocs);

      // Fetch schedules for these matches
      const matchIds = matchData.map(m => m.id);
      if (matchIds.length > 0) {
        const qSchedules = query(collection(db, 'schedules'), where('matchId', 'in', matchIds));
        const unsubSchedules = onSnapshot(qSchedules, (sSnap) => {
          setSchedules(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklySchedule)));
          setLoading(false);
        });
        return () => unsubSchedules();
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    });

    return () => unsubMatches();
  }, [parent.id]);

  if (loading) {
    return (
      <div className="space-y-8 px-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold text-text-main tracking-tight uppercase">Family Dashboard</h2>
            <p className="text-sm text-text-sub">Review and approve nanny hours.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-white p-6 rounded-xl border border-border-theme animate-pulse">
                <div className="h-10 bg-surface rounded mb-4"></div>
                <div className="h-4 bg-surface rounded mb-2"></div>
                <div className="h-4 bg-surface rounded w-3/4"></div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-6 rounded-xl border border-border-theme animate-pulse">
                <div className="h-20 bg-surface rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-text-main tracking-tight uppercase">Family Dashboard</h2>
          <p className="text-xs md:text-sm text-text-sub">Review and approve nanny hours.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 md:gap-6 border-b border-border-theme mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'schedules', label: 'Schedules', icon: FileText },
          { id: 'calendar', label: 'Calendar', icon: Calendar },
          { id: 'messages', label: 'Messages', icon: MessageSquare }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-primary' : 'text-text-sub hover:text-text-main'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="parentTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {/* Left Column: Matches & Support */}
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Your Assigned Nanny
            </h2>
            <div className="space-y-4">
              {matches.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-dashed border-border-theme text-center">
                  <p className="text-sm text-text-sub italic">No nanny assigned yet.</p>
                </div>
              ) : (
                matches.map(m => (
                  <div 
                    key={m.id}
                    className="bg-white p-5 rounded-xl border border-border-theme shadow-sm"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-success flex items-center justify-center text-white font-bold text-lg">
                        {nannies[m.nannyId]?.name?.[0] || 'N'}
                      </div>
                      <div>
                        <h3 className="font-bold text-text-main text-sm">{nannies[m.nannyId]?.name}</h3>
                        <p className="text-[10px] text-text-sub uppercase tracking-tight font-bold">Nanny</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border-theme space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-text-sub uppercase tracking-widest">Connected Since</span>
                          <span className="text-[11px] font-bold text-text-main uppercase">
                            {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : 'Active'}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border-theme/50">
                        <span className="text-[9px] font-bold text-text-sub uppercase tracking-widest block mb-1">Phone</span>
                        <a href={`tel:${nannies[m.nannyId]?.phone}`} className="text-[11px] font-bold text-primary hover:underline">
                          {nannies[m.nannyId]?.phone || 'Not provided'}
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-white rounded-xl border border-border-theme shadow-sm mt-6">
               <h3 className="text-xs font-bold text-text-main uppercase tracking-widest mb-4">Coverage Requirements</h3>
               {isEditingHours ? (
                  <div className="flex gap-2 items-center">
                     <input 
                        type="number" 
                        value={newRequestedHours} 
                        onChange={e => setNewRequestedHours(Number(e.target.value))}
                        className="w-20 px-3 py-2 border border-border-theme rounded-lg text-sm font-bold bg-surface outline-none focus:border-primary"
                        min="0"
                     />
                     <span className="text-sm font-bold text-text-sub">hrs/week</span>
                     <div className="ml-auto flex gap-2">
                        <button onClick={() => setIsEditingHours(false)} className="px-3 py-1.5 text-xs font-bold text-text-sub hover:bg-surface rounded-lg">Cancel</button>
                        <button onClick={async () => {
                           try {
                             const { doc, updateDoc } = await import('firebase/firestore');
                             await updateDoc(doc(db, 'users', parent.id), { requestedHours: newRequestedHours });
                             setIsEditingHours(false);
                           } catch (err) {}
                        }} className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90">Save</button>
                     </div>
                  </div>
               ) : (
                  <div className="flex justify-between items-center">
                     <div>
                        <p className="text-2xl font-black text-text-main leading-none mb-1">{parent.requestedHours || 0} <span className="text-sm text-text-sub">hrs</span></p>
                        <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest">Requested per week</p>
                     </div>
                     <button onClick={() => setIsEditingHours(true)} className="px-4 py-2 text-xs font-bold bg-surface border border-border-theme rounded-lg hover:border-primary text-text-main transition-colors">Adjust</button>
                  </div>
               )}
            </div>

            <div className="p-6 bg-primary rounded-2xl text-white shadow-xl shadow-primary/10 overflow-hidden relative mt-6">
               <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
               <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-2">Support</p>
               <h4 className="text-lg font-bold mb-4 leading-tight">Questions about billing or need help?</h4>
               <div className="flex flex-col sm:flex-row gap-3">
                  <a href="tel:847-213-9336" className="inline-flex items-center justify-center gap-2 text-xs font-bold bg-white text-primary px-5 py-2.5 rounded-lg hover:bg-surface transition-all active:scale-95 shadow-sm">
                     Reach out to MomSub: 847-213-9336
                  </a>
               </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4 md:space-y-6">
             <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Previous & Upcoming Schedules
                  </h2>
                  <p className="text-[10px] text-text-sub mt-0.5 ml-6">Showing last 30 days</p>
                </div>
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Request Hours
                </button>
             </div>

             <div className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="bg-white p-20 rounded-2xl border border-dashed border-border-theme flex flex-col items-center justify-center text-center">
                    <CheckCircle2 className="w-10 h-10 text-border-theme mb-4" />
                    <p className="text-xs text-text-sub max-w-[200px] mb-4">No recent schedules.</p>
                  </div>
                ) : (() => {
                  const recent = schedules
                     .filter(s => {
                        if (!s.weekStartDate) return true;
                        const d = new Date(s.weekStartDate);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - d.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= 30;
                     })
                     .sort((a,b) => String(b.weekStartDate || '').localeCompare(String(a.weekStartDate || '')));
                  return (
                    <>
                      {recent.slice(0, 3).map((s, i) => (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <ScheduleCard
                            schedule={s}
                            user={parent}
                            match={matches.find(m => m.id === s.matchId)}
                          />
                        </motion.div>
                      ))}
                      {recent.length > 3 && (
                        <button
                          onClick={() => setActiveTab('schedules')}
                          className="w-full py-2.5 text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-primary/5 rounded-lg transition-colors border border-dashed border-primary/30"
                        >
                          View all {recent.length} schedules →
                        </button>
                      )}
                    </>
                  );
                })()}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
         <div className="space-y-6">
             <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> All Schedules
                  </h2>
                  <p className="text-[10px] text-text-sub mt-0.5 ml-6">Showing last 30 days</p>
                </div>
             </div>
             <div className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="bg-white p-20 rounded-2xl border border-dashed border-border-theme text-center flex flex-col justify-center items-center">
                    <p className="text-xs text-text-sub font-bold uppercase tracking-widest italic mb-4">No schedules found.</p>
                  </div>
                ) : (
                  schedules
                     .filter(s => {
                        if (!s.weekStartDate) return true;
                        const d = new Date(s.weekStartDate);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - d.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= 30;
                     })
                     .sort((a,b) => String(b.weekStartDate || '').localeCompare(String(a.weekStartDate || ''))).map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <ScheduleCard 
                        schedule={s} 
                        user={parent} 
                        match={matches.find(m => m.id === s.matchId)} 
                      />
                    </motion.div>
                  ))
                )}
             </div>
         </div>
      )}

      {activeTab === 'calendar' && (
        <GlobalCalendar schedules={schedules} />
      )}

      {activeTab === 'messages' && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="col-span-1 border border-border-theme rounded-2xl bg-white overflow-hidden flex flex-col">
               <div className="p-4 bg-surface border-b border-border-theme">
                  <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">Select Nanny</h3>
               </div>
               <div className="flex-1 overflow-y-auto">
                 {matches.map(m => (
                   <button 
                     key={m.id}
                     onClick={() => setSelectedMatchId(m.id)}
                     className={`w-full text-left p-4 border-b border-border-theme flex items-center gap-3 transition-colors ${selectedMatchId === m.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-surface border-l-4 border-transparent'}`}
                   >
                     <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center text-success font-bold">
                        {nannies[m.nannyId]?.name?.[0]}
                     </div>
                     <div>
                       <p className="text-sm font-bold text-text-main">{nannies[m.nannyId]?.name}</p>
                       <p className="text-xs text-text-sub">Tap to chat</p>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
            <div className="col-span-1 md:col-span-2">
               {selectedMatchId ? (
                 <MatchChat matchId={selectedMatchId} user={parent} />
               ) : (
                 <div className="h-full border border-border-theme rounded-2xl bg-surface flex flex-col items-center justify-center text-text-sub">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-bold">Select a nanny</p>
                    <p className="text-sm">Start chatting about schedules or updates.</p>
                 </div>
               )}
            </div>
         </div>
      )}

      <AnimatePresence>
        {showRequestForm && (
           <WeeklyRequestForm parent={parent} matches={matches} nannies={nannies} onClose={() => setShowRequestForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function WeeklyRequestForm({ parent, matches, nannies, onClose }: { parent: User, matches: Match[], nannies: Record<string, User>, onClose: () => void }) {
  const [matchId, setMatchId] = useState(matches[0]?.id || '');
  const [weekStart, setWeekStart] = useState('');
  const [shifts, setShifts] = useState<(Partial<Shift> & { isRecurring?: boolean })[]>([
    { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
     const nextWeek = new Date();
     const nextMonday = new Date(nextWeek.setDate(nextWeek.getDate() + ((1 + 7 - nextWeek.getDay()) % 7 || 7)));
     setWeekStart(nextMonday.toISOString().split('T')[0]);
  }, []);

  const addShift = () => setShifts([...shifts, { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }]);
  const removeShift = (idx: number) => setShifts(shifts.filter((_, i) => i !== idx));
  const updateShift = (idx: number, f: string, v: any) => {
    const ns = [...shifts];
    ns[idx] = { ...ns[idx], [f]: v };
    setShifts(ns);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId || !weekStart) {
      alert('Please select a nanny and week start date');
      return;
    }

    for (const s of shifts) {
      const timeCheck = validateTimeRange(s.startTime || '', s.endTime || '');
      if (!timeCheck.valid) {
        alert(timeCheck.error);
        return;
      }
    }

    const totalHours = calculateTotalHours(shifts as any);
    const hoursCheck = validateHours(totalHours);
    if (!hoursCheck.valid) {
      alert(hoursCheck.error);
      return;
    }

    const matchToCheck = matches.find(m => m.id === matchId);
    if (matchToCheck) {
      const existingSchedules = schedules.filter(s => s.matchId === matchId && s.weekStartDate === weekStart);
      for (const existing of existingSchedules) {
        const overlapCheck = checkShiftOverlap(shifts as any, []);
        if (overlapCheck.hasOverlap) {
          alert('Warning: This schedule overlaps with an existing schedule.');
        }
      }
    }

    setLoading(true);
    try {
      const { doc, collection, writeBatch, serverTimestamp } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const scheduleRef = doc(collection(db, 'schedules'));
      const totalHours = calculateTotalHours(shifts as any);

      batch.set(scheduleRef, {
        matchId,
        weekStartDate: weekStart,
        type: 'WEEKLY_PLANNED',
        status: 'PENDING_NANNY',
        adjustmentsCount: 0,
        lastAdjustedByRole: 'PARENT',
        totalHours,
        version: 1,
        updatedAt: serverTimestamp(),
        updatedBy: parent.id
      });

      shifts.forEach(s => {
        const sRef = doc(collection(db, `schedules/${scheduleRef.id}/shifts`));
        batch.set(sRef, {
          scheduleId: scheduleRef.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          totalHours: calculateShiftHours(s.startTime!, s.endTime!)
        });
      });

      const match = matches.find(m => m.id === matchId);
      if (match) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: match.nannyId,
          scheduleId: scheduleRef.id,
          message: `${parent.name} requested hours for week of ${weekStart}.`,
          type: 'SCHEDULE_REQUEST',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to request schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-text-main/20 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: '100%', scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: '100%', scale: 1 }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-white rounded-t-2xl md:rounded-xl w-full md:w-full md:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-border-theme flex flex-col md:max-h-[90vh]"
      >
        <div className="p-6 border-b border-border-theme flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-black text-text-main tracking-tight uppercase">Request Hours</h2>
            <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest mt-1">Submit coverage needs to your Nanny</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-xl text-text-sub hover:text-text-main transition-colors">
            <span className="sr-only">Close</span>
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          <div className="space-y-4 bg-surface p-4 rounded-xl border border-border-theme">
             <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 ml-1">Nanny</label>
                  <select 
                    value={matchId} 
                    onChange={e => setMatchId(e.target.value)}
                    className="w-full border border-border-theme bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary font-bold text-text-main transition-all appearance-none"
                    required
                  >
                    <option value="" disabled>Select a Nanny</option>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>{nannies[m.nannyId]?.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 ml-1">Week of (Monday)</label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={e => setWeekStart(e.target.value)}
                    className="w-full border border-border-theme bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary font-bold text-text-main transition-all"
                    required
                  />
                </div>
             </div>
          </div>

          <div>
             <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-bold text-text-sub uppercase tracking-widest ml-1">Requested Shifts</h4>
             </div>
             <div className="space-y-3">
                {shifts.map((s, i) => (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 bg-surface p-3 rounded-xl border border-border-theme">
                     <select 
                       value={s.dayOfWeek}
                       onChange={e => updateShift(i, 'dayOfWeek', e.target.value)}
                       className="border border-border-theme bg-white rounded-lg px-2 sm:px-3 py-2 text-xs font-bold outline-none flex-1 min-w-[100px]"
                     >
                        <option value="MONDAY">Monday</option>
                        <option value="TUESDAY">Tuesday</option>
                        <option value="WEDNESDAY">Wednesday</option>
                        <option value="THURSDAY">Thursday</option>
                        <option value="FRIDAY">Friday</option>
                        <option value="SATURDAY">Saturday</option>
                        <option value="SUNDAY">Sunday</option>
                     </select>
                     
                     <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                        <select 
                          value={s.startTime}
                          onChange={e => updateShift(i, 'startTime', e.target.value)}
                          className="w-full border border-border-theme bg-white rounded-lg px-2 sm:px-3 py-2 text-xs font-bold outline-none appearance-none"
                        >
                           {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                        </select>
                        <span className="text-text-sub text-xs">to</span>
                        <select 
                          value={s.endTime}
                          onChange={e => updateShift(i, 'endTime', e.target.value)}
                          className="w-full border border-border-theme bg-white rounded-lg px-2 sm:px-3 py-2 text-xs font-bold outline-none appearance-none"
                        >
                           {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                        </select>
                     </div>

                     <button
                       type="button"
                       onClick={() => removeShift(i)}
                       className="p-2 text-error bg-error/10 hover:bg-error hover:text-white rounded-lg transition-colors shrink-0"
                       disabled={shifts.length === 1}
                     >
                       <Plus className="w-3.5 h-3.5 rotate-45" />
                     </button>
                  </div>
                ))}
             </div>
             
             <button
               type="button"
               onClick={addShift}
               className="w-full mt-3 py-3 border-2 border-dashed border-border-theme text-primary font-bold text-xs rounded-xl hover:bg-surface hover:border-primary transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
             >
               <Plus className="w-3.5 h-3.5" /> Add Another Shift
             </button>
          </div>
          
          <div className="pt-6 border-t border-border-theme">
             <button
               type="submit"
               disabled={loading || !matchId || shifts.length === 0}
               className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
             >
               {loading ? 'Submitting...' : 'Submit Request to Nanny'}
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
