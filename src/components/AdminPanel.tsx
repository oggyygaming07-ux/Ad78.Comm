import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Headphones,
  Lock,
  Plane,
  RefreshCw,
  Settings,
  Shield,
  Sliders,
  Unlock,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  AviatorState,
  BetRecord,
  PlatformConfig,
  SupportTicket,
  TransactionRecord,
  UserProfile,
  WingoMode,
  WingoModeClock,
} from '../types';

interface AdminOverview {
  clocks: Record<WingoMode, WingoModeClock>;
  livePools: Record<
    WingoMode,
    { periodId: string; totalAmount: number; bySelection: Record<string, number> }
  >;
  overrides: Record<WingoMode, number | null>;
  patterns: Record<WingoMode, number[]>;
  aviator: AviatorState;
  aviatorOverride: number | null;
  platformConfig?: PlatformConfig;
  users: UserProfile[];
  pendingTransactions: TransactionRecord[];
  allTransactions: TransactionRecord[];
  recentBets: BetRecord[];
  supportTickets: SupportTicket[];
  stats: {
    totalUsers: number;
    activeConnections: number;
    activePlayersNow: number;
    totalDepositCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBetsCount: number;
  };
}

export const AdminPanel: React.FC = () => {
  const [adminToken, setAdminToken] = useState<string>(
    () => sessionStorage.getItem('ad78_admin_token') || ''
  );
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<
    'wingo' | 'aviator' | 'payments' | 'support' | 'users' | 'bets' | 'config'
  >('wingo');
  const [statusMsg, setStatusMsg] = useState('');
  const [patternInputs, setPatternInputs] = useState<Record<WingoMode, string>>({
    '30s': '',
    '1m': '',
    '3m': '',
  });
  const [aviatorCrashInput, setAviatorCrashInput] = useState('');
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({});
  const [newPassEdits, setNewPassEdits] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cfgForm, setCfgForm] = useState<PlatformConfig>({
    upiId: 'ad78.pay@upi',
    bankHolder: 'AD78 PAYMENTS ENTERPRISE',
    bankName: 'HDFC BANK',
    bankAccountNumber: '50200078451290',
    bankIfsc: 'HDFC0001780',
    noticeText: '',
  });
  const [cfgLoaded, setCfgLoaded] = useState(false);

  const fetchOverview = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-token': adminToken },
      });
      if (res.status === 401) {
        sessionStorage.removeItem('ad78_admin_token');
        setAdminToken('');
        return;
      }
      const data = (await res.json()) as AdminOverview;
      setOverview(data);
      setPatternInputs((prev) => ({
        '30s': prev['30s'] || data.patterns['30s'].join(','),
        '1m': prev['1m'] || data.patterns['1m'].join(','),
        '3m': prev['3m'] || data.patterns['3m'].join(','),
      }));
      if (data.platformConfig && !cfgLoaded) {
        setCfgForm({
          upiId: data.platformConfig.upiId,
          bankHolder: data.platformConfig.bankHolder,
          bankName: data.platformConfig.bankName,
          bankAccountNumber: data.platformConfig.bankAccountNumber,
          bankIfsc: data.platformConfig.bankIfsc,
          noticeText: data.platformConfig.noticeText || '',
        });
        setCfgLoaded(true);
      }
    } catch {
      // Ignore
    }
  }, [adminToken, cfgLoaded]);

  useEffect(() => {
    if (!adminToken) return;
    fetchOverview();
    const id = window.setInterval(fetchOverview, 2000);
    return () => window.clearInterval(id);
  }, [adminToken, fetchOverview]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid password');
      sessionStorage.setItem('ad78_admin_token', data.token);
      setAdminToken(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleOverride = async (mode: WingoMode, num: number | null) => {
    try {
      const res = await fetch('/api/admin/wingo/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ mode, number: num }),
      });
      if (res.ok) {
        setStatusMsg(
          num === null
            ? `Cleared next-round override for WinGo ${mode}.`
            : `WinGo ${mode} next result locked to #${num}.`
        );
        fetchOverview();
      }
    } catch {
      // Ignore
    }
  };

  const handleSavePattern = async (mode: WingoMode) => {
    const nums = patternInputs[mode]
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 9);
    if (nums.length === 0) {
      setStatusMsg('Enter comma-separated digits 0-9 for the pattern.');
      return;
    }
    const res = await fetch('/api/admin/wingo/override', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ mode, pattern: nums }),
    });
    if (res.ok) {
      setStatusMsg(`Updated ${mode} pattern sequence (${nums.length} steps).`);
      fetchOverview();
    }
  };

  const handleAviatorOverride = async (val: string | null) => {
    const res = await fetch('/api/admin/aviator/override', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ crashPoint: val }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || 'Could not set Aviator override');
      return;
    }
    setAviatorCrashInput('');
    setStatusMsg(
      val === null
        ? 'Cleared Aviator next-flight crash override.'
        : `Aviator next flight locked to crash at ${data.aviatorOverride}x.`
    );
    fetchOverview();
  };

  const handleSupportReply = async (ticketId: string) => {
    const reply = (replyInputs[ticketId] || 'Resolved by AD78 Support').trim();
    const res = await fetch('/api/admin/support/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ ticketId, reply }),
    });
    if (res.ok) {
      setReplyInputs((p) => ({ ...p, [ticketId]: '' }));
      setStatusMsg(`Support ticket ${ticketId} resolved.`);
      fetchOverview();
    }
  };

  const handleTxReview = async (transactionId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/admin/transaction/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ transactionId, action }),
    });
    if (res.ok) {
      setStatusMsg(`Transaction ${action}d successfully.`);
      fetchOverview();
    }
  };

  const handleAdjustBalance = async (userId: string, sign: 1 | -1) => {
    const raw = Number(balanceEdits[userId] || 0);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const res = await fetch('/api/admin/user/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ userId, delta: sign * raw }),
    });
    if (res.ok) {
      setBalanceEdits((p) => ({ ...p, [userId]: '' }));
      setStatusMsg(`Wallet adjusted by ${sign > 0 ? '+' : '-'}₹${raw}.`);
      fetchOverview();
    }
  };

  const handleToggleFreeze = async (user: UserProfile) => {
    const res = await fetch('/api/admin/user/freeze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ userId: user.id, isFrozen: !user.isFrozen }),
    });
    if (res.ok) {
      setStatusMsg(`User ${user.username} ${!user.isFrozen ? 'frozen' : 'unfrozen'}.`);
      fetchOverview();
    }
  };

  const handleResetUserPassword = async (user: UserProfile) => {
    const np = (newPassEdits[user.id] || '').trim();
    if (np.length < 6) {
      setStatusMsg('Enter a new password (min 6 chars mixing letters & numbers).');
      return;
    }
    const res = await fetch('/api/admin/user/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ userId: user.id, newPassword: np }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || 'Could not reset password.');
      return;
    }
    setNewPassEdits((p) => ({ ...p, [user.id]: '' }));
    setStatusMsg(`Password updated for user ${user.username} (${user.mobile}).`);
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/platform/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(cfgForm),
    });
    if (res.ok) {
      setStatusMsg('Platform update pushed live to all connected user apps!');
      fetchOverview();
    } else {
      setStatusMsg('Could not update platform settings.');
    }
  };

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-4">
        <form
          onSubmit={handleAdminLogin}
          className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0d1424] p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AD78 Admin Desk</h1>
              <p className="text-xs text-slate-400">Restricted Operations Console</p>
            </div>
          </div>

          {authError && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3 py-2 text-xs text-rose-200">
              {authError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Admin Security PIN
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Admin PIN (default: admin786)"
              className="w-full rounded-xl bg-[#070b14] border border-slate-700 px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition"
          >
            Unlock Admin Panel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pb-12">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-amber-400" />
          <div>
            <div className="text-base font-bold text-white">AD78 Admin Panel</div>
            <div className="text-[11px] text-slate-400">Isolated Control &amp; Risk Desk</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchOverview}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('ad78_admin_token');
              setAdminToken('');
            }}
            className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-300"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-5 space-y-5">
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Total Users</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                {overview.stats.totalUsers}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Registered AD78 IDs
              </div>
            </div>
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Live Playing Now</div>
              <div className="mt-1 text-2xl font-bold text-cyan-300 tabular-nums">
                {overview.stats.activePlayersNow}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                {overview.stats.activeConnections} active connections
              </div>
            </div>
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Deposits Received</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">
                ₹{overview.stats.totalDeposits.toFixed(0)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                {overview.stats.totalDepositCount} deposits
              </div>
            </div>
            <div className="rounded-xl bg-[#0d1424] border border-slate-800 p-4">
              <div className="text-xs text-slate-400">Withdrawals / Support</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                ₹{overview.stats.totalWithdrawals.toFixed(0)}
              </div>
              <div className="mt-0.5 text-[11px] text-amber-300">
                {overview.supportTickets.filter((t) => t.status === 'open').length} open tickets
              </div>
            </div>
          </div>
        )}

        {statusMsg && (
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-4 py-2.5 text-xs font-semibold text-amber-200">
            {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'wingo' as const, label: 'WinGo Live Control', icon: Sliders },
            { id: 'aviator' as const, label: 'Aviator Control', icon: Plane },
            { id: 'payments' as const, label: 'Deposits & UTR Check', icon: Wallet },
            { id: 'support' as const, label: '24×7 Support Tickets', icon: Headphones },
            { id: 'users' as const, label: 'Users & Passwords', icon: Users },
            { id: 'bets' as const, label: 'All Live Bets', icon: Shield },
            { id: 'config' as const, label: 'App Update & UPI', icon: Settings },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  tab === t.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#0d1424] text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* WINGO LIVE CONTROL */}
        {tab === 'wingo' && overview && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(['30s', '1m', '3m'] as WingoMode[]).map((mode) => {
              const clock = overview.clocks[mode];
              const pool = overview.livePools[mode];
              const currentOverride = overview.overrides[mode];

              return (
                <div
                  key={mode}
                  className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-white">
                        WinGo {mode.toUpperCase()}
                      </div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {clock.periodId}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg px-3 py-1 text-sm font-bold tabular-nums ${
                        clock.isLocked
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {clock.secondsRemaining}s
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#070b14] p-3 border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Active Pool</span>
                      <span className="font-bold text-white tabular-nums">
                        ₹{pool.totalAmount.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(pool.bySelection).length === 0 ? (
                        <span className="text-[11px] text-slate-500">No bets yet this period</span>
                      ) : (
                        Object.entries(pool.bySelection).map(([sel, amt]) => (
                          <span
                            key={sel}
                            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-white"
                          >
                            {sel}: ₹{amt}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300">
                        Set Next Winning Number
                      </span>
                      {currentOverride !== null && (
                        <button
                          onClick={() => handleOverride(mode, null)}
                          className="text-[11px] font-bold text-rose-400 underline"
                        >
                          Clear (#{currentOverride})
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <button
                          key={n}
                          onClick={() => handleOverride(mode, n)}
                          className={`rounded-lg py-2 text-xs font-bold transition ${
                            currentOverride === n
                              ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Automated Pattern Sequence (0-9)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={patternInputs[mode]}
                        onChange={(e) =>
                          setPatternInputs((p) => ({ ...p, [mode]: e.target.value }))
                        }
                        className="flex-1 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        onClick={() => handleSavePattern(mode)}
                        className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AVIATOR LIVE CONTROL */}
        {tab === 'aviator' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">AD78 Aviator Flight Control</h2>
                <p className="text-xs text-slate-400">
                  Default auto cadence: 4 wins / 6 low-crash rounds out of 10. Override next crash below.
                </p>
              </div>
              <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-cyan-300 tabular-nums">
                {overview.aviator.roundId} · {overview.aviator.phase.toUpperCase()} ({overview.aviator.multiplier.toFixed(2)}x)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="1.01"
                max="250"
                value={aviatorCrashInput}
                onChange={(e) => setAviatorCrashInput(e.target.value)}
                placeholder="Crash multiplier e.g. 1.15 or 4.50"
                className="w-56 rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-xs text-white"
              />
              <button
                onClick={() => handleAviatorOverride(aviatorCrashInput)}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950"
              >
                Lock Next Crash
              </button>
              {[1.1, 1.35, 2.5, 5.0].map((v) => (
                <button
                  key={v}
                  onClick={() => handleAviatorOverride(String(v))}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  {v.toFixed(2)}x
                </button>
              ))}
              {overview.aviatorOverride !== null && (
                <button
                  onClick={() => handleAviatorOverride(null)}
                  className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-300"
                >
                  Clear Override ({overview.aviatorOverride}x)
                </button>
              )}
            </div>
          </div>
        )}

        {/* SUPPORT TICKETS WITH SCREENSHOTS */}
        {tab === 'support' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4">
            <h2 className="text-sm font-bold text-white">24×7 Support Tickets &amp; Screenshots</h2>
            {overview.supportTickets.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No support complaints registered yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {overview.supportTickets.map((t) => (
                  <div key={t.id} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-amber-300">{t.id}</span>
                        <span className="ml-2 text-sm font-bold text-white">
                          {t.contactName} ({t.mobile})
                        </span>
                        <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-cyan-300">
                          {t.category}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-bold uppercase ${
                          t.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{t.message}</p>

                    {t.screenshotData && (
                      <img
                        src={t.screenshotData}
                        alt="Complaint screenshot"
                        className="max-h-56 rounded-xl border border-slate-700 object-contain"
                      />
                    )}

                    {t.status === 'open' ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyInputs[t.id] || ''}
                          onChange={(e) =>
                            setReplyInputs((p) => ({ ...p, [t.id]: e.target.value }))
                          }
                          placeholder="Write reply to resolve ticket..."
                          className="flex-1 rounded-lg bg-[#070b14] border border-slate-700 px-3 py-1.5 text-xs text-white"
                        />
                        <button
                          onClick={() => handleSupportReply(t.id)}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                        >
                          Resolve
                        </button>
                      </div>
                    ) : (
                      t.adminReply && (
                        <div className="text-xs text-emerald-300">Reply: {t.adminReply}</div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRANSACTIONS & UPI SCREENSHOT / UTR VERIFICATION */}
        {tab === 'payments' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 p-4 space-y-4">
            <h2 className="text-sm font-bold text-white">
              Deposit Screenshots, UTR Verification &amp; Withdrawal Log
            </h2>
            {overview.pendingTransactions.length > 0 && (
              <div className="divide-y divide-slate-800 border-b border-slate-700 pb-3">
                {overview.pendingTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                          {tx.type} · PROCESSING
                        </span>
                        <span className="text-sm font-bold text-white">
                          {tx.username} ({tx.mobile})
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          User ID: {tx.userId}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Process ID: <strong className="text-white">{tx.id}</strong> · {tx.method} ·{' '}
                        {tx.reference ? `UTR: ${tx.reference}` : tx.accountDetail}
                        {tx.pendingBonus ? ` · +₹${tx.pendingBonus} Bank Bonus` : ''}
                      </div>
                      {tx.screenshotData && (
                        <button
                          type="button"
                          onClick={() => setPreviewImage(tx.screenshotData || null)}
                          className="mt-2 block"
                        >
                          <img
                            src={tx.screenshotData}
                            alt="UPI payment proof"
                            className="h-24 rounded-lg border border-slate-700 object-contain hover:border-cyan-400"
                          />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white mr-2 tabular-nums">
                        ₹{tx.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleTxReview(tx.id, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleTxReview(tx.id, 'reject')}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="divide-y divide-slate-800">
              {overview.allTransactions.slice(0, 50).map((tx) => (
                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-white uppercase">
                      {tx.type} · {tx.username} ({tx.mobile}) ·{' '}
                      <span className="text-cyan-300">User ID: {tx.userId}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Process ID: {tx.id} · {tx.method} ·{' '}
                      {tx.reference ? `UTR: ${tx.reference}` : tx.accountDetail || tx.note}
                    </div>
                    {tx.note && (
                      <div className="text-[11px] text-slate-400">{tx.note}</div>
                    )}
                    {tx.screenshotData && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(tx.screenshotData || null)}
                        className="mt-1 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#070b14] p-1.5 hover:border-cyan-400"
                      >
                        <img
                          src={tx.screenshotData}
                          alt="Deposit payment screenshot"
                          className="h-16 w-16 rounded object-cover"
                        />
                        <span className="text-[11px] font-semibold text-cyan-300">
                          View Screenshot
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-bold text-white">₹{tx.amount.toFixed(2)}</div>
                      <div
                        className={`text-[10px] font-bold uppercase ${
                          tx.status === 'rejected'
                            ? 'text-rose-400'
                            : tx.status === 'pending'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {tx.status === 'pending' ? 'PROCESSING' : tx.status}
                      </div>
                    </div>
                    {tx.type === 'deposit' && tx.status === 'approved' && (
                      <button
                        onClick={() => handleTxReview(tx.id, 'reject')}
                        className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/30"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 divide-y divide-slate-800">
            {overview.users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">{u.username}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      {u.id}
                    </span>
                    <span className="text-xs text-cyan-300">{u.mobile}</span>
                    {u.isFrozen && (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        FROZEN
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-white font-semibold tabular-nums">
                    Balance: ₹{u.balance.toFixed(2)}
                  </div>
                  {u.savedUpiId && (
                    <div className="mt-0.5 text-[11px] text-cyan-300">
                      Saved UPI: {u.savedUpiId}
                    </div>
                  )}
                  {u.bankAccount && (
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Bank: {u.bankAccount.accountHolder} · {u.bankAccount.accountNumber} (
                      {u.bankAccount.ifsc})
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    placeholder="Amount ₹"
                    value={balanceEdits[u.id] || ''}
                    onChange={(e) =>
                      setBalanceEdits((p) => ({ ...p, [u.id]: e.target.value }))
                    }
                    className="w-28 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() => handleAdjustBalance(u.id, 1)}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                  >
                    + Credit
                  </button>
                  <button
                    onClick={() => handleAdjustBalance(u.id, -1)}
                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    - Debit
                  </button>
                  <button
                    onClick={() => handleToggleFreeze(u)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200"
                  >
                    {u.isFrozen ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    <span>{u.isFrozen ? 'Unfreeze' : 'Freeze'}</span>
                  </button>
                  <input
                    type="text"
                    placeholder="New pass (e.g. ad78new)"
                    value={newPassEdits[u.id] || ''}
                    onChange={(e) =>
                      setNewPassEdits((p) => ({ ...p, [u.id]: e.target.value }))
                    }
                    className="w-36 rounded-lg bg-[#070b14] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() => handleResetUserPassword(u)}
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                  >
                    Set Pass
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ALL LIVE BETS */}
        {tab === 'bets' && overview && (
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-3 py-3">Game</th>
                  <th className="px-3 py-3">Selection</th>
                  <th className="px-3 py-3 text-right">Stake</th>
                  <th className="px-3 py-3 text-right">Payout</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {overview.recentBets.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2.5 font-semibold text-white">{b.username}</td>
                    <td className="px-3 py-2.5 uppercase text-slate-300">
                      {b.game} {b.mode || ''}
                    </td>
                    <td className="px-3 py-2.5 text-cyan-300 uppercase">{b.selection}</td>
                    <td className="px-3 py-2.5 text-right text-white tabular-nums">₹{b.amount}</td>
                    <td className="px-3 py-2.5 text-right text-white tabular-nums">
                      ₹{b.payout.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-bold uppercase ${
                        b.status === 'won'
                          ? 'text-emerald-400'
                          : b.status === 'lost'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {b.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* PLATFORM UPDATE & PAYMENT CONFIG (ONLY UPDATES USER APP WHEN ADMIN SAVES) */}
        {tab === 'config' && (
          <form
            onSubmit={handleSavePlatformConfig}
            className="rounded-2xl bg-[#0d1424] border border-slate-800 p-5 space-y-4"
          >
            <div>
              <h2 className="text-base font-bold text-white">
                App Update &amp; Official Payment Details
              </h2>
              <p className="text-xs text-slate-400">
                Changes saved here push live to all connected user phones automatically. User apps do not change until updated from this Admin Panel.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Official UPI ID</label>
                <input
                  type="text"
                  value={cfgForm.upiId}
                  onChange={(e) => setCfgForm((p) => ({ ...p, upiId: e.target.value }))}
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Bank Account Holder</label>
                <input
                  type="text"
                  value={cfgForm.bankHolder}
                  onChange={(e) => setCfgForm((p) => ({ ...p, bankHolder: e.target.value }))}
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Bank Name</label>
                <input
                  type="text"
                  value={cfgForm.bankName}
                  onChange={(e) => setCfgForm((p) => ({ ...p, bankName: e.target.value }))}
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Bank Account Number</label>
                <input
                  type="text"
                  value={cfgForm.bankAccountNumber}
                  onChange={(e) => setCfgForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Bank IFSC Code</label>
                <input
                  type="text"
                  value={cfgForm.bankIfsc}
                  onChange={(e) => setCfgForm((p) => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">
                  Live App Announcement (Optional)
                </label>
                <input
                  type="text"
                  value={cfgForm.noticeText || ''}
                  onChange={(e) => setCfgForm((p) => ({ ...p, noticeText: e.target.value }))}
                  placeholder="Leave blank for none"
                  className="w-full rounded-lg bg-[#070b14] border border-slate-700 px-3 py-2 text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition"
            >
              Push Update to All User Apps
            </button>
          </form>
        )}
      </div>

      {/* Full-Size Screenshot Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl bg-[#0d1424] border border-slate-700 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 rounded-full bg-slate-800 p-1.5 text-white hover:bg-slate-700"
              aria-label="Close image preview"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage}
              alt="Full payment screenshot"
              className="max-h-[80vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
