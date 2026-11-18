import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreenMode, AuthViews } from './components/AuthViews';
import { AviatorGame } from './components/AviatorGame';
import { BrandLogo } from './components/BrandLogo';
import { HomeDashboard } from './components/HomeDashboard';
import { ResultModal, ResultModalData } from './components/ResultModal';
import { SupportCenter } from './components/SupportCenter';
import { MenuPage, WalletAndMenu } from './components/WalletAndMenu';
import { WingoGame } from './components/WingoGame';
import {
  AviatorState,
  BetRecord,
  PlatformConfig,
  TransactionRecord,
  UserProfile,
  WingoMode,
  WingoModeClock,
  WingoRound,
} from './types';
import { playLossTone, playWinChime } from './utils/sound';

type AppScreen =
  | { view: 'home' }
  | { view: 'auth'; mode: AuthScreenMode }
  | { view: 'wingo' }
  | { view: 'aviator' }
  | { view: 'support'; category?: string }
  | { view: 'menu'; page: MenuPage };

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return <UserApp />;
}

function UserApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<AppScreen>({ view: 'home' });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('ad78_token')
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clocks, setClocks] = useState<Record<WingoMode, WingoModeClock> | null>(null);
  const [aviator, setAviator] = useState<AviatorState | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setShowSplash(false), 1100);
    return () => window.clearTimeout(t);
  }, []);

  const [bets, setBets] = useState<BetRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [summary, setSummary] = useState({
    totalBets: 0,
    totalTurnover: 0,
    totalPayout: 0,
    netProfitLoss: 0,
  });

  const [resultModal, setResultModal] = useState<ResultModalData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const fetchUserHistory = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/user/history', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setBets(data.bets || []);
      setTransactions(data.transactions || []);
      if (data.summary) setSummary(data.summary);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetch('/api/wingo/state')
      .then((r) => r.json())
      .then((d) => {
        if (d?.clocks) setClocks(d.clocks);
        if (d?.platformConfig) setPlatformConfig(d.platformConfig);
      })
      .catch(() => {});

    fetch('/api/aviator/state')
      .then((r) => r.json())
      .then((d) => {
        if (d?.state) setAviator(d.state);
      })
      .catch(() => {});

    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          if (!r.ok) {
            localStorage.removeItem('ad78_token');
            setToken(null);
            setUser(null);
            return;
          }
          const data = await r.json();
          setUser(data.user);
          fetchUserHistory(token);
        })
        .catch(() => {});
    }
  }, [token, fetchUserHistory]);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws${
        tokenRef.current ? `?token=${encodeURIComponent(tokenRef.current)}` : ''
      }`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'wingo:init') {
            if (msg.clocks) setClocks(msg.clocks);
            if (msg.aviator) setAviator(msg.aviator);
            if (msg.platformConfig) setPlatformConfig(msg.platformConfig);
          } else if (msg.type === 'platform:update' && msg.platformConfig) {
            setPlatformConfig(msg.platformConfig);
          } else if (msg.type === 'wingo:tick') {
            if (msg.clocks) {
              setClocks((prev) => {
                if (!prev) return null;
                const next: Record<WingoMode, WingoModeClock> = { ...prev };
                (['30s', '1m', '3m'] as WingoMode[]).forEach((m) => {
                  if (msg.clocks[m] && prev[m]) {
                    next[m] = {
                      ...msg.clocks[m],
                      history: prev[m].history,
                    };
                  }
                });
                return next;
              });
            }
            if (msg.aviator) {
              setAviator(msg.aviator);
            }
          } else if ((msg.type === 'aviator:state' || msg.type === 'aviator:tick') && msg.state) {
            setAviator(msg.state);
          } else if (msg.type === 'aviator:settlement') {
            if (typeof msg.balance === 'number') {
              setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            }
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
            playLossTone();
            setResultModal({
              title: 'LOSS',
              subtitle: `Aviator · Flew away @ ${Number(msg.crashPoint || 1).toFixed(2)}x`,
              won: false,
              staked: Number(msg.staked || 0),
              payout: 0,
              netProfit: -Number(msg.staked || 0),
              updatedBalance: Number(msg.balance ?? 0),
            });
          } else if (msg.type === 'wingo:result' && msg.mode) {
            const m = msg.mode as WingoMode;
            const hist = msg.history as WingoRound[];
            setClocks((prev) => {
              if (!prev || !prev[m]) return prev;
              return {
                ...prev,
                [m]: {
                  ...prev[m],
                  history: hist,
                },
              };
            });
          } else if (msg.type === 'wingo:settlement') {
            if (typeof msg.balance === 'number') {
              setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            }
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
            if (msg.userOutcome) {
              const out = msg.userOutcome;
              if (out.won) playWinChime();
              else playLossTone();

              setResultModal({
                title: out.won ? 'WIN' : 'LOSS',
                subtitle: `WinGo ${String(msg.mode).toUpperCase()} · Period ${msg.periodId}`,
                won: out.won,
                staked: out.totalStaked,
                payout: out.totalPayout,
                netProfit: out.netProfit,
                updatedBalance: msg.balance ?? 0,
                wingoRound: msg.round,
              });
            }
          } else if (msg.type === 'wallet:update' && typeof msg.balance === 'number') {
            setUser((u) => (u ? { ...u, balance: msg.balance } : u));
            if (tokenRef.current) {
              fetchUserHistory(tokenRef.current);
            }
          }
        } catch {
          // Ignore malformed ws message
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [fetchUserHistory]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && token) {
      wsRef.current.send(JSON.stringify({ type: 'auth', token }));
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('ad78_token', newToken);
    setToken(newToken);
    setUser(newUser);
    fetchUserHistory(newToken);
    setScreen({ view: 'home' });
  };

  const handleLogout = () => {
    localStorage.removeItem('ad78_token');
    setToken(null);
    setUser(null);
    setBets([]);
    setTransactions([]);
    setScreen({ view: 'home' });
  };

  const handleBalanceUpdate = (newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, balance: newBalance } : prev));
  };

  const handleBetPlaced = (bet: BetRecord) => {
    setBets((prev) => [bet, ...prev]);
    if (token) {
      fetchUserHistory(token);
    }
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#130b29] via-[#0a1426] to-[#08101d] px-6">
        <div className="animate-pulse">
          <BrandLogo size="lg" />
        </div>
        <div className="mt-5 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-teal-400" />
        </div>
        <p className="mt-3 text-xs font-semibold tracking-wider text-slate-300">
          AD78 · LOADING...
        </p>
      </div>
    );
  }

  return (
    <>
      {screen.view === 'home' && (
        <HomeDashboard
          user={user}
          aviator={aviator}
          platformConfig={platformConfig}
          onOpenAuth={(mode) => setScreen({ view: 'auth', mode })}
          onOpenWingo={() => setScreen({ view: 'wingo' })}
          onOpenAviator={() => setScreen({ view: 'aviator' })}
          onOpenMenu={(page) => setScreen({ view: 'menu', page })}
          onOpenSupport={() => setScreen({ view: 'support' })}
        />
      )}

      {screen.view === 'auth' && (
        <AuthViews
          initialMode={screen.mode}
          onBack={() => setScreen({ view: 'home' })}
          onOpenSupport={(category) => setScreen({ view: 'support', category })}
          onSuccess={handleAuthSuccess}
        />
      )}

      {screen.view === 'wingo' && (
        <WingoGame
          user={user}
          token={token}
          clocks={clocks}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'WinGo / Aviator Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
        />
      )}

      {screen.view === 'aviator' && (
        <AviatorGame
          user={user}
          token={token}
          aviator={aviator}
          myBets={bets}
          onBack={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenDeposit={() => setScreen({ view: 'menu', page: 'deposit' })}
          onOpenSupport={() => setScreen({ view: 'support', category: 'WinGo / Aviator Game Issue' })}
          onBalanceUpdate={handleBalanceUpdate}
          onBetPlaced={handleBetPlaced}
          onCashoutSuccess={({ multiplier, payout, staked, balance, roundId }) => {
            if (token) fetchUserHistory(token);
            setResultModal({
              title: 'WIN',
              subtitle: `Aviator · Cashed Out @ ${multiplier.toFixed(2)}x (${roundId})`,
              won: true,
              staked,
              payout,
              netProfit: Number((payout - staked).toFixed(2)),
              updatedBalance: balance,
            });
          }}
        />
      )}

      {screen.view === 'support' && (
        <SupportCenter
          user={user}
          token={token}
          initialCategory={screen.category}
          onBack={() => setScreen({ view: 'home' })}
        />
      )}

      {screen.view === 'menu' && (
        <WalletAndMenu
          page={screen.page}
          user={user}
          token={token}
          bets={bets}
          transactions={transactions}
          summary={summary}
          platformConfig={platformConfig}
          onNavigate={(page) => setScreen({ view: 'menu', page })}
          onBackHome={() => setScreen({ view: 'home' })}
          onRequireAuth={() => setScreen({ view: 'auth', mode: 'login' })}
          onOpenSupport={() => setScreen({ view: 'support' })}
          onBalanceUpdate={handleBalanceUpdate}
          onUserUpdate={setUser}
          onRefreshHistory={() => token && fetchUserHistory(token)}
          onLogout={handleLogout}
        />
      )}

      <ResultModal data={resultModal} onClose={() => setResultModal(null)} />
    </>
  );
}
