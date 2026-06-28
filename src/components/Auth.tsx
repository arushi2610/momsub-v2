import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { LogIn, ShieldCheck, Users, Calendar, Mail, Lock, ArrowLeft, UserPlus, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { validateEmail, validatePassword } from '../lib/utils';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'PARENT' | 'NANNY' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const syncUserRecord = async (firebaseUser: any) => {
    let userRef = doc(db, 'users', firebaseUser.uid);
    let userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Fallback: Check if there's a record with this email (created by admin)
      const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email?.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        const userData = existingDoc.data();
        
        await setDoc(userRef, {
          ...userData,
          uid: firebaseUser.uid,
          updatedAt: serverTimestamp(),
          role: selectedRole || userData.role || 'PARENT'
        });
        
        if (existingDoc.id !== firebaseUser.uid) {
          await deleteDoc(doc(db, 'users', existingDoc.id));
        }
      } else if (mode === 'REGISTER' || selectedRole) {
        // Self registration with the selected role
        await setDoc(userRef, {
          email: firebaseUser.email,
          name: firebaseUser.displayName || fullName || 'User',
          phone: phone || undefined,
          role: selectedRole || 'PARENT',
          createdAt: serverTimestamp()
        });
      } else {
        await auth.signOut();
        throw new Error("Account not found. Please sign up.");
      }
    } else {
      // User already exists — role is immutable, no update needed
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLocked) {
      setError("Too many failed attempts. Please try again in 5 minutes.");
      return;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error);
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.error);
      return;
    }

    if (selectedRole === 'ADMIN' && adminCode !== 'HAPPYMOM20') {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        setIsLocked(true);
        setTimeout(() => {
          setIsLocked(false);
          setFailedAttempts(0);
        }, 5 * 60 * 1000);
      }
      setError(`Invalid admin access code. (${newAttempts}/5 attempts)`);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'REGISTER') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
          await updateProfile(result.user, { displayName: fullName });
        }
        await syncUserRecord(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await syncUserRecord(result.user);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already registered. Please click "Log in" instead.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled. Please enable it in Firebase Console.');
      } else {
        setError(err.message || "Authentication failed.");
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (selectedRole === 'ADMIN' && newAttempts >= 5) {
          setIsLocked(true);
          setTimeout(() => {
            setIsLocked(false);
            setFailedAttempts(0);
          }, 5 * 60 * 1000);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || "Failed to send reset email.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await syncUserRecord(result.user);
    } catch (err: any) {
      console.error(err);
      setError("Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedRole) {
     return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8">
           <div className="w-full max-w-sm md:max-w-lg">
              <div className="flex flex-col items-center gap-2 mb-12">
                 <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg">M</div>
                 <span className="text-4xl font-black italic tracking-tighter text-text-main">MomSub</span>
              </div>
              <div className="mb-10 text-center">
                 <h2 className="text-2xl font-bold text-text-main tracking-tight mb-2">Select your role to continue</h2>
                 <p className="text-sm font-medium text-text-sub max-w-sm mx-auto">Choose how you will be using MomSub to see the tailored experience.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <button onClick={() => setSelectedRole('PARENT')} className="p-6 rounded-2xl border-2 border-border-theme hover:border-primary hover:bg-surface transition-all group text-left flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Users className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="font-bold text-text-main text-lg mb-1">Parent</h3>
                       <p className="text-xs text-text-sub font-medium">Manage childcare, bookings & payments</p>
                    </div>
                 </button>
                 
                 <button onClick={() => setSelectedRole('NANNY')} className="p-6 rounded-2xl border-2 border-border-theme hover:border-success hover:bg-surface transition-all group text-left flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="font-bold text-text-main text-lg mb-1">Nanny</h3>
                       <p className="text-xs text-text-sub font-medium">Manage schedule, jobs & earnings</p>
                    </div>
                 </button>
                 
                 <button onClick={() => setSelectedRole('ADMIN')} className="p-6 rounded-2xl border-2 border-border-theme hover:border-error hover:bg-surface transition-all group text-left flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-xl bg-error/10 text-error flex items-center justify-center group-hover:scale-110 transition-transform">
                       <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="font-bold text-text-main text-lg mb-1">Admin</h3>
                       <p className="text-xs text-text-sub font-medium">Manage platform, users & reports</p>
                    </div>
                 </button>
              </div>
           </div>
        </div>
     )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-sm relative">
        <button 
           onClick={() => { setSelectedRole(null); setError(null); }}
           className="absolute -top-16 left-0 text-[10px] font-bold uppercase tracking-widest text-text-sub hover:text-text-main flex items-center gap-1.5 transition-colors"
        >
           <ArrowLeft className="w-3 h-3" /> Change Role
        </button>

        <div className="flex flex-col items-center gap-2 mb-8">
           <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-sm ${selectedRole === 'ADMIN' ? 'bg-error' : selectedRole === 'NANNY' ? 'bg-success' : 'bg-primary'}`}>M</div>
           <span className="text-3xl font-black italic tracking-tighter text-text-main">MomSub</span>
           <span className="text-[10px] font-bold text-text-sub uppercase tracking-widest bg-surface px-2 py-0.5 rounded-full mt-2">{selectedRole} LOGIN</span>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-text-main tracking-tight">
            {mode === 'LOGIN' ? 'Welcome back' : 'Create an account'}
          </h2>
        </div>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 mb-6 bg-error/5 border border-error/20 text-error rounded-xl text-[11px] font-bold uppercase tracking-tight flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-error/10 flex items-center justify-center shrink-0">!</div>
                {error}
              </motion.div>
            )}
            {resetSent && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 mb-6 bg-success/5 border border-success/20 text-success rounded-xl text-[11px] font-bold uppercase tracking-tight flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center shrink-0">✓</div>
                Password reset email sent. Please check your inbox.
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'REGISTER' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">Name</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub"><Users className="w-4 h-4" /></span>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Full name"
                      className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">Phone</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub"><Mail className="w-4 h-4" /></span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">Email</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub"><Mail className="w-4 h-4" /></span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub"><Lock className="w-4 h-4" /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sub hover:text-text-main transition-colors"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {mode === 'LOGIN' && (
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {selectedRole === 'ADMIN' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">Admin Access Code</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub"><ShieldCheck className="w-4 h-4" /></span>
                  <input
                    type={showAdminCode ? 'text' : 'password'}
                    required
                    value={adminCode}
                    onChange={e => setAdminCode(e.target.value)}
                    placeholder="Enter access code"
                    className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-error outline-none transition-all placeholder:text-text-sub/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminCode(!showAdminCode)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sub hover:text-text-main transition-colors"
                  >
                    {showAdminCode ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${selectedRole === 'ADMIN' ? 'bg-error hover:bg-error/90' : selectedRole === 'NANNY' ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary/90'}`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                mode === 'LOGIN' ? 'Log in' : 'Sign up'
              )}
            </button>
          </form>

          {selectedRole !== 'ADMIN' && (
            <>
              <div className="my-8 flex items-center gap-4">
                 <div className="flex-1 h-px bg-border-theme"></div>
                 <span className="text-[9px] font-bold text-text-sub uppercase tracking-widest">or continue with</span>
                 <div className="flex-1 h-px bg-border-theme"></div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-border-theme py-3.5 px-4 rounded-xl font-bold text-sm text-text-main hover:bg-surface transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.94 0 3.51.68 4.7 1.83l3.48-3.48C17.91 1.41 15.21 0 12 0 7.31 0 3.25 2.67 1.25 6.6l4.08 3.17c.96-2.81 3.58-4.73 6.67-4.73Z"/>
                  <path fill="#4285F4" d="M23.64 12.2c0-.78-.07-1.53-.2-2.25l-11.44.05v4.51h6.47c-.28 1.48-1.11 2.74-2.37 3.58l4.15 3.22c2.42-2.23 3.82-5.52 3.82-9.11l-.43.05Z"/>
                  <path fill="#FBBC05" d="M5.33 14.23c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.25 6.7C.45 8.3.01 10.1.01 12s.44 3.7 1.24 5.3l4.08-3.07Z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-4.15-3.22c-1.1.74-2.51 1.18-3.93 1.18-3.09 0-5.71-1.92-6.67-4.73l-4.08 3.17C3.25 21.33 7.31 24 12 24Z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <button 
            onClick={() => {
              setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
              setError(null);
            }}
            className="w-full mt-6 text-[11px] font-bold text-text-sub uppercase tracking-widest hover:text-text-main transition-colors flex items-center justify-center gap-2"
          >
            {mode === 'LOGIN' ? (
              <>
                Don't have an account? Sign up
              </>
            ) : (
              <>
                Already have an account? Log in
              </>
            )}
          </button>
        </div>
      </div>
  );
}
