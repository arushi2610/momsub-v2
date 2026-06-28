import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { User } from './types';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import ParentDashboard from './components/ParentDashboard';
import NannyDashboard from './components/NannyDashboard';
import Navbar from './components/Navbar';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimeoutRef = React.useRef<NodeJS.Timeout>();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  const resetInactivityTimer = () => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    if (!user) return;

    inactivityTimeoutRef.current = setTimeout(() => {
      auth.signOut();
      alert('Session expired due to inactivity. Please log in again.');
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    if (!user) return;
    resetInactivityTimer();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    };
  }, [user]);

  useEffect(() => {
    let unsubscribeDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        const path = `users/${firebaseUser.uid}`;
        try {
          unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (userDoc) => {
             if (userDoc.exists()) {
               setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
             } else {
               // Document will be created shortly by Auth.tsx
               setUser(null);
             }
             setLoading(false);
          }, (error) => {
             handleFirestoreError(error, OperationType.GET, path);
             setUser(null);
             setLoading(false);
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
          setUser(null);
          setLoading(false);
        }
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
       unsubscribeAuth();
       if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-20 md:pb-0">
      <Navbar user={user} />
      <main className="flex-1 container mx-auto px-2 md:px-4 py-4 md:py-8 max-w-7xl pt-20 md:pt-24">
        {user.role === 'ADMIN' && <AdminDashboard admin={user} />}
        {user.role === 'PARENT' && <ParentDashboard parent={user} />}
        {user.role === 'NANNY' && <NannyDashboard nanny={user} />}
      </main>
      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-theme md:hidden z-40 flex items-center justify-around h-16">
        <div className="flex-1 flex flex-col items-center justify-center py-2 text-primary border-t-2 border-primary">
          <div className="w-6 h-6 text-primary">📊</div>
          <span className="text-[10px] font-bold uppercase mt-1">Dashboard</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-2 text-text-sub">
          <div className="w-6 h-6">👤</div>
          <span className="text-[10px] font-bold uppercase mt-1">Profile</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-2 text-text-sub">
          <div className="w-6 h-6">🔔</div>
          <span className="text-[10px] font-bold uppercase mt-1">Alerts</span>
        </div>
      </nav>
    </div>
  );
}
