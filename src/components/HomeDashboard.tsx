import React from 'react';
import {
  Headphones,
  Home,
  Megaphone,
  Menu,
  User,
  Wallet,
} from 'lucide-react';
import { AviatorState, PlatformConfig, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';
import { MenuPage } from './WalletAndMenu';

interface HomeDashboardProps {
  user: UserProfile | null;
  aviator: AviatorState | null;
  platformConfig?: PlatformConfig | null;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenWingo: () => void;
  onOpenAviator: () => void;
  onOpenMenu: (page: MenuPage) => void;
  onOpenSupport: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  aviator,
  platformConfig,
  onOpenAuth,
  onOpenWingo,
  onOpenAviator,
  onOpenMenu,
  onOpenSupport,
}) => {
  return (
    <div className="min-h-screen bg-[#08101d] text-white pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0a1426]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenMenu('menu')}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandLogo size="sm" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSupport}
            aria-label="24x7 Support"
            title="24x7 Support"
            className="flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-white/20 transition whitespace-nowrap"
          >
            <Headphones className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">24×7 Support</span>
          </button>

          {!user ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenAuth('login')}
                className="rounded-full bg-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 transition whitespace-nowrap"
              >
                Login
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="rounded-full bg-[#0d8b96] px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-110 transition whitespace-nowrap"
              >
                Signup
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenMenu('wallet')}
                className="flex items-center gap-1.5 rounded-full bg-[#10243d] border border-white/20 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white tabular-nums"
              >
                <Wallet className="h-3.5 w-3.5 text-cyan-300" />
                <span>₹{user.balance.toFixed(2)}</span>
              </button>
              <button
                onClick={() => onOpenMenu('deposit')}
                className="rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 whitespace-nowrap"
              >
                + Deposit
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-6 pt-4 space-y-5">
        {/* Promo Banners */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative h-40 sm:h-48 overflow-hidden rounded-2xl border border-white/10 bg-[#0d182d]">
            <img
              src="/src/assets/images/banner_joining_bonus_1795001639122.jpg"
              alt="24x7 Support and Automatic Withdrawal"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">24×7 Live Support</div>
                <div className="text-sm sm:text-base font-semibold text-cyan-300">
                  Automatic Withdrawal &amp; Auto Deposit
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenSupport}
                  className="w-fit rounded-full bg-white px-5 py-2 text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
                >
                  24×7 Support
                </button>
                <button
                  onClick={() => (user ? onOpenMenu('withdraw') : onOpenAuth('login'))}
                  className="w-fit rounded-full bg-cyan-400/90 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
                >
                  Auto Withdraw
                </button>
              </div>
            </div>
          </div>

          <div className="relative h-40 sm:h-48 overflow-hidden rounded-2xl border border-white/10 bg-[#0d182d]">
            <img
              src="/src/assets/images/banner_affiliate_1795001640309.jpg"
              alt="Join Our Affiliate Program"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="text-base sm:text-lg font-bold text-white">
                  Join Our Affiliate Program
                </div>
                <div className="mt-1 text-xs font-medium text-slate-200">
                  Earn daily commission on referrals
                </div>
              </div>
              <button
                onClick={() => (user ? onOpenMenu('affiliate') : onOpenAuth('signup'))}
                className="w-fit rounded-full bg-white px-5 py-2 text-xs font-bold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
              >
                Join Now
              </button>
            </div>
          </div>
        </section>

        {/* Continuous Running Ad Strip (AD78 · 24x7 Support · Automatic Withdrawal) */}
        <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0d1b33] py-2">
          <div className="ad-marquee-track items-center gap-8 text-xs font-semibold text-cyan-200 whitespace-nowrap">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-8 px-4">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <Megaphone className="h-3.5 w-3.5 text-cyan-400" />
                  <strong>AD78 OFFICIAL</strong>
                </span>
                <span className="text-cyan-300">24×7 Live Support Available</span>
                <span className="text-emerald-300">Automatic Withdrawal · Fast Payout</span>
                <span className="text-amber-300">UPI &amp; Bank Deposit Active</span>
                <span className="text-slate-200">WinGo 30s · 1m · 3m &amp; Aviator Live</span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Live Update Notice (only shown when set by Admin Panel) */}
        {platformConfig?.noticeText && platformConfig.noticeText.trim().length > 0 && (
          <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-200">
            {platformConfig.noticeText}
          </div>
        )}

        {/* GAMES SECTION: User taps directly on WINGO or AVIATOR card to play */}
        <section id="live-games" className="space-y-3 scroll-mt-16">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">AD78 Games</h2>
              <div className="mt-0.5 h-0.5 w-14 bg-cyan-400" />
            </div>
            <span className="text-xs font-semibold text-slate-300">
              Tap a game to play
            </span>
          </div>

          {/* Side-by-Side Game Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* WINGO Card */}
            <button
              onClick={onOpenWingo}
              className="group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-b from-orange-500 to-red-600 text-left shadow-lg transition hover:scale-[1.01] active:scale-[0.98]"
            >
              <img
                src="/src/assets/images/card_wingo_hero_1795001641085.jpg"
                alt="WINGO Color Prediction"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>30s · 1m · 3m</span>
                  <span>Min ₹1</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    WINGO
                  </div>
                  <div className="text-[11px] font-medium text-emerald-300">
                    Color Prediction
                  </div>
                </div>
              </div>
            </button>

            {/* AVIATOR Card */}
            <button
              onClick={onOpenAviator}
              className="group relative h-36 sm:h-44 overflow-hidden rounded-2xl border border-rose-500/60 bg-gradient-to-b from-slate-900 to-rose-950 text-left shadow-lg transition hover:scale-[1.01] active:scale-[0.98]"
            >
              <img
                src="/src/assets/images/card_aviator_hero_1795003906832.jpg"
                alt="AD78 Aviator Crash Game"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3 sm:p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-white">
                  <span>
                    {aviator?.phase === 'flying'
                      ? `${aviator.multiplier.toFixed(2)}x`
                      : aviator?.phase === 'crashed'
                      ? 'Crashed'
                      : `${aviator?.countdownSec ?? 5}s`}
                  </span>
                  <span>Min ₹10</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white">
                    AVIATOR
                  </div>
                  <div className="text-[11px] font-medium text-rose-300">
                    Live Multiplier Crash
                  </div>
                </div>
              </div>
            </button>
          </div>
        </section>
      </main>

      {/* Clean 3-Tab Bottom Bar (Games icon removed — tap game card above to play) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-3 items-center bg-[#091224]/95 backdrop-blur-md border-t border-white/10">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center justify-center h-full text-cyan-400"
        >
          <Home className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">Home</span>
        </button>
        <button
          onClick={() => (user ? onOpenMenu('wallet') : onOpenAuth('login'))}
          className="flex flex-col items-center justify-center h-full text-slate-300 hover:text-white"
        >
          <Wallet className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">Wallet</span>
        </button>
        <button
          onClick={() => onOpenMenu('menu')}
          className="flex flex-col items-center justify-center h-full text-slate-300 hover:text-white"
        >
          <User className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold">Account</span>
        </button>
      </nav>
    </div>
  );
};
