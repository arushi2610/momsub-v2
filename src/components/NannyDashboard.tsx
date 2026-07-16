import React, { useState, useEffect } from 'react';
import { User, Match } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { Calendar, Users, LayoutDashboard, MessageSquare, FileText } from 'lucide-react';
import MatchChat from './MatchChat';
import WeekNavigator from './WeekNavigator';
import { motion } from 'motion/react';

interface NannyDashboardProps {
  nanny: User;
}

export default function NannyDashboard({ nanny }: NannyDashboardProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [parents, setParents] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'messages'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenSchedule = () => setActiveTab('schedules');
    window.addEventListener('open-schedule', handleOpenSchedule);
    return () => window.removeEventListener('open-schedule', handleOpenSchedule);
  }, []);

  useEffect(() => {
    const qMatches = query(collection(db, 'matches'), where('nannyId', '==', nanny.id));

    const unsubMatches = onSnapshot(qMatches, async snap => {
      const matchData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(matchData);
      setSelectedMatchId(prev => prev ?? matchData[0]?.id ?? null);

      const parentIds = Array.from(new Set(matchData.map(m => m.parentId)));
      const parentDocs: Record<string, User> = {};
      for (const id of parentIds) {
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) parentDocs[id] = { id: uDoc.id, ...uDoc.data() } as User;
      }
      setParents(parentDocs);
      setLoading(false);
    }, error => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
      setLoading(false);
    });

    return () => unsubMatches();
  }, [nanny.id]);

  const activeMatch = matches.find(m => m.id === selectedMatchId) || matches[0];
  const familyName = (m?: Match) => {
    const p = m ? parents[m.parentId] : undefined;
    return p?.name ? `The ${p.name.split(' ').pop()} Family` : 'Family';
  };

  if (loading) {
    return (
      <div className="space-y-8 px-2">
        <div>
          <h2 className="text-2xl font-extrabold text-text-main tracking-tight uppercase">Dashboard</h2>
          <p className="text-sm text-text-sub">Track your shifts and adjust hours.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl border border-border-theme animate-pulse">
              <div className="h-20 bg-surface rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const MatchPicker = () =>
    matches.length > 1 ? (
      <select
        value={selectedMatchId ?? ''}
        onChange={e => setSelectedMatchId(e.target.value)}
        className="bg-white border border-border-theme rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-primary"
      >
        {matches.map(m => <option key={m.id} value={m.id}>{familyName(m)}</option>)}
      </select>
    ) : null;

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-text-main tracking-tight uppercase">Dashboard</h2>
          <p className="text-xs md:text-sm text-text-sub">Review, adjust and approve your weekly schedule.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6 border-b border-border-theme mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'schedules', label: 'Schedule', icon: FileText },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-primary' : 'text-text-sub hover:text-text-main'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="nannyTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
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
              <div className="p-4 bg-surface rounded-xl border border-border-theme">
                <p className="text-[9px] font-bold text-text-sub uppercase tracking-widest mb-1">Status</p>
                <p className="text-base font-bold text-success uppercase tracking-tighter">Active</p>
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
                      <h4 className="text-sm font-bold text-text-main tracking-tight uppercase">{familyName(m)}</h4>
                      <p className="text-[9px] text-text-sub font-bold uppercase">Active</p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  </div>
                  {parents[m.parentId]?.phone && <p className="text-[10px] text-text-sub mb-1">📞 {parents[m.parentId]?.phone}</p>}
                  {parents[m.parentId]?.email && <p className="text-[10px] text-text-sub truncate">✉️ {parents[m.parentId]?.email}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Weekly Schedule
              </h2>
              <MatchPicker />
            </div>
            {activeMatch ? (
              <WeekNavigator match={activeMatch} user={nanny} counterpartName={familyName(activeMatch)} />
            ) : (
              <div className="bg-white p-16 rounded-2xl border border-dashed border-border-theme text-center">
                <p className="text-xs text-text-sub">You have not been matched with a family yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Weekly Schedule
              </h2>
              <p className="text-[10px] text-text-sub mt-0.5 ml-6">
                Use the arrows to move to any week, past or future.
              </p>
            </div>
            <MatchPicker />
          </div>
          {activeMatch ? (
            <WeekNavigator match={activeMatch} user={nanny} counterpartName={familyName(activeMatch)} />
          ) : (
            <div className="bg-white p-16 rounded-2xl border border-dashed border-border-theme text-center">
              <p className="text-xs text-text-sub font-bold uppercase tracking-widest italic">No family assigned yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 md:h-[600px]">
          <div className="col-span-1 border border-border-theme rounded-2xl bg-white overflow-hidden flex flex-col max-h-[240px] md:max-h-none">
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
                    <p className="text-sm font-bold text-text-main">{familyName(m)}</p>
                    <p className="text-xs text-text-sub">Tap to chat</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-1 md:col-span-2 h-[500px] md:h-auto">
            {selectedMatchId ? (
              <MatchChat matchId={selectedMatchId} user={nanny} />
            ) : (
              <div className="h-full border border-border-theme rounded-2xl bg-surface flex flex-col items-center justify-center text-text-sub p-6 text-center">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-bold">Select a family</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
