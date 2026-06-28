import React, { useState } from 'react';
import { User, Shift, UserRole } from '../types';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, writeBatch } from 'firebase/firestore';
import { X, Users, Calendar, Plus, Trash2, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateShiftHours, calculateTotalHours, snapTime15, TIME_OPTIONS, formatTimeLabel, formatHours, validateTimeRange, validateHours } from '../lib/utils';

interface MatchFormProps {
  users: User[];
  onClose: () => void;
}

export default function MatchForm({ users, onClose }: MatchFormProps) {
  const [parentId, setParentId] = useState('');
  const [nannyId, setNannyId] = useState('');
  const [shifts, setShifts] = useState<Partial<Shift>[]>([
    { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parents = users.filter(u => u.role === 'PARENT').sort((a, b) => a.name.localeCompare(b.name));
  const nannies = users.filter(u => u.role === 'NANNY').sort((a, b) => a.name.localeCompare(b.name));

  const addShift = () => {
    if (shifts.length >= 10) return;
    setShifts([...shifts, { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }]);
  };

  const removeShift = (index: number) => {
    setShifts(shifts.filter((_, i) => i !== index));
  };

  const updateShift = (index: number, field: keyof Shift, value: any) => {
    const newShifts = [...shifts];
    newShifts[index] = { ...newShifts[index], [field]: value };
    setShifts(newShifts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentId || !nannyId) {
      setError('Please select both parent and nanny');
      return;
    }

    for (const s of shifts) {
      const timeCheck = validateTimeRange(s.startTime || '', s.endTime || '');
      if (!timeCheck.valid) {
        setError(timeCheck.error);
        return;
      }
    }

    const totalHours = calculateTotalHours(shifts);
    const hoursCheck = validateHours(totalHours);
    if (!hoursCheck.valid) {
      setError(hoursCheck.error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const batch = writeBatch(db);
      const currentUserId = auth.currentUser?.uid || users.find(u => u.role === 'ADMIN')?.id || 'dev-admin';
      
      // 1. Create Match
      const matchRef = doc(collection(db, 'matches'));
      batch.set(matchRef, {
        parentId,
        nannyId,
        adminId: currentUserId,
        status: 'ACTIVE',
        createdAt: serverTimestamp()
      });

      // 2. Create Standard Weekly Schedule
      const scheduleRef = doc(collection(db, 'schedules'));
      const totalHours = calculateTotalHours(shifts);
      
      batch.set(scheduleRef, {
        matchId: matchRef.id,
        type: 'STANDARD',
        status: 'PENDING_NANNY',
        totalHours,
        version: 1,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId
      });

      // 3. Create Shifts
      shifts.forEach(s => {
        const shiftRef = doc(collection(db, `schedules/${scheduleRef.id}/shifts`));
        batch.set(shiftRef, {
          scheduleId: scheduleRef.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          totalHours: calculateShiftHours(s.startTime!, s.endTime!)
        });
      });

      // 4. Create Notification for Parent
      const parentNotifRef = doc(collection(db, 'notifications'));
      batch.set(parentNotifRef, {
        userId: parentId,
        scheduleId: scheduleRef.id,
        message: 'Admin has created a new match and standard schedule for your review.',
        type: 'MATCH_CREATED',
        read: false,
        createdAt: serverTimestamp()
      });

      // 5. Create Notification for Nanny
      const nannyNotifRef = doc(collection(db, 'notifications'));
      batch.set(nannyNotifRef, {
        userId: nannyId,
        scheduleId: scheduleRef.id,
        message: 'Admin has created a new match and standard schedule for your review.',
        type: 'MATCH_CREATED',
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to deploy match. Ensure all fields are valid.");
      handleFirestoreError(err, OperationType.WRITE, 'matches/schedules');
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
        className="bg-white rounded-t-2xl md:rounded-3xl shadow-2xl w-full md:max-w-2xl overflow-hidden border border-border-theme max-h-[90vh] flex flex-col"
      >
        <div className="px-8 py-6 bg-primary text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <h2 className="text-xl font-bold tracking-tight">Create Match</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-8 scroll-smooth">
          {error && (
            <div className="p-4 bg-error/5 border border-error/20 rounded-xl text-error text-[11px] font-bold uppercase tracking-tight flex items-center gap-3">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {parents.length === 0 || nannies.length === 0 ? (
            <div className="p-6 bg-warning/5 border border-warning/20 rounded-2xl text-center">
              <Users className="w-8 h-8 text-warning mx-auto mb-3" />
              <p className="text-xs font-bold text-text-main uppercase tracking-widest mb-1">Incomplete Roster</p>
              <p className="text-[10px] text-text-sub font-medium uppercase leading-relaxed">
                Add at least one parent and nanny before creating a match.
              </p>
              <button 
                type="button"
                onClick={onClose}
                className="mt-4 text-[10px] font-bold text-primary underline uppercase tracking-widest"
              >
                Go back and create users
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            <div>
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-2 block">Select Parent</label>
              <select
                required
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full bg-surface border border-border-theme rounded-xl py-3 px-4 focus:border-primary outline-none transition-all"
              >
                <option value="">-- Choose Parent --</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-2 block">Select Nanny</label>
              <select
                required
                value={nannyId}
                onChange={e => setNannyId(e.target.value)}
                className="w-full bg-surface border border-border-theme rounded-xl py-3 px-4 focus:border-primary outline-none transition-all"
              >
                <option value="">-- Choose Nanny --</option>
                {nannies.map(n => (
                  <option key={n.id} value={n.id}>{n.name} ({n.email})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main border-l-4 border-primary pl-3">Standard Weekly Schedule</h3>
              <button
                type="button"
                onClick={addShift}
                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 group"
              >
                <Plus className="w-3 h-3 group-hover:scale-125 transition-transform" /> Add Shift
              </button>
            </div>
            
            <div className="space-y-3">
              {shifts.map((shift, index) => (
                <div key={index} className="flex flex-wrap items-center gap-3 p-4 bg-surface rounded-2xl border border-border-theme group transition-all hover:bg-white hover:border-primary/20 hover:shadow-sm">
                  <select
                    value={shift.dayOfWeek}
                    onChange={e => updateShift(index, 'dayOfWeek', e.target.value)}
                    className="flex-1 bg-white border border-border-theme rounded-lg py-2 px-3 text-sm outline-none focus:border-primary"
                  >
                    {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(d => (
                      <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 flex-1">
                    <Clock className="w-3.5 h-3.5 text-text-sub hidden sm:block" />
                    <select
                      value={shift.startTime}
                      onChange={e => updateShift(index, 'startTime', e.target.value)}
                      className="w-full sm:w-auto bg-white border border-border-theme rounded-lg py-2 px-3 text-sm outline-none focus:border-primary appearance-none min-w-[100px]"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                    </select>
                    <span className="text-text-sub hidden sm:block">to</span>
                    <select
                      value={shift.endTime}
                      onChange={e => updateShift(index, 'endTime', e.target.value)}
                      className="w-full sm:w-auto bg-white border border-border-theme rounded-lg py-2 px-3 text-sm outline-none focus:border-primary appearance-none min-w-[100px]"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeShift(index)}
                    className="p-2 text-text-sub hover:text-error hover:bg-error/10 rounded-xl transition-all ml-auto md:opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
              <span className="text-xs font-bold text-text-sub uppercase tracking-widest">Weekly Total:</span>
              <span className="text-xl font-black text-primary font-mono italic">{formatHours(calculateTotalHours(shifts))} <span className="text-sm font-bold uppercase not-italic">Hrs</span></span>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading || !parentId || !nannyId}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Match"}
            </button>
          </div>
        </>
      )}
    </form>
      </motion.div>
    </div>
  );
}
