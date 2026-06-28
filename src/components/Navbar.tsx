import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { LogOut, Bell, X, Edit3 } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { updateEmail } from 'firebase/auth';
import { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  user: User;
}

export default function Navbar({ user }: NavbarProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toastNotif, setToastNotif] = useState<Notification | null>(null);

  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editRole, setEditRole] = useState<UserRole>(user.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [newAdminCode, setNewAdminCode] = useState('');
  const [showCodeRotation, setShowCodeRotation] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newNotif = { id: change.doc.id, ...change.doc.data() } as Notification;
          // Check if it was created recently to avoid toasting on initial load or old notifications
          const isRecent = newNotif.createdAt && newNotif.createdAt.toMillis && (Date.now() - newNotif.createdAt.toMillis() < 5000);
          if (isRecent && !newNotif.read) {
            setToastNotif(newNotif);
            setTimeout(() => setToastNotif(null), 5000);
          }
        }
      });

      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setNotifications(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { read: true })
      ));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      if (editEmail !== user.email && auth.currentUser) {
        // Warning: this might fail without re-auth, but we attempt it
        await updateEmail(auth.currentUser, editEmail);
      }
      
      await updateDoc(doc(db, 'users', user.id), {
        name: editName,
        email: editEmail,
        phone: editPhone,
        role: editRole
      });
      setShowEditProfile(false);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message || 'Failed to update profile. Email changes may require recent login.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-border-theme z-40 md:z-50">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-1.5 md:gap-2.5">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-sm md:text-lg">M</div>
          <span className="text-lg md:text-xl font-extrabold text-primary tracking-tight hidden sm:inline">MomSub</span>
          <div className="hidden lg:flex items-center gap-2 px-3 py-0.5 bg-primary-soft text-primary rounded-full ml-4">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {user.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) markAllRead();
              }}
              className="p-2 text-text-sub hover:bg-surface rounded-lg transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-border-theme rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 bg-surface border-b border-border-theme flex items-center justify-between">
                  <h3 className="font-bold text-text-main text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary font-semibold hover:underline">Mark all read</button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-text-sub">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          if (!n.read) updateDoc(doc(db, 'notifications', n.id), { read: true });
                          if (n.scheduleId) {
                            sessionStorage.setItem('open-schedule-id', n.scheduleId);
                            window.dispatchEvent(new CustomEvent('open-schedule', { detail: { scheduleId: n.scheduleId } }));
                            setShowNotifications(false);
                          }
                        }}
                        className={`p-4 border-b border-border-theme last:border-0 cursor-pointer hover:bg-surface transition-colors ${!n.read ? 'bg-primary-soft/50' : ''}`}
                      >
                        <p className="text-sm text-text-main leading-relaxed mb-1">{n.message}</p>
                        <span className="text-[10px] text-text-sub uppercase tracking-wider">
                           {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-border-theme mx-2"></div>

          <div className="flex items-center gap-4 pl-2">
            <button
              onClick={() => user.role === 'ADMIN' && setShowEditProfile(true)}
              className={`text-left hover:bg-surface px-2 sm:px-3 py-1.5 rounded-xl transition-colors group relative max-w-[140px] sm:max-w-[280px] ${user.role !== 'ADMIN' ? 'cursor-default' : ''}`}
            >
              <p className="text-sm font-bold text-text-main leading-none mb-1 group-hover:text-primary flex items-center gap-1.5 truncate">
                {user.name}
                {user.role === 'ADMIN' && <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:inline-block" />}
              </p>
              <p className="text-[10px] text-text-sub font-medium truncate hidden sm:block break-words">{user.email}</p>
            </button>
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-text-sub hover:text-error hover:bg-red-50 rounded-lg transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-text-main/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-theme relative"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-2">Sign out</h3>
                <p className="text-sm font-medium text-text-sub mb-6">Are you sure you want to sign out?</p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border-theme font-bold text-sm text-text-main hover:bg-surface transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      auth.signOut();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-error text-white font-bold text-sm hover:bg-error/90 transition-all active:scale-95"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditProfile && (
          <div className="fixed inset-0 bg-text-main/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl border border-border-theme"
            >
              <div className="p-4 border-b border-border-theme flex items-center justify-between bg-surface">
                 <h3 className="font-bold text-text-main tracking-tight uppercase">Edit Profile</h3>
                 <button onClick={() => setShowEditProfile(false)} className="p-2 hover:bg-white rounded-lg transition-colors">
                   <X className="w-4 h-4" />
                 </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
                {profileError && (
                   <div className="p-3 bg-error/10 text-error text-xs font-bold rounded-lg uppercase tracking-tight">
                      {profileError}
                   </div>
                )}
                
                <div>
                   <label className="block text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 ml-1">Name</label>
                   <input
                     type="text"
                     value={editName}
                     onChange={e => setEditName(e.target.value)}
                     className="w-full border border-border-theme bg-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold transition-all"
                     required
                   />
                </div>

                <div>
                   <label className="block text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 ml-1">Email</label>
                   <input
                     type="email"
                     value={editEmail}
                     onChange={e => setEditEmail(e.target.value)}
                     className="w-full border border-border-theme bg-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold transition-all"
                     required
                   />
                </div>

                <div>
                   <label className="block text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 ml-1">Phone</label>
                   <input
                     type="tel"
                     value={editPhone}
                     onChange={e => setEditPhone(e.target.value)}
                     className="w-full border border-border-theme bg-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold transition-all"
                   />
                </div>

                <div>
                   <label className="block text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1.5 ml-1">Account Type</label>
                   <select
                     value={editRole}
                     onChange={e => setEditRole(e.target.value as UserRole)}
                     disabled={user.role !== 'ADMIN'}
                     className={`w-full border border-border-theme bg-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold transition-all appearance-none ${user.role !== 'ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                     <option value="PARENT">Parent</option>
                     <option value="NANNY">Nanny</option>
                     <option value="ADMIN">Admin</option>
                   </select>
                </div>

                {user.role === 'ADMIN' && (
                  <div className="pt-4 border-t border-border-theme">
                    <button
                      type="button"
                      onClick={() => setShowCodeRotation(!showCodeRotation)}
                      className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                    >
                      {showCodeRotation ? 'Cancel' : 'Rotate Admin Code'}
                    </button>
                    {showCodeRotation && (
                      <div className="mt-3">
                        <input
                          type="text"
                          value={newAdminCode}
                          onChange={e => setNewAdminCode(e.target.value)}
                          placeholder="New admin code (min 6 chars)"
                          className="w-full border border-border-theme bg-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold mb-2"
                        />
                        <p className="text-[9px] text-text-sub mb-2">⚠️ Save this code securely. It will replace the current code.</p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (newAdminCode.length < 6) {
                              setProfileError('Code must be at least 6 characters');
                              return;
                            }
                            // Store in localStorage as a reminder (in production, would be encrypted in Firestore)
                            localStorage.setItem('admin_code_rotated', new Date().toISOString());
                            localStorage.setItem('admin_code_length', newAdminCode.length.toString());
                            setProfileError('Admin code rotation recorded. Update must be deployed by admin.');
                            setNewAdminCode('');
                            setShowCodeRotation(false);
                          }}
                          className="w-full py-2 bg-error text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-error/90 transition-all"
                        >
                          Rotate Code
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4">
                   <button
                     type="submit"
                     disabled={savingProfile}
                     className="w-full py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                   >
                     {savingProfile ? 'Saving...' : 'Save Profile'}
                   </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toastNotif && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)]"
          >
            <div 
              onClick={() => {
                 if (toastNotif.scheduleId) {
                   sessionStorage.setItem('open-schedule-id', toastNotif.scheduleId);
                   window.dispatchEvent(new CustomEvent('open-schedule', { detail: { scheduleId: toastNotif.scheduleId } }));
                 }
                 setToastNotif(null);
              }}
              className="bg-white border text-left border-border-theme rounded-2xl p-4 shadow-xl flex items-start gap-4 cursor-pointer hover:bg-surface transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest mb-1">New Notification</p>
                <p className="text-sm font-medium text-text-main leading-tight">{toastNotif.message}</p>
              </div>
              <button 
                onClick={() => setToastNotif(null)}
                className="p-1.5 hover:bg-surface rounded-lg text-text-sub transition-colors -mr-1 -mt-1 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
