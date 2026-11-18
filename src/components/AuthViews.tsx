import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Headphones,
  MessageCircle,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import { UserProfile } from '../types';
import { validateGenuineMobile, validateMixedPassword, validateUsername } from '../utils/validation';
import { BrandLogo } from './BrandLogo';

export type AuthScreenMode = 'login' | 'signup' | 'forgot';

interface AuthViewsProps {
  initialMode: AuthScreenMode;
  onBack: () => void;
  onOpenSupport: (category?: string) => void;
  onSuccess: (token: string, user: UserProfile) => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  initialMode,
  onBack,
  onOpenSupport,
  onSuccess,
}) => {
  const [mode, setMode] = useState<AuthScreenMode>(initialMode);
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo login failed');
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!mobile.trim()) {
      setError('Enter your registered mobile number or username.');
      return;
    }
    if (!password.trim()) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const uCheck = validateUsername(username);
    if (!uCheck.valid) {
      setError(uCheck.error || 'Invalid username.');
      return;
    }

    const mCheck = validateGenuineMobile(mobile);
    if (!mCheck.valid) {
      setError(mCheck.error || 'Invalid mobile number.');
      return;
    }

    const pCheck = validateMixedPassword(password);
    if (!pCheck.valid) {
      setError(pCheck.error || 'Password must mix letters and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Confirm password does not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          mobile: mobile.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleShareApk = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AD78',
          text: 'Play WinGo & Aviator on AD78!',
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setInfoMsg('App link copied to clipboard!');
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e0b36] via-[#0c1629] to-[#08101c] px-4 py-6 flex flex-col items-center justify-center">
      <div className="mb-5">
        <BrandLogo size="lg" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-cyan-500/60 bg-[#08121f]/95 p-5 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.12)]">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => {
              if (mode === 'forgot') {
                setMode('login');
                setError('');
              } else {
                onBack();
              }
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-2 -ml-2 text-sm font-semibold text-white hover:text-cyan-300 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="rounded-full bg-[#0d8b96] hover:bg-[#10a3b0] px-4 py-1.5 text-xs font-bold text-white transition active:scale-95"
            >
              Demo login
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs text-rose-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-xs text-emerald-200">
            <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Sign in</h1>
              <p className="mt-1 text-xs text-slate-300">
                Please enter your mobile number/username &amp; password.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white">
                Mobile Number / Username <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit Mobile or Username"
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white">
                Password (Letters + Numbers) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (e.g. ad78pass)"
                  className="w-full rounded-xl bg-white px-4 py-3 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPass ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onOpenSupport('Forgot Password / Login')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline"
              >
                <Headphones className="h-3.5 w-3.5" />
                <span>24×7 Support Help</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setInfoMsg('');
                  setMode('forgot');
                }}
                className="text-xs font-semibold text-white underline hover:text-cyan-300"
              >
                Forgot Username/Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mx-auto block w-52 rounded-full bg-gradient-to-r from-[#0e8a93] to-[#087f8c] border border-cyan-400/40 py-3 text-sm font-bold tracking-wide text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60"
            >
              {loading ? 'SIGNING IN...' : 'LOGIN'}
            </button>

            <div className="border-t border-cyan-500/30 pt-4 text-center text-xs text-slate-300">
              Don&apos;t have account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setInfoMsg('');
                  setMode('signup');
                }}
                className="font-bold text-white underline hover:text-cyan-300"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Create Account</h1>
              <p className="mt-1 text-xs text-slate-300">
                Mix letters &amp; numbers in Username and Password. Deposit ₹100+ after sign up to play.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Username (Letters + Numbers) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. rahul78"
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Genuine Mobile Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit Indian Mobile (no fake/repeated digits)"
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Password (Letters + Numbers) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars, e.g. rahul123"
                  className="w-full rounded-xl bg-white px-4 py-2.5 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 p-1"
                >
                  {showPass ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-gradient-to-r from-[#0e8a93] to-[#087f8c] border border-cyan-400/40 py-3 text-sm font-bold tracking-wide text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-60"
            >
              {loading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
            </button>

            <div className="border-t border-cyan-500/30 pt-3 text-center text-xs text-slate-300">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('login');
                }}
                className="font-bold text-white underline hover:text-cyan-300"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">Forgot Username / Password?</h1>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                For your security, one mobile number allows one account ID. Password recovery is handled by our 24×7 Support team &amp; Admin.
              </p>
            </div>

            <div className="rounded-xl bg-[#0b192d] border border-cyan-500/30 p-4 text-xs text-slate-200 space-y-2">
              <p>1. Tap Contact 24×7 Support below.</p>
              <p>2. Enter your registered mobile number &amp; attach a screenshot if needed.</p>
              <p>3. Support &amp; Admin will verify and reset your account password.</p>
            </div>

            <button
              type="button"
              onClick={() => onOpenSupport('Forgot Password / Login')}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
            >
              <Headphones className="h-4 w-4" />
              <span>Contact 24×7 Support</span>
            </button>

            <div className="border-t border-cyan-500/30 pt-3 text-center text-xs text-slate-300">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-bold text-white underline"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 w-full max-w-md space-y-2.5">
        <button
          type="button"
          onClick={() => onOpenSupport('General Support')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0d8b96] py-2.5 text-sm font-bold text-white hover:brightness-105 transition"
        >
          <MessageCircle className="h-4 w-4" />
          <span>24×7 Support Desk</span>
        </button>

        <button
          type="button"
          onClick={handleShareApk}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-[#08121f]/80 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/10 transition"
        >
          <Share2 className="h-4 w-4" />
          <span>Share This APK With Friends</span>
        </button>

        <p className="pt-2 text-center text-[11px] leading-relaxed text-slate-400">
          Disclaimer: Please note that Gaming involves financial risk and could be addictive over time if not practised within limits. Only 18+ people should use AD78 services responsibly.
        </p>
      </div>
    </div>
  );
};
