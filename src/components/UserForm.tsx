import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, UserPlus, Mail, Phone, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole } from '../types';
import { validateEmail } from '../lib/utils';

interface UserFormProps {
  onClose: () => void;
}

export default function UserForm({ onClose }: UserFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'PARENT' as UserRole,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    const emailCheck = validateEmail(formData.email);
    if (!emailCheck.valid) {
      setError(emailCheck.error);
      return;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      // Use addDoc to let Firestore handle ID generation
      await addDoc(usersRef, {
        email: formData.email.toLowerCase(),
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create user record.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0, y: '100%', scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: '100%', scale: 1 }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-white rounded-t-2xl md:rounded-[2rem] shadow-2xl w-full md:max-w-lg overflow-hidden border border-border-theme"
      >
        <div className="px-10 py-8 bg-surface border-b border-border-theme flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-text-main tracking-tighter uppercase italic">Add <span className="text-primary not-italic">User</span></h2>
            <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest mt-1">Create a new user account</p>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white border border-border-theme rounded-2xl text-text-sub hover:text-primary transition-all active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-10 space-y-4 md:space-y-8 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-error/5 border border-error/20 rounded-2xl text-error text-[11px] font-bold uppercase tracking-tight flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-error/10 flex items-center justify-center shrink-0">!</div>
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 block">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-surface border border-border-theme rounded-xl py-4 pl-11 pr-4 text-sm font-bold focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-surface border border-border-theme rounded-xl py-4 pl-11 pr-4 text-sm font-bold focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 block">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
                <input
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-surface border border-border-theme rounded-xl py-4 pl-11 pr-4 text-sm font-bold focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 block">User Role</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'PARENT', label: 'Parent' },
                  { id: 'NANNY', label: 'Nanny' }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: r.id as UserRole })}
                    className={`py-4 rounded-xl font-bold text-[11px] uppercase tracking-wider border-2 transition-all ${formData.role === r.id ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-surface border-border-theme text-text-sub hover:bg-white'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              disabled={loading}
              className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-primary/90 transition-all shadow-xl shadow-primary/10 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create User"}
            </button>
          </div>
          
          <p className="text-center text-[9px] font-bold text-text-sub uppercase tracking-widest leading-relaxed max-w-[240px] mx-auto opacity-60">This account will be handled by MomSub admin.</p>
        </form>
      </motion.div>
    </div>
  );
}
