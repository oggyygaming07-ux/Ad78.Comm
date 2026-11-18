import React, { useEffect } from 'react';
import { Trophy, X, XCircle } from 'lucide-react';
import { WingoRound } from '../types';

export interface ResultModalData {
  title: string;
  subtitle: string;
  won: boolean;
  staked: number;
  payout: number;
  netProfit: number;
  updatedBalance: number;
  wingoRound?: WingoRound;
  detailLine?: string;
}

interface ResultModalProps {
  data: ResultModalData | null;
  onClose: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ data, onClose }) => {
  // Auto-dismiss after 2 seconds for both WIN and LOSS
  useEffect(() => {
    if (!data) return;
    const timer = window.setTimeout(() => {
      onClose();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [data, onClose]);

  if (!data) return null;

  const round = data.wingoRound;
  const ballBg = round
    ? round.number === 0
      ? 'bg-gradient-to-br from-red-500 via-red-600 to-purple-600'
      : round.number === 5
      ? 'bg-gradient-to-br from-emerald-500 via-green-600 to-purple-600'
      : round.colors.includes('green')
      ? 'bg-gradient-to-br from-emerald-400 to-green-600'
      : 'bg-gradient-to-br from-rose-500 to-red-600'
    : 'bg-slate-700';

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] px-4">
      <div
        className={`pointer-events-auto relative w-full max-w-sm rounded-3xl border-2 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.75)] text-center space-y-3 transition-all ${
          data.won
            ? 'bg-[#0b2620]/95 border-emerald-400/80'
            : 'bg-[#26111c]/95 border-rose-400/75'
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close result popup"
          className="absolute right-3 top-3 rounded-full p-1 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Center Winning Number Ball or Aviator Icon */}
        <div className="flex justify-center">
          {round ? (
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl font-extrabold text-white border-2 border-white/80 shadow-xl ${ballBg}`}
            >
              {round.number}
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              {data.won ? (
                <Trophy className="h-7 w-7 text-amber-400" />
              ) : (
                <XCircle className="h-7 w-7 text-rose-400" />
              )}
            </div>
          )}
        </div>

        {/* Win/Loss Headline & Color/Size Prediction */}
        <div>
          <div
            className={`text-2xl font-extrabold uppercase tracking-wider ${
              data.won ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {data.won ? 'WIN' : 'LOSS'}
          </div>
          {round && (
            <div className="mt-1 text-xs font-bold text-white uppercase">
              Number {round.number} · {round.colors.join('+')} · {round.size}
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-slate-300">{data.subtitle}</div>
        </div>

        {/* Payout / Loss Amount & Updated White Balance */}
        <div className="rounded-2xl bg-black/30 border border-white/10 px-4 py-2.5 flex items-center justify-between">
          <div className="text-left">
            <div className="text-[10px] text-slate-400 uppercase">Result</div>
            <div
              className={`text-base font-bold tabular-nums ${
                data.won ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {data.won ? `+₹${data.payout.toFixed(2)}` : `-₹${data.staked.toFixed(2)}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase">Balance</div>
            <div className="text-base font-bold text-white tabular-nums">
              ₹{data.updatedBalance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
