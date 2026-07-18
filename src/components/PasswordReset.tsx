import React, { useState, useEffect } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { validatePassword } from '../lib/utils';
import logo from '../assets/logo.jpg';

interface PasswordResetProps {
  oobCode: string;
  onComplete: () => void;
}

export default function PasswordReset({ oobCode, onComplete }: PasswordResetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
      } catch (err: any) {
        console.error('Code verification error:', err);
        if (err.code === 'auth/expired-action-code') {
          setError('This password reset link has expired. Please request a new one.');
        } else if (err.code === 'auth/invalid-action-code') {
          setError('This password reset link is invalid. Please request a new one.');
        } else {
          setError(err.message || 'Failed to verify reset code.');
        }
      } finally {
        setVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.error);
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/expired-action-code') {
        setError('This password reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This password reset link is invalid. Please request a new one.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-text-sub font-medium">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-sm">
        <button
          onClick={onComplete}
          className="mb-8 px-3 py-2 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors hover:bg-primary/90 shadow-sm"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Login
        </button>

        <div className="flex flex-col items-center gap-2 mb-8">
          <img src={logo} alt="MomSub" className="h-12 md:h-14 w-auto" />
          <span className="text-[10px] font-bold text-text-sub uppercase tracking-widest bg-surface px-2 py-0.5 rounded-full mt-2">
            Reset Password
          </span>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-text-main tracking-tight mb-2">Create a new password</h2>
          {email && (
            <p className="text-[11px] text-text-sub">
              Resetting password for <strong>{email}</strong>
            </p>
          )}
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

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 mb-6 bg-success/5 border border-success/20 text-success rounded-xl text-[11px] font-bold uppercase tracking-tight flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 shrink-0" />
              Password reset successfully! Redirecting...
            </motion.div>
          )}
        </AnimatePresence>

        {!success && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">
                New Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sub hover:text-text-main transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-sub uppercase tracking-widest pl-1">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sub">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full bg-surface border border-border-theme px-11 py-3.5 rounded-xl text-sm font-medium focus:border-primary outline-none transition-all placeholder:text-text-sub/50"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sub hover:text-text-main transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {showConfirm ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
