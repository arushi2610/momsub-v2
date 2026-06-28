import React, { useState, useEffect } from 'react';
import { User, Match, WeeklySchedule } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs, serverTimestamp, doc, updateDoc, setDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { Plus, Users, LayoutDashboard, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, Power, Unlink, Clock, UserPlus, X, MessageSquare, Archive } from 'lucide-react';
import GlobalCalendar from './GlobalCalendar';
import UserForm from './UserForm';
import MatchForm from './MatchForm';
import SystemAuditLog from './SystemAuditLog';
import ScheduleCard from './ScheduleCard';
import MatchChat from './MatchChat';
import { motion, AnimatePresence } from 'motion/react';
import { formatHours, isScheduleArchivable } from '../lib/utils';

interface AdminDashboardProps {
  admin: User;
}

export default function AdminDashboard({ admin }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'matches' | 'calendar' | 'messages' | 'history'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<WeeklySchedule | null>(null);
  const [showHistoryForMatch, setShowHistoryForMatch] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [streamSearchTerm, setStreamSearchTerm] = useState('');
  const [openMatchMenu, setOpenMatchMenu] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'unmatch' | 'toggle'; matchId: string } | null>(null);

  const handleToggleMatchStatus = async (match: Match) => {
    try {
      const newStatus = match.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateDoc(doc(db, 'matches', match.id), { status: newStatus });
      setOpenMatchMenu(null);
      setConfirmAction(null);
    } catch (error) {
      console.error("Error updating status: ", error);
    }
  };

  const handleUnmatch = async (matchId: string) => {
    try {
      await deleteDoc(doc(db, 'matches', matchId));
      setOpenMatchMenu(null);
      setConfirmAction(null);
    } catch (error) {
       console.error("Error unmatching: ", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const filteredSchedules = schedules.filter(s => {
    if (!streamSearchTerm) return true;
    const match = matches.find(m => m.id === s.matchId);
    const parent = users.find(u => u.id === match?.parentId);
    const nanny = users.find(u => u.id === match?.nannyId);
    
    const searchLower = streamSearchTerm.toLowerCase();
    if (parent?.name?.toLowerCase().includes(searchLower)) return true;
    if (nanny?.name?.toLowerCase().includes(searchLower)) return true;
    if (s.weekStartDate && String(s.weekStartDate).toLowerCase().includes(searchLower)) return true;
    if (s.type === 'STANDARD' && 'standard base'.includes(searchLower)) return true;
    return false;
  }).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const qMatches = query(collection(db, 'matches'));
    const qSchedules = query(collection(db, 'schedules'));

    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

    const unsubMatches = onSnapshot(qMatches, (snap) => {
      const matchData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(matchData);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'matches'));

    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklySchedule)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'schedules'));
    return () => {
      unsubUsers();
      unsubMatches();
      unsubSchedules();
    };
  }, []);

  const archivableSchedules = schedules.filter(s => isScheduleArchivable(s, 3)).length;

  const stats = {
    totalMatches: matches.filter(m => m.status === 'ACTIVE').length,
    pendingApprovals: schedules.filter(s => s.status === 'PENDING_NANNY' || s.status === 'PENDING_PARENT').length,
    disputes: schedules.filter(s => s.status === 'DISPUTE').length,
    totalUsers: users.length
  };

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-text-main tracking-tight uppercase">Admin Console</h1>
          <p className="text-xs md:text-sm text-text-sub">Manage platform operations.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowUserForm(true)}
            className="flex items-center gap-2 bg-white border border-border-theme text-text-main px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-surface transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-primary" />
            New User
          </button>
          <button 
            onClick={() => setShowMatchForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Match
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-5">
        {[
          { label: 'Active Matches', value: stats.totalMatches, color: 'text-text-main' },
          { label: 'Pending Approvals', value: stats.pendingApprovals, color: 'text-warning' },
          { label: 'Active Disputes', value: stats.disputes, color: 'text-error' },
          { label: 'Total Users', value: stats.totalUsers, color: 'text-text-main' },
          { label: 'Archivable (3mo+)', value: archivableSchedules, color: 'text-text-sub', hint: 'Schedules older than 3 months' }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-border-theme rounded-xl p-3 md:p-5 shadow-sm"
            title={stat.hint}
          >
            <div className="text-[9px] md:text-[11px] font-bold text-text-sub uppercase tracking-wider mb-1 md:mb-2 flex items-center gap-1 line-clamp-2">
              {stat.label}
              {stat.hint && <span className="text-[8px] opacity-60">ℹ️</span>}
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${stat.color} tracking-tighter`}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border-theme px-0 gap-2 md:gap-8 no-scrollbar">
        {[
          { id: 'overview', label: 'Activity' },
          { id: 'users', label: 'Users' },
          { id: 'matches', label: 'Matches' },
          { id: 'calendar', label: 'Calendar' },
          { id: 'messages', label: 'Chat' },
          { id: 'history', label: 'Audit' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 md:pb-4 px-2 md:px-4 text-xs md:text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-text-sub hover:text-text-main'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {['overview', 'users', 'matches', 'messages'].includes(activeTab) && (
        <div className="bg-white border border-border-theme rounded-xl md:rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
          {activeTab === 'overview' && (
            <div className="flex flex-col h-full">
            <div className="px-6 py-3 bg-surface border-b border-border-theme flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-sub uppercase tracking-widest tracking-[0.2em]">Stream</span>
              <div className="flex items-center gap-4">
                 <input 
                   type="text" 
                   placeholder="Search names or dates..." 
                   value={streamSearchTerm}
                   onChange={e => setStreamSearchTerm(e.target.value)}
                   className="bg-white border border-border-theme rounded text-xs px-3 py-1.5 outline-none placeholder-text-sub/50 focus:border-primary transition-colors min-w-[200px]"
                 />
                 <span className="text-[10px] text-primary bg-primary-soft px-2 py-0.5 rounded font-bold uppercase">Live Updates</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="bg-surface/50 border-b border-border-theme">
                    <th className="px-6 py-3 text-[10px] font-bold text-text-sub uppercase tracking-widest">Match</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-text-sub uppercase tracking-widest text-center">Period</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-text-sub uppercase tracking-widest text-center">Status</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-text-sub uppercase tracking-widest text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme">
                  {filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-text-sub italic text-sm">No activity records found matching your search.</td>
                    </tr>
                  ) : (
                    filteredSchedules.map(s => {
                      const match = matches.find(m => m.id === s.matchId);
                      const parent = users.find(u => u.id === match?.parentId);
                      const nanny = users.find(u => u.id === match?.nannyId);
                      return (
                        <tr key={s.id} onClick={() => setSelectedSchedule(s)} className="hover:bg-surface/50 transition-colors group cursor-pointer">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-surface border border-border-theme text-text-sub group-hover:text-primary transition-colors">
                                 <Plus className="w-3 h-3 group-hover:scale-110 transition-transform" />
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-text-main tracking-tight group-hover:text-primary transition-colors">{parent?.name?.split(' ')[0]} / {nanny?.name?.split(' ')[0]}</p>
                                 <p className="text-[10px] text-text-sub uppercase font-medium">#{s.matchId.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-text-sub text-center font-mono italic">
                            {(() => {
                              try {
                                if (!s.weekStartDate || String(s.weekStartDate).toLowerCase() === 'undefined') return s.type === 'STANDARD' ? 'Standard Base' : 'N/A';
                                const [y, m, d] = s.weekStartDate.split('-');
                                const startDate = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
                                if (isNaN(startDate.getTime())) return String(s.weekStartDate);
                                return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                              } catch(e) {
                                return String(s.weekStartDate) || 'N/A';
                              }
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                s.status === 'APPROVED' ? 'bg-success' : s.status === 'DISPUTE' ? 'bg-error' : 'bg-warning'
                              }`}></span>
                              <span className={`text-[10px] font-bold uppercase tracking-tight ${
                                s.status === 'APPROVED' ? 'text-success' : s.status === 'DISPUTE' ? 'text-error' : 'text-warning'
                              }`}>{s.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-text-main font-mono italic tracking-tight">{formatHours(s.totalHours)} <span className="text-[9px] font-bold uppercase not-italic text-text-sub mr-1">hrs</span></span>
                             </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && !selectedUser && (
          <div className="p-8">
            <div className="mb-6 flex justify-between items-center bg-surface p-2 rounded-xl">
               <input 
                 type="text" 
                 placeholder="Search users by name, email or role..." 
                 value={userSearchTerm}
                 onChange={e => setUserSearchTerm(e.target.value)}
                 className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm font-medium text-text-main placeholder-text-sub"
               />
               <div className="px-4 py-2 bg-white rounded-lg border border-border-theme text-xs font-bold text-text-sub uppercase tracking-wider shadow-sm">
                  {filteredUsers.length} Users
               </div>
            </div>
            {filteredUsers.length === 0 ? (
               <div className="text-center py-12 text-sm font-bold text-text-sub">No users found matching "{userSearchTerm}".</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredUsers.map(u => (
                  <div key={u.id} className="p-5 rounded-xl border border-border-theme hover:border-primary/30 hover:shadow-md transition-all flex flex-col justify-between space-y-4 cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${u.role === 'ADMIN' ? 'bg-error text-white shadow-sm' : u.role === 'PARENT' ? 'bg-primary text-white shadow-sm' : 'bg-success text-white shadow-sm'}`}>
                        {u.role === 'ADMIN' ? <AlertCircle className="w-5 h-5" /> : u.role === 'PARENT' ? <Users className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <span className="text-[10px] font-bold text-text-sub uppercase tracking-widest">{u.role}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-text-main tracking-tight">{u.name}</h3>
                      <p className="text-xs text-text-sub truncate">{u.email}</p>
                    </div>
                    <div className="pt-4 border-t border-border-theme flex items-center justify-between">
                      <span className="text-[10px] font-bold text-text-sub uppercase">ID: {u.id.slice(0, 8)}</span>
                      <button className="text-[10px] font-bold text-primary uppercase hover:underline">View Profile</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && selectedUser && (
           <div className="p-8">
              <button 
                onClick={() => setSelectedUser(null)}
                className="flex items-center gap-2 text-xs font-bold text-text-sub hover:text-text-main mb-6 transition-colors uppercase tracking-widest"
              >
                <ChevronRight className="w-4 h-4 rotate-180" /> Back to Users
              </button>
              
              <div className="bg-white border text-left border-border-theme rounded-2xl p-6 mb-8 shadow-sm flex items-start gap-6">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-sm ${selectedUser.role === 'ADMIN' ? 'bg-error' : selectedUser.role === 'PARENT' ? 'bg-primary' : 'bg-success'}`}>
                    {selectedUser.name?.[0]}
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-text-main tracking-tight mb-1">{selectedUser.name}</h2>
                    <p className="text-sm text-text-sub font-medium">{selectedUser.email}</p>
                    <div className="mt-4 flex gap-3">
                       <span className="px-2 py-1 rounded text-[10px] font-bold bg-surface border border-border-theme text-text-sub uppercase tracking-widest">{selectedUser.role}</span>
                       <span className="px-2 py-1 rounded text-[10px] font-bold bg-surface border border-border-theme text-text-sub uppercase tracking-widest">ID: {selectedUser.id}</span>
                    </div>
                 </div>
              </div>

              {selectedUser.role !== 'ADMIN' && (
                 <div>
                    <h3 className="text-lg font-black text-text-main mb-4 tracking-tight uppercase">Schedule History</h3>
                    <div className="space-y-4">
                      {schedules.filter(s => {
                         const userMatches = matches.filter(m => m.parentId === selectedUser.id || m.nannyId === selectedUser.id).map(m => m.id);
                         return userMatches.includes(s.matchId);
                      }).length === 0 ? (
                        <p className="text-sm font-bold text-text-sub italic">No schedules found for this user.</p>
                      ) : (
                        schedules.filter(s => {
                           const userMatches = matches.filter(m => m.parentId === selectedUser.id || m.nannyId === selectedUser.id).map(m => m.id);
                           return userMatches.includes(s.matchId);
                        }).sort((a,b) => String(b.weekStartDate || '').localeCompare(String(a.weekStartDate || ''))).map(s => {
                           const sMatch = matches.find(m => m.id === s.matchId) || matches[0];
                           return <ScheduleCard key={s.id} schedule={s} user={admin} match={sMatch} />
                        })
                      )}
                    </div>
                 </div>
              )}
           </div>
        )}

        {activeTab === 'matches' && (
          <div className="p-8">
            <div className="space-y-4">
              {matches.map(m => {
                const parent = users.find(u => u.id === m.parentId);
                const nanny = users.find(u => u.id === m.nannyId);
                return (
                  <div key={m.id} className="p-5 rounded-xl border border-border-theme flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-surface transition-colors group">
                    <div className="flex items-center gap-6">
                      <div className="flex -space-x-2">
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm border border-white">{parent?.name?.[0]}</div>
                        <div className="w-10 h-10 rounded-lg bg-success flex items-center justify-center text-white font-bold text-sm shadow-sm border border-white">{nanny?.name?.[0]}</div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text-main tracking-tight uppercase">{parent?.name} + {nanny?.name}</h3>
                        <p className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Added {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : 'Active'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-text-sub uppercase tracking-wider mb-1">Status</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.status === 'ACTIVE' ? 'border-success/30 bg-success/5 text-success' : 'border-border-theme bg-surface text-text-sub'} uppercase tracking-tight`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="relative">
                        <button 
                          onClick={() => setOpenMatchMenu(openMatchMenu === m.id ? null : m.id)}
                          className="p-2 -mr-2 rounded-lg text-text-sub hover:bg-black/5 hover:text-text-main transition-colors"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${openMatchMenu === m.id ? 'rotate-180' : ''}`} />
                        </button>

                        {openMatchMenu === m.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMatchMenu(null)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border-theme rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                               <button
                                 onClick={() => setConfirmAction({ type: 'toggle', matchId: m.id })}
                                 className="w-full px-4 py-2.5 text-left text-xs font-bold text-text-main hover:bg-surface flex items-center gap-2 transition-colors"
                               >
                                 <Power className={`w-4 h-4 ${m.status === 'ACTIVE' ? 'text-warning' : 'text-success'}`} />
                                 {m.status === 'ACTIVE' ? 'Mark Inactive' : 'Mark Active'}
                               </button>
                               <button
                                 onClick={() => setConfirmAction({ type: 'unmatch', matchId: m.id })}
                                 className="w-full px-4 py-2.5 text-left text-xs font-bold text-error hover:bg-error/5 flex items-center gap-2 transition-colors border-t border-border-theme"
                               >
                                 <Unlink className="w-4 h-4" />
                                 Unmatch Pair
                               </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'messages' && (
          <div className="p-8 h-[600px] flex flex-col">
             <div className="mb-6 flex justify-between items-center bg-surface p-2 rounded-xl">
               <div className="px-4 py-2 bg-white rounded-lg border border-border-theme text-xs font-bold text-text-sub uppercase tracking-wider shadow-sm">
                  {matches.length} Assignments Active
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
              <div className="col-span-1 border border-border-theme rounded-2xl bg-white overflow-hidden flex flex-col">
                 <div className="p-4 bg-surface border-b border-border-theme">
                    <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">Select Thread</h3>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                   {matches.map(m => {
                     const pUser = users.find(u => u.id === m.parentId);
                     const nUser = users.find(u => u.id === m.nannyId);
                     return (
                       <button 
                         key={m.id}
                         onClick={() => setSelectedMatchId(m.id)}
                         className={`w-full text-left p-4 border-b border-border-theme flex items-center gap-3 transition-colors ${selectedMatchId === m.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-surface border-l-4 border-transparent'}`}
                       >
                         <div className="w-10 h-10 shrink-0 rounded-lg bg-surface flex items-center justify-center text-text-main font-bold border border-border-theme">
                            {pUser?.name?.[0]}{nUser?.name?.[0]}
                         </div>
                         <div className="min-w-0">
                           <p className="text-xs font-bold text-text-main truncate">P: {pUser?.name}</p>
                           <p className="text-xs text-text-sub truncate">N: {nUser?.name}</p>
                         </div>
                       </button>
                     );
                   })}
                 </div>
              </div>
              <div className="col-span-1 md:col-span-2">
                 {selectedMatchId ? (
                   <MatchChat matchId={selectedMatchId} user={admin} />
                 ) : (
                   <div className="h-full border border-border-theme rounded-2xl bg-surface flex flex-col items-center justify-center text-text-sub">
                      <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                      <p className="font-bold">Select a communication thread</p>
                      <p className="text-sm">Monitor messages between parents and nannies.</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Overlays */}
        {activeTab === 'calendar' && (
          <div className="my-6">
            <GlobalCalendar schedules={schedules} />
          </div>
        )}

        {activeTab === 'history' && (
           <SystemAuditLog schedules={schedules} matches={matches} users={users} />
        )}

      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 bg-text-main/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-theme relative"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-2">
                  {confirmAction.type === 'unmatch' ? 'Unmatch Pair' : 'Change Match Status'}
                </h3>
                <p className="text-sm font-medium text-text-sub mb-6">
                  {confirmAction.type === 'unmatch'
                    ? 'This will permanently disconnect this parent and nanny. This action cannot be undone.'
                    : 'Are you sure you want to change this match status?'}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border-theme font-bold text-sm text-text-main hover:bg-surface transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const match = matches.find(m => m.id === confirmAction.matchId);
                      if (confirmAction.type === 'unmatch') {
                        handleUnmatch(confirmAction.matchId);
                      } else if (match) {
                        handleToggleMatchStatus(match);
                      }
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 ${
                      confirmAction.type === 'unmatch' ? 'bg-error hover:bg-error/90' : 'bg-warning hover:bg-warning/90'
                    }`}
                  >
                    {confirmAction.type === 'unmatch' ? 'Unmatch' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showUserForm && (
          <UserForm onClose={() => setShowUserForm(false)} />
        )}
        {showMatchForm && (
          <MatchForm users={users} onClose={() => setShowMatchForm(false)} />
        )}
        {selectedSchedule && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative"
            >
              <button 
                onClick={() => { setSelectedSchedule(null); setShowHistoryForMatch(null); }}
                className="absolute top-4 right-4 p-2 bg-white rounded-full text-text-sub hover:text-primary hover:bg-surface border border-border-theme transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 mt-2">
                  <h2 className="text-sm font-bold text-text-sub uppercase tracking-widest pl-2 border-l-2 border-primary">Match Record</h2>
                  {!showHistoryForMatch ? (
                    <button onClick={() => setShowHistoryForMatch(selectedSchedule.matchId)} className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                       View History
                    </button>
                  ) : (
                    <button onClick={() => setShowHistoryForMatch(null)} className="text-xs font-bold text-text-sub bg-surface border border-border-theme px-3 py-1.5 rounded-lg hover:text-text-main transition-colors">
                       Back to Current
                    </button>
                  )}
                </div>
                
                {!showHistoryForMatch ? (
                  <ScheduleCard 
                    schedule={selectedSchedule} 
                    user={admin} 
                    match={matches.find(m => m.id === selectedSchedule.matchId)!} 
                    onRefresh={() => { setSelectedSchedule(null); setShowHistoryForMatch(null); }}
                    onNavigateWeek={(dir, targetWeek) => {
                       const matchSchedules = schedules.filter(s => s.matchId === selectedSchedule.matchId);
                       const targetSchedule = matchSchedules.find(s => s.weekStartDate === targetWeek && s.type !== 'STANDARD');
                       if (targetSchedule) {
                          setSelectedSchedule(targetSchedule);
                       } else {
                          const standardSchedule = matchSchedules.find(s => s.type === 'STANDARD');
                          if (standardSchedule) {
                             setSelectedSchedule(null);
                             setTimeout(() => {
                                setSelectedSchedule(standardSchedule);
                             }, 0);
                          }
                       }
                    }}
                  />
                ) : (
                  <div className="space-y-4">
                     {schedules.filter(s => s.matchId === selectedSchedule.matchId && s.id !== selectedSchedule.id).sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map(s => (
                        <ScheduleCard 
                          key={s.id}
                          schedule={s} 
                          user={admin} 
                          match={matches.find(m => m.id === selectedSchedule.matchId)!} 
                        />
                     ))}
                     {schedules.filter(s => s.matchId === selectedSchedule.matchId && s.id !== selectedSchedule.id).length === 0 && (
                        <div className="p-8 text-center text-text-sub italic text-sm">No other history found.</div>
                     )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
