import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Headphones,
  ShieldAlert,
  TrendingUp,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { AviatorPhase, AviatorState, BetRecord, UserProfile } from '../types';
import {
  playAviatorCashout,
  playAviatorCrash,
  playAviatorTakeoff,
  playBetConfirm,
  setSoundMuted,
  startAviatorFlightLoop,
  stopAviatorFlightLoop,
  updateAviatorFlightPitch,
} from '../utils/sound';
import { AVIATOR_MAX_BET, AVIATOR_MIN_BET } from '../utils/validation';

interface AviatorGameProps {
  user: UserProfile | null;
  token: string | null;
  aviator: AviatorState | null;
  myBets: BetRecord[];
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenDeposit: () => void;
  onOpenSupport: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onBetPlaced: (bet: BetRecord) => void;
  onCashoutSuccess: (payload: {
    multiplier: number;
    payout: number;
    staked: number;
    balance: number;
    roundId: string;
  }) => void;
}

const PRESETS = [10, 50, 100, 500];

export const AviatorGame: React.FC<AviatorGameProps> = ({
  user,
  token,
  aviator,
  myBets,
  onBack,
  onRequireAuth,
  onOpenDeposit,
  onOpenSupport,
  onBalanceUpdate,
  onBetPlaced,
  onCashoutSuccess,
}) => {
  const [betAmount, setBetAmount] = useState<string>('10');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Smooth 60fps interpolated multiplier for silky flight trajectory
  const phase: AviatorPhase = aviator?.phase || 'betting';
  const serverMult = aviator?.multiplier ?? 1.0;
  const roundId = aviator?.roundId || '';

  const [smoothMult, setSmoothMult] = useState<number>(serverMult);
  const smoothRef = useRef<number>(serverMult);

  useEffect(() => {
    if (phase !== 'flying') {
      smoothRef.current = serverMult;
      setSmoothMult(serverMult);
      return;
    }
    let raf = 0;
    const target = serverMult;
    const tickAnim = () => {
      const curr = smoothRef.current;
      const next = curr + (target - curr) * 0.35;
      smoothRef.current = next;
      setSmoothMult(next);
      if (Math.abs(target - next) > 0.002) {
        raf = requestAnimationFrame(tickAnim);
      } else {
        smoothRef.current = target;
        setSmoothMult(target);
      }
    };
    raf = requestAnimationFrame(tickAnim);
    return () => cancelAnimationFrame(raf);
  }, [serverMult, phase]);

  // Smooth right-corner balance animation
  const targetBalance = user?.balance ?? 0;
  const [displayBalance, setDisplayBalance] = useState<number>(targetBalance);
  const displayBalRef = useRef<number>(targetBalance);

  useEffect(() => {
    const startVal = displayBalRef.current;
    const endVal = targetBalance;
    if (Math.abs(endVal - startVal) < 0.01) {
      displayBalRef.current = endVal;
      setDisplayBalance(endVal);
      return;
    }
    const duration = 500;
    const startTime = performance.now();
    let rafId = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startVal + (endVal - startVal) * eased;
      displayBalRef.current = current;
      setDisplayBalance(current);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        displayBalRef.current = endVal;
        setDisplayBalance(endVal);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [targetBalance]);

  // Trigger real Aviator flight sound & crash sound transitions
  const prevPhaseRef = useRef<AviatorPhase | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== phase) {
      prevPhaseRef.current = phase;
      if (!muted) {
        if (phase === 'flying') {
          playAviatorTakeoff();
          startAviatorFlightLoop(serverMult);
        } else if (phase === 'crashed') {
          playAviatorCrash();
        } else if (phase === 'betting') {
          stopAviatorFlightLoop();
        }
      } else {
        stopAviatorFlightLoop();
      }
    } else if (phase === 'flying' && !muted) {
      updateAviatorFlightPitch(serverMult);
    }
  }, [phase, serverMult, muted]);

  useEffect(() => {
    return () => {
      stopAviatorFlightLoop();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (next) {
      stopAviatorFlightLoop();
    } else if (phase === 'flying') {
      startAviatorFlightLoop(serverMult);
    }
  };

  const activeRoundBet = useMemo(
    () =>
      myBets.find(
        (b) =>
          b.game === 'aviator' &&
          b.periodId === roundId &&
          b.status === 'pending'
      ) || null,
    [myBets, roundId]
  );

  // Flight progress along parabolic climb curve (0..1)
  const progress = useMemo(() => {
    if (phase === 'betting') return 0;
    return Math.min(1, Math.log(Math.max(1, smoothMult)) / Math.log(5.5));
  }, [phase, smoothMult]);

  const planeX = 28 + progress * 252;
  const planeY = 148 - Math.pow(progress, 0.82) * 112;

  const handlePlaceBet = async () => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (phase !== 'betting') {
      setFeedback({ type: 'err', text: 'Wait for next takeoff countdown to place your bet.' });
      return;
    }
    const amt = Number(betAmount);
    if (!Number.isFinite(amt) || amt < AVIATOR_MIN_BET || amt > AVIATOR_MAX_BET) {
      setFeedback({
        type: 'err',
        text: `Aviator bet must be between ₹${AVIATOR_MIN_BET} and ₹${AVIATOR_MAX_BET}.`,
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/aviator/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: Math.round(amt) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place bet');
      playBetConfirm();
      onBalanceUpdate(data.balance);
      onBetPlaced(data.bet);
      setFeedback({
        type: 'ok',
        text: `Bet ₹${Math.round(amt)} locked for flight ${roundId}!`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bet failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (!user || !token || !activeRoundBet) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/aviator/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cashout failed');
      playAviatorCashout();
      onBalanceUpdate(data.balance);
      onCashoutSuccess({
        multiplier: data.multiplier,
        payout: data.payout,
        staked: activeRoundBet.amount,
        balance: data.balance,
        roundId,
      });
      setFeedback({
        type: 'ok',
        text: `Cashed out @ ${data.multiplier.toFixed(2)}x (+₹${data.payout.toFixed(2)})`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Cashout failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const myAviatorBets = myBets.filter((b) => b.game === 'aviator');
  const history = aviator?.history || [];
  const parsedAmt = Math.max(0, Number(betAmount) || 0);

  return (
    <div className="min-h-screen bg-[#090d1f] text-white pb-20">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f1632]/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <button
          onClick={() => {
            stopAviatorFlightLoop();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold text-white transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSupport}
            aria-label="24x7 Support"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-cyan-300 hover:bg-white/20"
            title="24x7 Support"
          >
            <Headphones className="h-4 w-4" />
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute flight sound' : 'Mute flight sound'}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-cyan-300" />}
          </button>
          {user ? (
            <button
              onClick={onOpenDeposit}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-2.5 py-2 text-xs font-semibold text-white tabular-nums"
            >
              <Wallet className="h-3.5 w-3.5 text-cyan-300" />
              <span>₹{displayBalance.toFixed(2)}</span>
            </button>
          ) : (
            <button
              onClick={onRequireAuth}
              className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-3 sm:px-4 pt-3 space-y-4">
        {/* Recent Multipliers Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-[#101836] border border-white/10 px-3 py-2">
          <TrendingUp className="h-4 w-4 text-slate-400 shrink-0 mr-1" />
          {history.length === 0 ? (
            <span className="text-xs text-slate-400">Loading flight history...</span>
          ) : (
            history.slice(0, 14).map((item, idx) => (
              <span
                key={`${item.roundId}-${idx}`}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0 ${
                  item.crashPoint >= 2.0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : item.crashPoint >= 1.5
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}
              >
                {item.crashPoint.toFixed(2)}x
              </span>
            ))
          )}
        </div>

        {/* Authentic Aviator Radar Stage */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#131936] via-[#0c1129] to-[#080c1c] p-3.5 shadow-2xl">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span>Round: {roundId || 'Syncing...'}</span>
            <span className="font-semibold text-white">
              {phase === 'betting'
                ? 'Takeoff Soon'
                : phase === 'flying'
                ? `${smoothMult.toFixed(2)}x`
                : 'Flew Away'}
            </span>
          </div>

          <div className="relative h-60 w-full rounded-xl bg-[#070a18] border border-white/5 overflow-hidden">
            {/* Rotating subtle sunburst backdrop rays */}
            <div
              className="pointer-events-none absolute -bottom-44 -left-44 h-[480px] w-[480px] opacity-20"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.08) 0deg 10deg, transparent 10deg 26deg)',
              }}
            />

            {/* Ambient radial glow */}
            <div
              className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-45 blur-3xl transition-colors duration-300"
              style={{
                background:
                  phase === 'crashed'
                    ? 'radial-gradient(circle, rgba(244,63,94,0.65) 0%, transparent 70%)'
                    : phase === 'flying'
                    ? 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%)',
              }}
            />

            {/* Coordinate axes */}
            <div className="pointer-events-none absolute left-3 top-3 bottom-5 flex flex-col justify-between text-[9px] text-slate-500 tabular-nums">
              <span>5.0x</span>
              <span>3.0x</span>
              <span>2.0x</span>
              <span>1.0x</span>
            </div>

            {/* Runway line */}
            <div className="pointer-events-none absolute left-7 right-3 bottom-4 h-[1px] bg-white/10" />

            {/* Trajectory Curve SVG */}
            <svg
              viewBox="0 0 320 170"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                <linearGradient id="aviatorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.52" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {phase === 'flying' && (
                <>
                  <path
                    d={`M 28 148 Q ${(28 + planeX) / 2} 148 ${planeX} ${planeY} L ${planeX} 152 L 28 152 Z`}
                    fill="url(#aviatorAreaGrad)"
                  />
                  <path
                    d={`M 28 148 Q ${(28 + planeX) / 2} 148 ${planeX} ${planeY}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>

            {/* Custom Red Vintage Monoplane SVG flying along the curve */}
            {phase === 'flying' && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(planeX / 320) * 100}%`,
                  top: `${(planeY / 170) * 100}%`,
                }}
              >
                <svg
                  width="56"
                  height="34"
                  viewBox="0 0 64 38"
                  className="-rotate-12 drop-shadow-[0_4px_14px_rgba(239,68,68,0.65)]"
                >
                  {/* Exhaust trail */}
                  <path d="M2 22 L12 19 L12 24 Z" fill="#fca5a5" opacity="0.7" />
                  {/* Tail fin */}
                  <path d="M12 19 L8 9 L16 11 L22 18 Z" fill="#dc2626" />
                  {/* Fuselage */}
                  <path
                    d="M12 18 Q28 13 48 16 L54 19 L48 24 Q28 26 12 22 Z"
                    fill="#ef4444"
                    stroke="#fecaca"
                    strokeWidth="0.8"
                  />
                  {/* Upper wing */}
                  <path d="M26 15 L38 7 L43 9 L35 16 Z" fill="#b91c1c" />
                  {/* Cockpit windshield */}
                  <path d="M31 15 Q35 12 39 15 Z" fill="#e0f2fe" />
                  {/* Spinning nose propeller */}
                  <ellipse cx="55" cy="19.5" rx="2" ry="9" fill="#f8fafc" opacity="0.85" />
                  <circle cx="54" cy="19.5" r="2.2" fill="#fbbf24" />
                </svg>
              </div>
            )}

            {/* Center Multiplier / Countdown Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {phase === 'betting' && (
                <div className="text-center space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Waiting For Next Flight
                  </div>
                  <div className="text-5xl font-bold text-white tabular-nums">
                    {aviator?.countdownSec ?? 0}s
                  </div>
                  <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, ((aviator?.countdownSec ?? 0) / 6) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {phase === 'flying' && (
                <div className="text-center">
                  <div className="text-5xl sm:text-6xl font-bold text-white tabular-nums drop-shadow-lg">
                    {smoothMult.toFixed(2)}x
                  </div>
                </div>
              )}

              {phase === 'crashed' && (
                <div className="text-center space-y-1">
                  <div className="text-sm font-bold uppercase tracking-wider text-rose-400">
                    FLEW AWAY!
                  </div>
                  <div className="text-5xl font-bold text-rose-500 tabular-nums">
                    {(aviator?.crashPoint ?? serverMult).toFixed(2)}x
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold border ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Bet & Cashout Panel */}
        <div className="rounded-2xl bg-[#101836] border border-white/10 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Bet Amount (Min ₹{AVIATOR_MIN_BET} · Max ₹50,000)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">
                  ₹
                </span>
                <input
                  type="number"
                  min={AVIATOR_MIN_BET}
                  max={AVIATOR_MAX_BET}
                  value={betAmount}
                  disabled={Boolean(activeRoundBet) || phase === 'flying'}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full rounded-xl bg-[#070b1e] border border-white/15 pl-7 pr-3 py-2.5 text-base font-semibold text-white focus:outline-none focus:border-cyan-400 disabled:opacity-60"
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {PRESETS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={Boolean(activeRoundBet) || phase === 'flying'}
                    onClick={() => setBetAmount(String(amt))}
                    className="rounded-lg bg-white/10 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              {activeRoundBet && phase === 'flying' ? (
                <button
                  onClick={handleCashout}
                  disabled={busy}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 px-4 text-center shadow-xl hover:brightness-110 active:scale-[0.98] transition"
                >
                  <div className="text-xs font-bold uppercase text-slate-950">CASH OUT NOW</div>
                  <div className="text-xl font-bold text-slate-950 tabular-nums">
                    ₹{(activeRoundBet.amount * serverMult).toFixed(2)} ({serverMult.toFixed(2)}x)
                  </div>
                </button>
              ) : activeRoundBet && phase === 'betting' ? (
                <div className="w-full rounded-2xl bg-emerald-500/20 border border-emerald-400/40 py-4 px-4 text-center">
                  <div className="text-sm font-bold text-emerald-300">
                    BET PLACED · ₹{activeRoundBet.amount}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Get ready to Cash Out after takeoff!
                  </div>
                </div>
              ) : (
                <button
                  onClick={handlePlaceBet}
                  disabled={
                    busy ||
                    phase !== 'betting' ||
                    parsedAmt < AVIATOR_MIN_BET ||
                    parsedAmt > AVIATOR_MAX_BET
                  }
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 px-4 text-center shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition"
                >
                  <div className="text-base font-bold text-white">
                    {phase === 'betting'
                      ? busy
                        ? 'Placing...'
                        : `PLACE BET ₹${parsedAmt}`
                      : 'WAIT FOR NEXT ROUND'}
                  </div>
                </button>
              )}

              {parsedAmt > 0 && parsedAmt < AVIATOR_MIN_BET && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Minimum Aviator bet is ₹10.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* My Aviator Bets */}
        <div className="rounded-2xl bg-[#101836] border border-white/10 overflow-hidden">
          <div className="border-b border-white/10 bg-[#0b1129] px-4 py-3 text-sm font-bold text-white">
            My Aviator Bets
          </div>
          {!user ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Sign in to view your Aviator flight history.
            </div>
          ) : myAviatorBets.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No Aviator flights played yet.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {myAviatorBets.slice(0, 10).map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3 text-xs">
                  <div>
                    <div className="font-bold text-white">
                      {b.selection} · <span className="text-slate-400">{b.periodId}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Stake ₹{b.amount} {b.resultText ? `· ${b.resultText}` : ''}
                    </div>
                  </div>
                  <div className="text-right font-bold tabular-nums">
                    {b.status === 'pending' && <span className="text-amber-400">In Flight</span>}
                    {b.status === 'won' && (
                      <span className="text-emerald-400">+₹{b.payout.toFixed(2)}</span>
                    )}
                    {b.status === 'lost' && (
                      <span className="text-rose-400">-₹{b.amount.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
