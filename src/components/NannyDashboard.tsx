import React, { useState, useEffect } from 'react';
import { User, Match, WeeklySchedule, Shift } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, addDoc, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { Calendar, Users, Plus, Send, CheckCircle2, History, LayoutDashboard, MessageSquare, FileText } from 'lucide-react';
import GlobalCalendar from './GlobalCalendar';
import ScheduleCard from './ScheduleCard';
import MatchChat from './MatchChat';
import { motion, AnimatePresence } from 'motion/react';
import { calculateShiftHours, calculateTotalHours, snapTime15, TIME_OPTIONS, formatTimeLabel, formatHours, validateTimeRange, validateHours } from '../lib/utils';

interface NannyDashboardProps {
  nanny: User;
}

export default function NannyDashboard({ nanny }: NannyDashboardProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [parents, setParents] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'messages'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenSchedule = () => setActiveTab('schedules');
    window.addEventListener('open-schedule', handleOpenSchedule);
    return () => window.removeEventListener('open-schedule', handleOpenSchedule);
  }, []);

  useEffect(() => {
    const qMatches = query(collection(db, 'matches'), where('nannyId', '==', nanny.id));
    
    const unsubMatches = onSnapshot(qMatches, async (snap) => {
      const matchData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(matchData);

      // Fetch parent profiles
      const parentIds = Array.from(new Set(matchData.map(m => m.parentId)));
      const parentDocs: Record<string, User> = {};
      
      for (const id of parentIds) {
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) {
          parentDocs[id] = { id: uDoc.id, ...uDoc.data() } as User;
        }
      }
      setParents(parentDocs);

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
  }, [nanny.id]);

  if (loading) {
    return (
      <div className="space-y-8 px-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold text-text-main tracking-tight uppercase">Dashboard</h2>
            <p className="text-sm text-text-sub">Track your shifts and submit hours.</p>
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
          <h2 className="text-xl md:text-2xl font-extrabold text-text-main tracking-tight uppercase">Dashboard</h2>
          <p className="text-xs md:text-sm text-text-sub">Track your shifts and submit hours.</p>
        </div>
        <button 
          onClick={() => setShowSubmitForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Submit Hours
        </button>
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
              <motion.div layoutId="nannyTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {/* Left Column: Profile & Stats */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-border-theme shadow-sm">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl shadow-sm border border-white">
                    {nanny.name?.[0]}
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-text-main tracking-tight">{nanny.name}</h3>
                     <span className="text-[10px] font-bold text-text-sub uppercase tracking-widest">Nanny</span>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-surface rounded-xl border border-border-theme">
                     <p className="text-[9px] font-bold text-text-sub uppercase tracking-widest mb-1">Completed Hours</p>
                     <p className="text-xl font-bold text-text-main font-mono italic">
                        {schedules.filter(s => s.status === 'APPROVED').reduce((sum, s) => sum + (s.totalHours || 0), 0)}
                     </p>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-border-theme">
                     <p className="text-[9px] font-bold text-text-sub uppercase tracking-widest mb-1">Status</p>
                     <p className="text-base font-bold text-success uppercase tracking-tighter">Active</p>
                  </div>
               </div>
            </div>

            <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Families
            </h2>
            <div className="space-y-3">
              {matches.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-xl border border-border-theme shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-primary-soft flex items-center justify-center text-primary font-bold text-sm">
                        {parents[m.parentId]?.name?.[0] || 'P'}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-text-main tracking-tight uppercase">The {parents[m.parentId]?.name?.split(' ').pop()} Family</h4>
                        <p className="text-[9px] text-text-sub font-bold uppercase">Active</p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                    </div>
                    {parents[m.parentId]?.phone && (
                      <p className="text-[10px] text-text-sub mb-1">📞 {parents[m.parentId]?.phone}</p>
                    )}
                    {parents[m.parentId]?.email && (
                      <p className="text-[10px] text-text-sub truncate">✉️ {parents[m.parentId]?.email}</p>
                    )}
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4 md:space-y-6">
            <div className="bg-white p-8 rounded-2xl border border-border-theme text-center">
              <Plus className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold text-text-main mb-2">Ready to work?</h3>
              <p className="text-sm text-text-sub mb-6">Manage your availability or submit weekly completed hours.</p>
              <button 
                onClick={() => setShowSubmitForm(true)}
                className="bg-primary text-white py-2 px-6 rounded-lg font-bold hover:bg-primary/90 transition-colors"
              >
                Submit New Log
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                    <History className="w-4 h-4" /> Recent Activity
                  </h2>
                  <p className="text-[10px] text-text-sub mt-0.5 ml-6">Showing last 30 days</p>
                </div>
             </div>
             
             <div className="space-y-4">
                {schedules.length > 0 && schedules
                  .filter(s => {
                    if (!s.weekStartDate) return true;
                    const d = new Date(s.weekStartDate);
                    const now = new Date();
                    const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays <= 30;
                  })
                  .sort((a,b) => String(b.weekStartDate || '').localeCompare(String(a.weekStartDate || '')))
                  .slice(0, 3).map((s, i) => (
                  <ScheduleCard 
                    key={s.id}
                    schedule={s} 
                    user={nanny} 
                    match={matches.find(m => m.id === s.matchId)} 
                  />
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
         <div className="space-y-6">
             <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> All Schedules
                  </h2>
                  <p className="text-[10px] text-text-sub mt-0.5 ml-6">Showing last 30 days</p>
                </div>
             </div>
             <div className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="bg-white p-20 rounded-2xl border border-dashed border-border-theme text-center">
                    <p className="text-xs text-text-sub font-bold uppercase tracking-widest italic">No schedules found.</p>
                  </div>
                ) : (
                  schedules
                    .filter(s => {
                       if (!s.weekStartDate) return true;
                       const d = new Date(s.weekStartDate);
                       const now = new Date();
                       const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
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
                        user={nanny} 
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
                  <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">Select Family</h3>
               </div>
               <div className="flex-1 overflow-y-auto">
                 {matches.map(m => (
                   <button 
                     key={m.id}
                     onClick={() => setSelectedMatchId(m.id)}
                     className={`w-full text-left p-4 border-b border-border-theme flex items-center gap-3 transition-colors ${selectedMatchId === m.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-surface border-l-4 border-transparent'}`}
                   >
                     <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary font-bold">
                        {parents[m.parentId]?.name?.[0]}
                     </div>
                     <div>
                       <p className="text-sm font-bold text-text-main">The {parents[m.parentId]?.name?.split(' ').pop()}s</p>
                       <p className="text-xs text-text-sub">Tap to chat</p>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
            <div className="col-span-1 md:col-span-2">
               {selectedMatchId ? (
                 <MatchChat matchId={selectedMatchId} user={nanny} />
               ) : (
                 <div className="h-full border border-border-theme rounded-2xl bg-surface flex flex-col items-center justify-center text-text-sub">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-bold">Select a family</p>
                    <p className="text-sm">Start chatting about schedules or updates.</p>
                 </div>
               )}
            </div>
         </div>
      )}

      <AnimatePresence>
        {showSubmitForm && (
          <WeeklySubmitForm nanny={nanny} matches={matches} parents={parents} onClose={() => setShowSubmitForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function WeeklySubmitForm({ nanny, matches, parents, onClose }: { nanny: User, matches: Match[], parents: Record<string, User>, onClose: () => void }) {
  const [matchId, setMatchId] = useState(matches[0]?.id || '');
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    return monday.toISOString().split('T')[0];
  });
  const [type, setType] = useState<'WEEKLY_ACTUAL' | 'WEEKLY_PLANNED'>('WEEKLY_ACTUAL');
  const [shifts, setShifts] = useState<(Partial<Shift> & { isRecurring?: boolean })[]>([
    { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', isRecurring: false }
  ]);
  const [loading, setLoading] = useState(false);

  const LOCAL_STORAGE_KEY = `momsub_weekly_form_${nanny.id}`;

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.matchId) setMatchId(parsed.matchId);
        if (parsed.weekStart) setWeekStart(parsed.weekStart);
        if (parsed.type) setType(parsed.type);
        if (parsed.shifts && Array.isArray(parsed.shifts)) setShifts(parsed.shifts);
      } catch (e) {
        console.error('Failed to parse saved form state', e);
      }
    }
  }, [nanny.id, LOCAL_STORAGE_KEY]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ matchId, weekStart, type, shifts }));
  }, [matchId, weekStart, type, shifts, LOCAL_STORAGE_KEY]);

  const addShift = () => setShifts([...shifts, { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', isRecurring: false }]);
  const removeShift = (idx: number) => setShifts(shifts.filter((_, i) => i !== idx));
  const updateShift = (idx: number, f: string, v: any) => {
    const ns = [...shifts];
    ns[idx] = { ...ns[idx], [f]: v };
    setShifts(ns);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId) {
      alert("No family selected. You must be matched with a family first.");
      return;
    }
    if (!weekStart) {
      alert('Please select a week start date');
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

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const scheduleRef = doc(collection(db, 'schedules'));
      const totalHours = calculateTotalHours(shifts as any);

      batch.set(scheduleRef, {
        matchId,
        weekStartDate: weekStart,
        type,
        status: 'PENDING_PARENT',
        adjustmentsCount: 0,
        lastAdjustedByRole: 'NANNY',
        totalHours,
        version: 1,
        updatedAt: serverTimestamp(),
        updatedBy: nanny.id
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

      // Handle Recurring Shifts
      const recurringShifts = shifts.filter(s => s.isRecurring);
      if (recurringShifts.length > 0) {
        const nextWeekScheduleRef = doc(collection(db, 'schedules'));
        
        // Calculate next week start date
        const currentWeekDate = new Date(weekStart);
        currentWeekDate.setDate(currentWeekDate.getDate() + 7);
        const nextWeekStartStr = currentWeekDate.toISOString().split('T')[0];

        const nextTotalHours = calculateTotalHours(recurringShifts as any);

        batch.set(nextWeekScheduleRef, {
          matchId,
          weekStartDate: nextWeekStartStr,
          type: 'WEEKLY_PLANNED', // Next week is naturally planned
          status: 'PENDING_PARENT',
          adjustmentsCount: 0,
          lastAdjustedByRole: 'NANNY',
          totalHours: nextTotalHours,
          version: 1,
          updatedAt: serverTimestamp(),
          updatedBy: nanny.id
        });

        recurringShifts.forEach(s => {
          const sRef = doc(collection(db, `schedules/${nextWeekScheduleRef.id}/shifts`));
          batch.set(sRef, {
            scheduleId: nextWeekScheduleRef.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            totalHours: calculateShiftHours(s.startTime!, s.endTime!)
          });
        });
      }

      // Notify parent
      const match = matches.find(m => m.id === matchId);
      if (match) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: match.parentId,
          scheduleId: scheduleRef.id,
          message: `${nanny.name} submitted ${type === 'WEEKLY_ACTUAL' ? 'actual' : 'planned'} hours for week of ${weekStart}.`,
          type: 'SCHEDULE_SUBMITTED',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'schedules');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-text-main/20 backdrop-blur-sm z-[100] flex items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0, y: '100%', scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: '100%', scale: 1 }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-white rounded-t-2xl md:rounded-3xl shadow-2xl w-full md:w-full md:max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-8 py-6 bg-primary text-white flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Submit Weekly Log</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><Plus className="w-6 h-6 rotate-45" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="text-[10px] font-black text-text-sub uppercase tracking-widest mb-1.5 block">Record Type</label>
              <div className="flex flex-col gap-2">
                 {['WEEKLY_ACTUAL', 'WEEKLY_PLANNED'].map(t => (
                   <button key={t} type="button" onClick={() => setType(t as any)} className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-tighter transition-all border-2 ${type === t ? 'bg-primary border-primary text-white shadow-lg' : 'bg-surface border-transparent text-text-sub'}`}>
                     {t.replace('WEEKLY_', '')}
                   </button>
                 ))}
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-black text-text-sub uppercase tracking-widest mb-1.5 block">Week Start</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="w-full bg-surface border border-border-theme rounded-xl py-3 px-4 text-xs font-bold outline-none focus:border-primary" />
            </div>
            <div className="md:col-span-1">
              <label className="text-[10px] font-black text-text-sub uppercase tracking-widest mb-1.5 block">Select Family</label>
              <select value={matchId} onChange={e => setMatchId(e.target.value)} className="w-full bg-surface border border-border-theme rounded-xl py-3 px-4 text-xs font-bold outline-none focus:border-primary appearance-none">
                {matches.map(m => (
                  <option key={m.id} value={m.id}>Family {parents[m.parentId]?.name?.split(' ').pop()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-text-sub uppercase tracking-[0.2em]">Log Daily Shifts</h4>
                <button type="button" onClick={addShift} className="text-xs font-black text-primary hover:underline">+ Add Entry</button>
             </div>
             {shifts.map((s, i) => (
                <div key={i} className="flex flex-col gap-3 p-4 bg-surface rounded-2xl border border-border-theme">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <select value={s.dayOfWeek} onChange={e => updateShift(i, 'dayOfWeek', e.target.value)} className="w-full sm:flex-1 bg-white border border-border-theme rounded-lg py-2 px-2 text-[10px] font-bold uppercase outline-none focus:border-primary">
                        {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select value={s.startTime} onChange={e => updateShift(i, 'startTime', e.target.value)} className="flex-1 sm:flex-none bg-white border border-border-theme rounded-lg py-2 px-2 text-xs font-bold outline-none focus:border-primary appearance-none min-w-[80px]">
                           {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                        </select>
                        <span className="text-text-sub text-xs font-bold uppercase">to</span>
                        <select value={s.endTime} onChange={e => updateShift(i, 'endTime', e.target.value)} className="flex-1 sm:flex-none bg-white border border-border-theme rounded-lg py-2 px-2 text-xs font-bold outline-none focus:border-primary appearance-none min-w-[80px]">
                           {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                        </select>
                        <button type="button" onClick={() => removeShift(i)} className="p-2 text-text-sub hover:text-error hover:bg-error/10 rounded-lg transition-all shrink-0"><Plus className="w-4 h-4 rotate-45" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <input
                         type="checkbox"
                         id={`recurring-${i}`}
                         checked={!!s.isRecurring}
                         onChange={e => updateShift(i, 'isRecurring', e.target.checked)}
                         className="w-4 h-4 rounded border-border-theme accent-primary"
                       />
                       <label htmlFor={`recurring-${i}`} className="text-xs font-bold text-text-sub select-none">Mark as Recurring Weekly (populates next week's schedule)</label>
                    </div>
                </div>
             ))}
          </div>

          <div className="flex items-center justify-between p-6 bg-primary/5 rounded-2xl border border-primary/20">
             <span className="text-xs font-black text-text-sub uppercase tracking-widest">Total Hours Submitted:</span>
             <span className="text-3xl font-black text-primary font-mono italic tracking-tighter">{formatHours(calculateTotalHours(shifts))} <span className="text-sm not-italic uppercase tracking-normal">Hrs</span></span>
          </div>

          <button disabled={loading} className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/10 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
             {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit To Parent</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
