import React, { useState, useEffect } from 'react';
import { User, Match } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { Calendar, Users, LayoutDashboard, MessageSquare, FileText } from 'lucide-react';
import MatchChat from './MatchChat';
import WeekNavigator from './WeekNavigator';
import { motion } from 'motion/react';

interface ParentDashboardProps {
  parent: User;
}

export default function ParentDashboard({ parent }: ParentDashboardProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [nannies, setNannies] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'messages'>('overview');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenSchedule = () => setActiveTab('schedules');
    window.addEventListener('open-schedule', handleOpenSchedule);
    return () => window.removeEventListener('open-schedule', handleOpenSchedule);
  }, []);

  useEffect(() => {
    const qMatches = query(collection(db, 'matches'), where('parentId', '==', parent.id));

    const unsubMatches = onSnapshot(qMatches, async snap => {
      const matchData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(matchData);
      setSelectedMatchId(prev => prev ?? matchData[0]?.id ?? null);

      const nannyIds = Array.from(new Set(matchData.map(m => m.nannyId)));
      const nannyDocs: Record<string, User> = {};
      for (const id of nannyIds) {
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) nannyDocs[id] = { id: uDoc.id, ...uDoc.data() } as User;
      }
      setNannies(nannyDocs);
      setLoading(false);
    }, error => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
      setLoading(false);
    });

    return () => unsubMatches();
  }, [parent.id]);

  const activeMatch = matches.find(m => m.id === selectedMatchId) || matches[0];

  if (loading) {
    return (
      <div className="space-y-8 px-2">
        <div>
          <h2 className="text-2xl font-extrabold text-text-main tracking-tight uppercase">Family Dashboard</h2>
          <p className="text-sm text-text-sub">Review and approve nanny hours.</p>
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
        {matches.map(m => (
          <option key={m.id} value={m.id}>{nannies[m.nannyId]?.name ?? 'Nanny'}</option>
        ))}
      </select>
    ) : null;

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-text-main tracking-tight uppercase">Family Dashboard</h2>
          <p className="text-xs md:text-sm text-text-sub">Review, adjust and approve your nanny's schedule.</p>
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
            {activeTab === tab.id && <motion.div layoutId="parentTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Your Assigned Nanny
            </h2>
            {matches.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-dashed border-border-theme text-center">
                <p className="text-sm text-text-sub italic">No nanny assigned yet.</p>
              </div>
            ) : (
              matches.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-xl border border-border-theme shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-success flex items-center justify-center text-white font-bold text-lg">
                      {nannies[m.nannyId]?.name?.[0] || 'N'}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main text-sm">{nannies[m.nannyId]?.name}</h3>
                      <p className="text-[10px] text-text-sub uppercase tracking-tight font-bold">Nanny</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border-theme">
                    <span className="text-[9px] font-bold text-text-sub uppercase tracking-widest block mb-1">Phone</span>
                    <a href={`tel:${nannies[m.nannyId]?.phone}`} className="text-[11px] font-bold text-primary hover:underline">
                      {nannies[m.nannyId]?.phone || 'Not provided'}
                    </a>
                  </div>
                </div>
              ))
            )}

            <div className="p-6 bg-primary rounded-2xl text-white shadow-xl shadow-primary/10 overflow-hidden relative mt-6">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-2">Support</p>
              <h4 className="text-lg font-bold mb-4 leading-tight">Questions about billing or need help?</h4>
              <a href="tel:847-213-9336" className="inline-flex items-center justify-center gap-2 text-xs font-bold bg-white text-primary px-5 py-2.5 rounded-lg hover:bg-surface transition-all active:scale-95 shadow-sm">
                Reach out to MomSub: 847-213-9336
              </a>
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
              <WeekNavigator match={activeMatch} user={parent} counterpartName={nannies[activeMatch.nannyId]?.name} />
            ) : (
              <div className="bg-white p-16 rounded-2xl border border-dashed border-border-theme text-center">
                <p className="text-xs text-text-sub">No nanny assigned yet.</p>
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
            <WeekNavigator match={activeMatch} user={parent} counterpartName={nannies[activeMatch.nannyId]?.name} />
          ) : (
            <div className="bg-white p-16 rounded-2xl border border-dashed border-border-theme text-center">
              <p className="text-xs text-text-sub font-bold uppercase tracking-widest italic">No nanny assigned yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 md:h-[600px]">
          <div className="col-span-1 border border-border-theme rounded-2xl bg-white overflow-hidden flex flex-col max-h-[240px] md:max-h-none">
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
          <div className="col-span-1 md:col-span-2 h-[500px] md:h-auto">
            {selectedMatchId ? (
              <MatchChat matchId={selectedMatchId} user={parent} />
            ) : (
              <div className="h-full border border-border-theme rounded-2xl bg-surface flex flex-col items-center justify-center text-text-sub p-6 text-center">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-bold">Select a nanny</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
