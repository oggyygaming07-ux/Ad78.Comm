import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  ShieldAlert,
  Shuffle,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { BetRecord, UserProfile, WingoMode, WingoModeClock } from '../types';
import {
  playBetConfirm,
  playCountdownTick,
  playResultRing,
  setSoundMuted,
} from '../utils/sound';
import { WINGO_MAX_BET, WINGO_MIN_BET } from '../utils/validation';

interface WingoGameProps {
  user: UserProfile | null;
  token: string | null;
  clocks: Record<WingoMode, WingoModeClock> | null;
  myBets: BetRecord[];
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenDeposit: () => void;
  onOpenSupport: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onBetPlaced: (bet: BetRecord) => void;
}

const MODE_LABELS: { id: WingoMode; title: string }[] = [
  { id: '30s', title: 'WinGo 30 Sec' },
  { id: '1m', title: 'WinGo 1 Min' },
  { id: '3m', title: 'WinGo 3 Min' },
];

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];

function getBallOuterStyle(num: number): React.CSSProperties {
  if (num === 0) {
    return {
      background:
        'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.45) 0%, transparent 40%), linear-gradient(135deg, #f43f5e 0%, #e11d48 49%, #9333ea 51%, #6b21a8 100%)',
    };
  }
  if (num === 5) {
    return {
      background:
        'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.45) 0%, transparent 40%), linear-gradient(135deg, #34d399 0%, #16a34a 49%, #9333ea 51%, #6b21a8 100%)',
    };
  }
  if (num % 2 === 1) {
    return {
      background: 'radial-gradient(circle at 30% 25%, #86efac 0%, #22c55e 42%, #15803d 100%)',
    };
  }
  return {
    background: 'radial-gradient(circle at 30% 25%, #fda4af 0%, #ef4444 42%, #b91c1c 100%)',
  };
}

function getBallTextColor(num: number): string {
  if (num === 0 || num === 5) return 'text-purple-700';
  if (num % 2 === 1) return 'text-emerald-700';
  return 'text-rose-600';
}

export const WingoGame: React.FC<WingoGameProps> = ({
  user,
  token,
  clocks,
  myBets,
  onBack,
  onRequireAuth,
  onOpenDeposit,
  onOpenSupport,
  onBalanceUpdate,
  onBetPlaced,
}) => {
  const [activeMode, setActiveMode] = useState<WingoMode>('1m');
  const [muted, setMuted] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [historyTab, setHistoryTab] = useState<'game' | 'chart' | 'my'>('game');

  const [selectedBet, setSelectedBet] = useState<{
    selectionType: 'color' | 'size' | 'number';
    selection: string;
    label: string;
    theme: string;
  } | null>(null);
  const [baseAmount, setBaseAmount] = useState<string>('10');
  const [multiplier, setMultiplier] = useState<number>(1);
  const [placing, setPlacing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

    const duration = 550;
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

  const currentClock = clocks?.[activeMode] || null;
  const secondsRemaining = currentClock?.secondsRemaining ?? 0;
  const isLocked = currentClock ? currentClock.isLocked : false;
  const lastTickKeyRef = useRef<string>('');
  const lastPeriodRef = useRef<string>('');

  // Final 5-second crisp countdown ticks + Ring sound when new period result arrives
  useEffect(() => {
    if (!currentClock) return;

    if (lastPeriodRef.current && lastPeriodRef.current !== currentClock.periodId) {
      if (!muted) playResultRing();
    }
    lastPeriodRef.current = currentClock.periodId;

    if (!muted && currentClock.secondsRemaining > 0 && currentClock.secondsRemaining <= 5) {
      const key = `${currentClock.periodId}:${currentClock.secondsRemaining}`;
      if (lastTickKeyRef.current !== key) {
        lastTickKeyRef.current = key;
        playCountdownTick(currentClock.secondsRemaining);
      }
    }
  }, [currentClock, muted]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const formattedClock = useMemo(() => {
    const sec = Math.max(0, secondsRemaining);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return [mm[0], mm[1], ss[0], ss[1]];
  }, [secondsRemaining]);

  const countdownDigits = useMemo(() => {
    const sec = Math.max(0, Math.min(5, secondsRemaining));
    return ['0', String(sec)];
  }, [secondsRemaining]);

  const parsedBase = Math.max(0, Number(baseAmount) || 0);
  const totalBetAmount = Math.min(WINGO_MAX_BET, Math.round(parsedBase * multiplier));

  const openSlip = (
    selectionType: 'color' | 'size' | 'number',
    selection: string,
    label: string,
    theme: string
  ) => {
    if (isLocked) {
      setFeedback({ type: 'err', text: 'Wait for next round. Countdown ending.' });
      return;
    }
    setFeedback(null);
    setSelectedBet({ selectionType, selection, label, theme });
  };

  const handleRandomPick = () => {
    if (isLocked) return;
    const num = Math.floor(Math.random() * 10);
    openSlip(
      'number',
      String(num),
      `Number ${num}`,
      num === 0 || num === 5
        ? 'from-purple-600 to-indigo-600'
        : num % 2 === 1
        ? 'from-emerald-600 to-green-700'
        : 'from-rose-600 to-red-700'
    );
  };

  const handlePlaceBet = async () => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (!selectedBet) return;
    if (isLocked) {
      setFeedback({ type: 'err', text: 'Wait for next round. Countdown ending.' });
      return;
    }

    const rawTotal = parsedBase * multiplier;
    if (!Number.isFinite(rawTotal) || rawTotal < WINGO_MIN_BET || rawTotal > WINGO_MAX_BET) {
      setFeedback({
        type: 'err',
        text: `Bet amount must be between ₹${WINGO_MIN_BET} and ₹${WINGO_MAX_BET}.`,
      });
      return;
    }

    setPlacing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wingo/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: activeMode,
          selectionType: selectedBet.selectionType,
          selection: selectedBet.selection,
          amount: Math.round(rawTotal),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not place bet');
      playBetConfirm();
      onBalanceUpdate(data.balance);
      onBetPlaced(data.bet);
      setFeedback({
        type: 'ok',
        text: `Placed ₹${Math.round(rawTotal)} on ${selectedBet.label} (Period ${currentClock?.periodId.slice(-5)})`,
      });
      setSelectedBet(null);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bet failed',
      });
    } finally {
      setPlacing(false);
    }
  };

  const history = currentClock?.history || [];
  const lastFive = history.slice(0, 5);
  const lastTenHistory = history.slice(0, 10);
  const myWingoBets = myBets.filter((b) => b.game === 'wingo' && b.mode === activeMode);
  const stakeChips = user?.stakePresets?.length ? user.stakePresets : [1, 10, 50, 100];

  return (
    <div className="min-h-screen bg-[#0a0e29] text-white pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f1733]/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
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
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
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

      <div className="mx-auto max-w-2xl px-3 pt-3 space-y-3.5">
        {/* Mode Switcher: 30s, 1m, 3m */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#11173b] p-1.5 border border-white/10 shadow-inner">
          {MODE_LABELS.map((m) => {
            const active = activeMode === m.id;
            const clock = clocks?.[m.id];
            return (
              <button
                key={m.id}
                onClick={() => {
                  setActiveMode(m.id);
                  setSelectedBet(null);
                  setFeedback(null);
                }}
                className={`flex flex-col items-center justify-center rounded-xl py-2 px-2 transition ${
                  active
                    ? 'bg-gradient-to-b from-[#6ef5cf] to-[#2dd4bf] text-slate-950 shadow-lg'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold whitespace-nowrap">{m.title}</span>
                <span
                  className={`mt-0.5 text-[11px] font-semibold tabular-nums ${
                    active ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  {clock ? `${String(clock.secondsRemaining).padStart(2, '0')}s` : '--'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Authentic WinGo Mint/Cyan Ticket Card */}
        <div className="relative rounded-2xl bg-gradient-to-r from-[#5bf0ca] via-[#4ee5cd] to-[#34d2d4] px-3.5 py-3 text-slate-950 shadow-xl">
          {/* Top & bottom ticket cutouts */}
          <div className="pointer-events-none absolute left-1/2 -top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-[#0a0e29]" />
          <div className="pointer-events-none absolute left-1/2 -bottom-2 h-4 w-4 -translate-x-1/2 rounded-full bg-[#0a0e29]" />

          <div className="grid grid-cols-2 items-center">
            {/* Left Half: How to play + Mode + 5 recent balls */}
            <div className="border-r border-dashed border-slate-900/35 pr-2.5 space-y-2">
              <button
                onClick={() => setShowRules(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-900/50 bg-transparent px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-white/25 transition"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>How to play</span>
              </button>

              <div className="text-xs font-semibold text-slate-950">
                WinGo {activeMode === '30s' ? '30 Sec' : activeMode === '1m' ? '1 Min' : '3 Min'}
              </div>

              <div className="flex items-center gap-1.5">
                {lastFive.map((r) => (
                  <div
                    key={r.periodId}
                    style={getBallOuterStyle(r.number)}
                    className="flex h-7 w-7 items-center justify-center rounded-full shadow-md"
                  >
                    <span
                      className={`flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-[11px] font-bold ${getBallTextColor(
                        r.number
                      )}`}
                    >
                      {r.number}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Half: Time remaining + Flip Digits + Current IST Date Period ID */}
            <div className="pl-2.5 flex flex-col items-end justify-center text-right">
              <div className="text-xs font-bold text-slate-950">Time remaining</div>
              <div className="mt-1 flex items-center gap-1 text-xl font-bold tabular-nums">
                <span className="flex h-9 w-6 items-center justify-center rounded bg-[#0c1438] text-white shadow">
                  {formattedClock[0]}
                </span>
                <span className="flex h-9 w-6 items-center justify-center rounded bg-[#0c1438] text-white shadow">
                  {formattedClock[1]}
                </span>
                <span className="px-0.5 text-xl font-bold text-[#0c1438]">:</span>
                <span className="flex h-9 w-6 items-center justify-center rounded bg-[#0c1438] text-white shadow">
                  {formattedClock[2]}
                </span>
                <span className="flex h-9 w-6 items-center justify-center rounded bg-[#0c1438] text-white shadow">
                  {formattedClock[3]}
                </span>
              </div>
              <div className="mt-1.5 text-xs sm:text-sm font-bold text-slate-950 tabular-nums tracking-tight">
                {currentClock?.periodId || 'Loading...'}
              </div>
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

        {/* Real WinGo Interactive Betting Board */}
        <div className="relative rounded-2xl bg-[#11173b] p-3.5 border border-white/10 space-y-3.5 shadow-xl">
          {/* Last 5 Seconds Clean Twin Flip Countdown Overlay (NO alarm wording) */}
          {isLocked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[#070b1d]/75 backdrop-blur-[2px]">
              <div className="flex items-center gap-4">
                {countdownDigits.map((digit, idx) => (
                  <div
                    key={idx}
                    className="relative flex h-28 w-22 sm:h-32 sm:w-26 items-center justify-center rounded-2xl bg-gradient-to-b from-[#232f66] to-[#131a40] border border-cyan-400/35 shadow-2xl"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[1.5px] bg-black/40" />
                    <span className="text-6xl sm:text-7xl font-bold text-[#61f3cd] tabular-nums">
                      {digit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Green / Violet / Red Tabs */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => openSlip('color', 'green', 'Green (2x)', 'from-emerald-500 to-green-600')}
              className="rounded-tl-md rounded-tr-2xl rounded-bl-2xl rounded-br-md bg-gradient-to-b from-[#29b864] to-[#1f934f] py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition"
            >
              Green
            </button>
            <button
              onClick={() => openSlip('color', 'violet', 'Violet (4.5x)', 'from-purple-500 to-violet-700')}
              className="rounded-lg bg-gradient-to-b from-[#a55cff] to-[#8338ec] py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition"
            >
              Violet
            </button>
            <button
              onClick={() => openSlip('color', 'red', 'Red (2x)', 'from-rose-500 to-red-600')}
              className="rounded-tl-2xl rounded-tr-md rounded-bl-md rounded-br-2xl bg-gradient-to-b from-[#ef4444] to-[#cc2929] py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition"
            >
              Red
            </button>
          </div>

          {/* 0-9 3D Lottery Balls Grid */}
          <div className="rounded-2xl bg-[#090e2b] p-3 border border-white/5 shadow-inner">
            <div className="grid grid-cols-5 gap-2.5 place-items-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() =>
                    openSlip(
                      'number',
                      String(num),
                      `Number ${num} (9x)`,
                      num === 0 || num === 5
                        ? 'from-purple-600 to-indigo-700'
                        : num % 2 === 1
                        ? 'from-emerald-500 to-green-700'
                        : 'from-rose-500 to-red-700'
                    )
                  }
                  style={getBallOuterStyle(num)}
                  className="relative flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95 overflow-hidden ring-1 ring-white/15"
                >
                  <span className="pointer-events-none absolute -left-1.5 top-1/2 h-3 w-2 -translate-y-1/2 rounded-full bg-white/85" />
                  <span className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-2 -translate-y-1/2 rounded-full bg-white/85" />
                  <span
                    className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/95 text-lg font-bold shadow-inner ${getBallTextColor(
                      num
                    )}`}
                  >
                    {num}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Random & Multiplier Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={handleRandomPick}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/80 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-rose-400 shrink-0 hover:bg-rose-500/15"
            >
              <Shuffle className="h-3 w-3" />
              <span>Random</span>
            </button>
            {MULTIPLIERS.map((m) => (
              <button
                key={m}
                onClick={() => setMultiplier(m)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0 transition ${
                  multiplier === m
                    ? 'bg-[#23a75a] text-white shadow'
                    : 'bg-[#090e2b] text-slate-200 border border-white/10 hover:bg-white/10'
                }`}
              >
                X{m}
              </button>
            ))}
          </div>

          {/* Big / Small Split Capsule Bar */}
          <div className="grid grid-cols-2 overflow-hidden rounded-full shadow-lg">
            <button
              onClick={() => openSlip('size', 'big', 'Big 5-9 (2x)', 'from-amber-500 to-orange-500')}
              className="bg-gradient-to-b from-[#f5a642] to-[#e08a24] py-3 text-base font-semibold text-white hover:brightness-110 active:scale-[0.99] transition"
            >
              Big
            </button>
            <button
              onClick={() => openSlip('size', 'small', 'Small 0-4 (2x)', 'from-sky-500 to-blue-600')}
              className="bg-gradient-to-b from-[#66a3f0] to-[#4a83cf] py-3 text-base font-semibold text-white hover:brightness-110 active:scale-[0.99] transition"
            >
              Small
            </button>
          </div>
        </div>

        {/* Manual Bet Slip */}
        {selectedBet && (
          <div className="rounded-2xl border border-cyan-400/50 bg-[#0e1938] p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-lg bg-gradient-to-r ${selectedBet.theme} px-3 py-1 text-xs font-bold text-white`}
                >
                  {selectedBet.label}
                </span>
                <span className="text-xs text-slate-300">
                  Period {currentClock?.periodId.slice(-5)}
                </span>
              </div>
              <button
                onClick={() => setSelectedBet(null)}
                className="text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold text-white">
                  Manual Bet Amount (₹1 – ₹5,000)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-white">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    className="w-full rounded-xl bg-[#070d20] border border-white/15 pl-7 pr-3 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {stakeChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setBaseAmount(String(chip));
                        setMultiplier(1);
                      }}
                      className="flex-1 rounded-lg bg-white/10 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500/20"
                    >
                      ₹{chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-slate-200 px-1">
                  <span>Total Bet (with X{multiplier})</span>
                  <span className="text-base font-bold text-white tabular-nums">
                    ₹{Math.round(parsedBase * multiplier)}
                  </span>
                </div>
                {parsedBase * multiplier > WINGO_MAX_BET && (
                  <div className="flex items-center gap-1 text-[11px] text-rose-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Max WinGo bet is ₹5,000 per wager.</span>
                  </div>
                )}
                <button
                  onClick={handlePlaceBet}
                  disabled={
                    placing ||
                    isLocked ||
                    parsedBase * multiplier < WINGO_MIN_BET ||
                    parsedBase * multiplier > WINGO_MAX_BET
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 py-3 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition"
                >
                  {placing ? 'Placing Bet...' : `Confirm Bet ₹${totalBetAmount}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Tabs: Strictly Last 10 Results */}
        <div className="rounded-2xl bg-[#11173b] border border-white/10 overflow-hidden shadow-lg">
          <div className="grid grid-cols-3 border-b border-white/10 bg-[#0b122b]">
            <button
              onClick={() => setHistoryTab('game')}
              className={`py-3 text-xs sm:text-sm font-bold transition ${
                historyTab === 'game'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Game History
            </button>
            <button
              onClick={() => setHistoryTab('chart')}
              className={`py-3 text-xs sm:text-sm font-bold transition ${
                historyTab === 'chart'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Pattern Chart
            </button>
            <button
              onClick={() => setHistoryTab('my')}
              className={`py-3 text-xs sm:text-sm font-bold transition ${
                historyTab === 'my'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              My History
            </button>
          </div>

          {historyTab === 'game' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0e1633] text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Period</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Number</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Big / Small</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Color</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lastTenHistory.map((row) => (
                    <tr key={row.periodId} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-white tabular-nums">{row.periodId}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`text-lg font-bold ${
                            row.colors.includes('green') ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {row.number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold uppercase text-white">
                        {row.size}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.colors.map((c) => (
                            <span
                              key={c}
                              className={`h-3.5 w-3.5 rounded-full ${
                                c === 'green'
                                  ? 'bg-emerald-500'
                                  : c === 'red'
                                  ? 'bg-rose-500'
                                  : 'bg-purple-500'
                              }`}
                              title={c}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {historyTab === 'chart' && (
            <div className="p-3 sm:p-4 space-y-2 overflow-x-auto">
              <div className="text-xs text-slate-300 mb-2">
                Last 10 Results Pattern Grid (0–9)
              </div>
              {lastTenHistory.map((row) => (
                <div
                  key={row.periodId}
                  className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5 text-[11px]"
                >
                  <span className="text-slate-300 shrink-0 tabular-nums">
                    {row.periodId.slice(-6)}
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                      const hit = row.number === n;
                      return (
                        <span
                          key={n}
                          style={hit ? getBallOuterStyle(n) : undefined}
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                            hit ? 'text-white shadow' : 'border border-white/10 text-slate-500'
                          }`}
                        >
                          {n}
                        </span>
                      );
                    })}
                  </div>
                  <span
                    className={`w-6 text-center font-bold uppercase ${
                      row.size === 'big' ? 'text-amber-400' : 'text-sky-400'
                    }`}
                  >
                    {row.size === 'big' ? 'B' : 'S'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {historyTab === 'my' && (
            <div className="p-3">
              {!user ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Please sign in to view your WinGo betting history.
                </div>
              ) : myWingoBets.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No bets placed in WinGo {activeMode} yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {myWingoBets.slice(0, 10).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between py-2.5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white uppercase">
                          {b.selection} ·{' '}
                          <span className="text-slate-400">{b.periodId?.slice(-6)}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Stake ₹{b.amount} {b.resultText ? `· ${b.resultText}` : ''}
                        </div>
                      </div>
                      <div className="text-right font-bold tabular-nums">
                        {b.status === 'pending' && <span className="text-amber-400">Pending</span>}
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
          )}
        </div>
      </div>

      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-[#0d1630] p-5 space-y-3">
            <h3 className="text-lg font-bold text-white">WinGo Game Rules</h3>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <li>1. Choose 30 Sec, 1 Min, or 3 Min mode. Each mode runs on its own independent synchronized timer and pattern.</li>
              <li>2. Bet amount can be entered manually from ₹1 to ₹5,000.</li>
              <li>3. In the final 5 seconds, betting closes for countdown before the result reveals with a ring sound.</li>
              <li>4. Green (1,3,7,9) pays 2x (1.5x if 5). Red (2,4,6,8) pays 2x (1.5x if 0).</li>
              <li>5. Violet (0,5) pays 4.5x. Big (5-9) &amp; Small (0-4) pay 2x. Exact Number (0-9) pays 9x.</li>
            </ul>
            <button
              onClick={() => setShowRules(false)}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
