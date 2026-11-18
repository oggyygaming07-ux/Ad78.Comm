import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin786';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

type WingoMode = '30s' | '1m' | '3m';
type WingoColor = 'green' | 'red' | 'violet';
type AviatorPhase = 'betting' | 'flying' | 'crashed';

interface BankAccount {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

interface WingoRound {
  periodId: string;
  mode: WingoMode;
  number: number;
  colors: WingoColor[];
  size: 'big' | 'small';
  timestamp: number;
}

interface StoredUser {
  id: string;
  username: string;
  mobile: string;
  passwordHash: string;
  balance: number;
  bonusBalance: number;
  referralCode: string;
  createdAt: number;
  isFrozen: boolean;
  isDemo?: boolean;
  stakePresets: number[];
  savedUpiId?: string;
  bankAccount?: BankAccount;
}

interface BetRecord {
  id: string;
  userId: string;
  username: string;
  game: 'wingo' | 'aviator';
  mode?: WingoMode;
  periodId?: string;
  selectionType?: 'color' | 'size' | 'number';
  selection: string;
  amount: number;
  multiplier: number;
  payout: number;
  profit: number;
  status: 'pending' | 'won' | 'lost';
  resultText?: string;
  createdAt: number;
  settledAt?: number;
}

interface TransactionRecord {
  id: string;
  userId: string;
  username: string;
  mobile: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'bonus' | 'refund' | 'admin_credit' | 'admin_debit';
  amount: number;
  method?: string;
  reference?: string;
  accountDetail?: string;
  screenshotData?: string;
  pendingBonus?: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  note?: string;
  createdAt: number;
  updatedAt: number;
}

interface PlatformConfig {
  upiId: string;
  bankHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  noticeText: string;
}

interface SupportTicket {
  id: string;
  userId?: string;
  contactName: string;
  mobile: string;
  category: string;
  message: string;
  screenshotData?: string;
  status: 'open' | 'resolved';
  adminReply?: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  wingoHistory: Record<WingoMode, WingoRound[]>;
  wingoOverrides: Record<WingoMode, number | null>;
  wingoPatterns: Record<WingoMode, number[]>;
  wingoPatternCursor: Record<WingoMode, number>;
  aviatorOverride: number | null;
  aviatorPatternCursor: number;
  aviatorHistory: { roundId: string; crashPoint: number; timestamp: number }[];
  bets: BetRecord[];
  transactions: TransactionRecord[];
  supportTickets: SupportTicket[];
  platformConfig?: PlatformConfig;
  sessionSecret?: string;
}

const MODE_SECONDS: Record<WingoMode, number> = {
  '30s': 30,
  '1m': 60,
  '3m': 180,
};

const MODE_CODE: Record<WingoMode, string> = {
  '30s': '01',
  '1m': '02',
  '3m': '03',
};

const DEFAULT_PATTERN: Record<WingoMode, number[]> = {
  '30s': [1, 4, 7, 2, 9, 0, 3, 8, 5, 6, 1, 8, 3, 4, 7, 6],
  '1m': [8, 9, 9, 2, 1, 5, 4, 7, 0, 3, 6, 9, 2, 7, 4, 1],
  '3m': [3, 6, 9, 4, 1, 8, 5, 2, 7, 0, 9, 4, 3, 6, 1, 8],
};

// 10-round Aviator pattern: 4 wins (2.18x - 5.10x) + 6 early crashes (losses)
const AVIATOR_PATTERN = [1.14, 2.45, 1.04, 1.21, 3.85, 1.08, 2.18, 1.02, 1.17, 5.1];

function getColorsForNumber(num: number): WingoColor[] {
  if (num === 0) return ['red', 'violet'];
  if (num === 5) return ['green', 'violet'];
  return num % 2 === 1 ? ['green'] : ['red'];
}

function getSizeForNumber(num: number): 'big' | 'small' {
  return num >= 5 ? 'big' : 'small';
}

function getPeriodInfo(mode: WingoMode, nowMs: number) {
  const durationSec = MODE_SECONDS[mode];
  const durationMs = durationSec * 1000;
  const epochBucket = Math.floor(nowMs / durationMs);
  const elapsedMs = nowMs % durationMs;
  const secondsRemaining = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

  // Format date in IST (UTC+5:30) so period starts with current local date 20261118...
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(epochBucket * durationMs + istOffsetMs);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  const dayStartUtcMs = Date.UTC(yyyy, istDate.getUTCMonth(), istDate.getUTCDate()) - istOffsetMs;
  const roundInDay = Math.max(
    1,
    Math.floor((epochBucket * durationMs - dayStartUtcMs) / durationMs) + 1
  );
  const periodId = `${yyyy}${mm}${dd}${MODE_CODE[mode]}${String(roundInDay).padStart(5, '0')}`;

  return {
    mode,
    periodId,
    secondsRemaining,
    totalSeconds: durationSec,
    isLocked: secondsRemaining <= 5,
    epochBucket,
  };
}

function seedHistoryForMode(mode: WingoMode, nowMs: number): WingoRound[] {
  const durationMs = MODE_SECONDS[mode] * 1000;
  const currentBucket = Math.floor(nowMs / durationMs);
  const pattern = DEFAULT_PATTERN[mode];
  const rounds: WingoRound[] = [];

  for (let i = 1; i <= 25; i++) {
    const targetMs = (currentBucket - i) * durationMs + 1000;
    const info = getPeriodInfo(mode, targetMs);
    const num = pattern[(currentBucket - i + pattern.length * 100) % pattern.length];
    rounds.push({
      periodId: info.periodId,
      mode,
      number: num,
      colors: getColorsForNumber(num),
      size: getSizeForNumber(num),
      timestamp: targetMs,
    });
  }
  return rounds;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

function validateGenuineMobileServer(raw: string): { valid: boolean; error?: string } {
  const mobile = String(raw || '').trim();
  if (!/^\d{10}$/.test(mobile)) {
    return { valid: false, error: 'Enter a valid 10-digit mobile number.' };
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return { valid: false, error: 'Genuine mobile numbers must start with 6, 7, 8, or 9.' };
  }
  if (/(.)\1{2,}/.test(mobile)) {
    return { valid: false, error: 'Fake number rejected: 3 or more identical consecutive digits are not allowed.' };
  }
  if (new Set(mobile.split('')).size < 4) {
    return { valid: false, error: 'Repeated digit patterns are not allowed. Use a genuine mobile number.' };
  }
  const seqs = ['0123456789', '1234567890', '9876543210', '0987654321', '6789012345', '9012345678'];
  for (const seq of seqs) {
    for (let i = 0; i <= seq.length - 6; i++) {
      if (mobile.includes(seq.slice(i, i + 6))) {
        return { valid: false, error: 'Sequential fake mobile numbers are not allowed.' };
      }
    }
  }
  return { valid: true };
}

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  upiId: 'ad78.pay@upi',
  bankHolder: 'AD78 PAYMENTS ENTERPRISE',
  bankName: 'HDFC BANK',
  bankAccountNumber: '50200078451290',
  bankIfsc: 'HDFC0001780',
  noticeText: '',
};

function loadDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const now = Date.now();
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.users) && parsed.wingoHistory) {
        if (!Array.isArray(parsed.supportTickets)) parsed.supportTickets = [];
        if (!Array.isArray(parsed.aviatorHistory)) parsed.aviatorHistory = [];
        if (parsed.aviatorOverride === undefined) parsed.aviatorOverride = null;
        if (typeof parsed.aviatorPatternCursor !== 'number') parsed.aviatorPatternCursor = 0;
        if (!parsed.platformConfig) {
          parsed.platformConfig = { ...DEFAULT_PLATFORM_CONFIG };
        }
        if (!parsed.sessionSecret) {
          parsed.sessionSecret = crypto.randomBytes(32).toString('hex');
        }
        return parsed;
      }
    } catch {
      // Fallback
    }
  }

  const demoUser: StoredUser = {
    id: 'usr_demo_001',
    username: 'demo78',
    mobile: '9824517360',
    passwordHash: hashPassword('ad78pass'),
    balance: 5000,
    bonusBalance: 500,
    referralCode: 'AD78500',
    createdAt: now,
    isFrozen: false,
    isDemo: true,
    stakePresets: [10, 50, 100, 500],
  };

  const initial: DatabaseSchema = {
    users: [demoUser],
    wingoHistory: {
      '30s': seedHistoryForMode('30s', now),
      '1m': seedHistoryForMode('1m', now),
      '3m': seedHistoryForMode('3m', now),
    },
    wingoOverrides: {
      '30s': null,
      '1m': null,
      '3m': null,
    },
    wingoPatterns: {
      '30s': [...DEFAULT_PATTERN['30s']],
      '1m': [...DEFAULT_PATTERN['1m']],
      '3m': [...DEFAULT_PATTERN['3m']],
    },
    wingoPatternCursor: {
      '30s': 0,
      '1m': 0,
      '3m': 0,
    },
    aviatorOverride: null,
    aviatorPatternCursor: 0,
    aviatorHistory: [
      { roundId: 'AV20261118001', crashPoint: 1.18, timestamp: now - 60000 },
      { roundId: 'AV20261118002', crashPoint: 2.84, timestamp: now - 45000 },
      { roundId: 'AV20261118003', crashPoint: 1.07, timestamp: now - 30000 },
      { roundId: 'AV20261118004', crashPoint: 4.15, timestamp: now - 15000 },
    ],
    bets: [],
    transactions: [
      {
        id: 'tx_demo_welcome',
        userId: demoUser.id,
        username: demoUser.username,
        mobile: demoUser.mobile,
        type: 'bonus',
        amount: 5000,
        method: 'Demo Wallet',
        status: 'completed',
        note: 'Demo account starting balance',
        createdAt: now,
        updatedAt: now,
      },
    ],
    supportTickets: [],
    platformConfig: { ...DEFAULT_PLATFORM_CONFIG },
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

const db: DatabaseSchema = loadDatabase();
if (!db.sessionSecret) {
  db.sessionSecret = crypto.randomBytes(32).toString('hex');
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Failed to persist DB:', err);
    }
  }, 150);
}

function signToken(payload: string): string {
  const secret = db.sessionSecret || 'ad78_fallback_secret';
  const body = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string, expectedPrefix: string): string | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.', 2);
  if (!body || !sig) return null;
  const secret = db.sessionSecret || 'ad78_fallback_secret';
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    if (!decoded.startsWith(expectedPrefix)) return null;
    return decoded.slice(expectedPrefix.length);
  } catch {
    return null;
  }
}

const otpStore = new Map<string, { code: string; userId: string; expiresAt: number }>();

function sanitizeUser(u: StoredUser) {
  return {
    id: u.id,
    username: u.username,
    mobile: u.mobile,
    balance: Number(u.balance.toFixed(2)),
    bonusBalance: Number(u.bonusBalance.toFixed(2)),
    referralCode: u.referralCode,
    createdAt: u.createdAt,
    isFrozen: u.isFrozen,
    isDemo: Boolean(u.isDemo),
    stakePresets: u.stakePresets || [10, 50, 100, 500],
    savedUpiId: u.savedUpiId,
    bankAccount: u.bankAccount,
  };
}

function getAuthUser(req: express.Request): StoredUser | null {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const userId = verifyToken(token, 'u:');
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}

function isAdminAuthed(req: express.Request): boolean {
  const token = String(req.headers['x-admin-token'] || '').trim();
  return Boolean(token && verifyToken(token, 'admin:'));
}

interface WsClientMeta {
  ws: WebSocket;
  userId?: string;
}
const wsClients = new Set<WsClientMeta>();

function broadcastWs(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(text);
    }
  }
}

function sendToUserWs(userId: string, payload: unknown) {
  const text = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(text);
    }
  }
}

function getWingoClockPayload() {
  const now = Date.now();
  const modes: WingoMode[] = ['30s', '1m', '3m'];
  const clocks: Record<WingoMode, ReturnType<typeof getPeriodInfo> & { history: WingoRound[] }> = {} as Record<
    WingoMode,
    ReturnType<typeof getPeriodInfo> & { history: WingoRound[] }
  >;
  for (const m of modes) {
    const info = getPeriodInfo(m, now);
    clocks[m] = {
      ...info,
      history: db.wingoHistory[m].slice(0, 30),
    };
  }
  return clocks;
}

const lastKnownPeriod: Record<WingoMode, string> = {
  '30s': getPeriodInfo('30s', Date.now()).periodId,
  '1m': getPeriodInfo('1m', Date.now()).periodId,
  '3m': getPeriodInfo('3m', Date.now()).periodId,
};

function computeWingoPayoutMultiplier(
  bet: BetRecord,
  winningNumber: number,
  winningColors: WingoColor[],
  winningSize: 'big' | 'small'
): number {
  if (bet.selectionType === 'number') {
    return Number(bet.selection) === winningNumber ? 9 : 0;
  }
  if (bet.selectionType === 'size') {
    return bet.selection === winningSize ? 2 : 0;
  }
  if (bet.selectionType === 'color') {
    if (bet.selection === 'violet') {
      return winningColors.includes('violet') ? 4.5 : 0;
    }
    if (bet.selection === 'green') {
      if (winningNumber === 5) return 1.5;
      if (winningColors.includes('green')) return 2;
      return 0;
    }
    if (bet.selection === 'red') {
      if (winningNumber === 0) return 1.5;
      if (winningColors.includes('red')) return 2;
      return 0;
    }
  }
  return 0;
}

/**
 * Automatic pattern & risk engine:
 * 1) If Admin override is set -> uses that exact number.
 * 2) If any bet in the round is > ₹1000 -> picks number that minimizes payout (high bets lose).
 * 3) If bets exist, checks risk-managed minimum-payout selection 4 out of 5 rounds; otherwise advances pattern.
 */
function pickAutomatedWingoNumber(mode: WingoMode, pendingBets: BetRecord[]): number {
  const override = db.wingoOverrides[mode];
  if (override !== null && override !== undefined && override >= 0 && override <= 9) {
    db.wingoOverrides[mode] = null;
    return override;
  }

  const pattern = db.wingoPatterns[mode]?.length ? db.wingoPatterns[mode] : DEFAULT_PATTERN[mode];
  const cursor = db.wingoPatternCursor[mode] || 0;
  const patternCandidate = pattern[cursor % pattern.length];
  db.wingoPatternCursor[mode] = (cursor + 1) % pattern.length;

  if (pendingBets.length === 0) {
    return patternCandidate;
  }

  const hasOver1000 = pendingBets.some((b) => b.amount > 1000);
  // House risk check on >1000 bets or 4-of-5 loss cadence for small bets
  const shouldMinimizePayout = hasOver1000 || cursor % 5 !== 2;

  if (!shouldMinimizePayout) {
    return patternCandidate;
  }

  let bestNumber = patternCandidate;
  let lowestPayout = Infinity;

  for (let candidate = 0; candidate <= 9; candidate++) {
    const cColors = getColorsForNumber(candidate);
    const cSize = getSizeForNumber(candidate);
    let totalPayout = 0;
    for (const b of pendingBets) {
      totalPayout += b.amount * computeWingoPayoutMultiplier(b, candidate, cColors, cSize);
    }
    if (totalPayout < lowestPayout) {
      lowestPayout = totalPayout;
      bestNumber = candidate;
    }
  }

  return bestNumber;
}

function settleWingoPeriod(mode: WingoMode, periodId: string) {
  if (db.wingoHistory[mode].some((r) => r.periodId === periodId)) {
    return;
  }

  const pendingBets = db.bets.filter(
    (b) => b.game === 'wingo' && b.mode === mode && b.periodId === periodId && b.status === 'pending'
  );

  const winningNumber = pickAutomatedWingoNumber(mode, pendingBets);
  const colors = getColorsForNumber(winningNumber);
  const size = getSizeForNumber(winningNumber);
  const now = Date.now();

  const round: WingoRound = {
    periodId,
    mode,
    number: winningNumber,
    colors,
    size,
    timestamp: now,
  };

  db.wingoHistory[mode].unshift(round);
  if (db.wingoHistory[mode].length > 100) {
    db.wingoHistory[mode] = db.wingoHistory[mode].slice(0, 100);
  }

  const userSummaries = new Map<
    string,
    { totalStaked: number; totalPayout: number; bets: BetRecord[] }
  >();

  for (const bet of pendingBets) {
    const mult = computeWingoPayoutMultiplier(bet, winningNumber, colors, size);
    const payout = Number((bet.amount * mult).toFixed(2));
    bet.multiplier = mult;
    bet.payout = payout;
    bet.profit = Number((payout - bet.amount).toFixed(2));
    bet.status = payout > 0 ? 'won' : 'lost';
    bet.resultText = `#${winningNumber} (${colors.join('+').toUpperCase()} · ${size.toUpperCase()})`;
    bet.settledAt = now;

    const user = db.users.find((u) => u.id === bet.userId);
    if (user && payout > 0) {
      user.balance = Number((user.balance + payout).toFixed(2));
      db.transactions.unshift({
        id: `tx_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        username: user.username,
        mobile: user.mobile,
        type: 'win',
        amount: payout,
        method: `WinGo ${mode}`,
        reference: periodId,
        status: 'completed',
        note: `Won ₹${payout} on ${bet.selection.toUpperCase()}`,
        createdAt: now,
        updatedAt: now,
      });
    }

    const summary = userSummaries.get(bet.userId) || {
      totalStaked: 0,
      totalPayout: 0,
      bets: [],
    };
    summary.totalStaked += bet.amount;
    summary.totalPayout += payout;
    summary.bets.push(bet);
    userSummaries.set(bet.userId, summary);
  }

  scheduleSave();

  broadcastWs({
    type: 'wingo:result',
    mode,
    periodId,
    round,
    history: db.wingoHistory[mode].slice(0, 30),
  });

  for (const [userId, summary] of userSummaries.entries()) {
    const user = db.users.find((u) => u.id === userId);
    sendToUserWs(userId, {
      type: 'wingo:settlement',
      mode,
      periodId,
      round,
      balance: user ? user.balance : 0,
      userOutcome: {
        totalStaked: Number(summary.totalStaked.toFixed(2)),
        totalPayout: Number(summary.totalPayout.toFixed(2)),
        netProfit: Number((summary.totalPayout - summary.totalStaked).toFixed(2)),
        won: summary.totalPayout > 0,
        bets: summary.bets,
      },
    });
  }
}

// --- GLOBAL SYNCHRONIZED AVIATOR ENGINE ---
interface AviatorEngine {
  roundNumber: number;
  roundId: string;
  phase: AviatorPhase;
  phaseStartedAt: number;
  bettingDurationMs: number;
  crashDurationMs: number;
  targetCrashPoint: number;
  multiplier: number;
}

const aviatorEngine: AviatorEngine = {
  roundNumber: 1,
  roundId: `AV20261118005`,
  phase: 'betting',
  phaseStartedAt: Date.now(),
  bettingDurationMs: 6000,
  crashDurationMs: 3000,
  targetCrashPoint: AVIATOR_PATTERN[0],
  multiplier: 1.0,
};

function nextAviatorCrashPoint(): number {
  if (db.aviatorOverride !== null && db.aviatorOverride >= 1.01) {
    const val = db.aviatorOverride;
    db.aviatorOverride = null;
    scheduleSave();
    return val;
  }
  const idx = db.aviatorPatternCursor % AVIATOR_PATTERN.length;
  db.aviatorPatternCursor = (db.aviatorPatternCursor + 1) % AVIATOR_PATTERN.length;
  scheduleSave();
  return AVIATOR_PATTERN[idx];
}

function getAviatorPublicState() {
  const now = Date.now();
  const countdownSec =
    aviatorEngine.phase === 'betting'
      ? Math.max(0, Math.ceil((aviatorEngine.bettingDurationMs - (now - aviatorEngine.phaseStartedAt)) / 1000))
      : 0;
  return {
    roundId: aviatorEngine.roundId,
    phase: aviatorEngine.phase,
    countdownSec,
    multiplier: Number(aviatorEngine.multiplier.toFixed(2)),
    crashPoint: aviatorEngine.phase === 'crashed' ? aviatorEngine.targetCrashPoint : undefined,
    history: db.aviatorHistory.slice(0, 20),
  };
}

function settleUncashedAviatorBets(roundId: string, crashPoint: number) {
  const pending = db.bets.filter(
    (b) => b.game === 'aviator' && b.periodId === roundId && b.status === 'pending'
  );
  const now = Date.now();
  for (const b of pending) {
    b.status = 'lost';
    b.payout = 0;
    b.profit = -b.amount;
    b.resultText = `Flew away @ ${crashPoint.toFixed(2)}x`;
    b.settledAt = now;

    const u = db.users.find((usr) => usr.id === b.userId);
    sendToUserWs(b.userId, {
      type: 'aviator:settlement',
      roundId,
      won: false,
      staked: b.amount,
      payout: 0,
      crashPoint,
      balance: u ? u.balance : 0,
    });
  }
  if (pending.length > 0) scheduleSave();
}

function tickAviatorEngine() {
  const now = Date.now();
  const elapsed = now - aviatorEngine.phaseStartedAt;

  if (aviatorEngine.phase === 'betting') {
    aviatorEngine.multiplier = 1.0;
    if (elapsed >= aviatorEngine.bettingDurationMs) {
      aviatorEngine.phase = 'flying';
      aviatorEngine.phaseStartedAt = now;
      aviatorEngine.targetCrashPoint = nextAviatorCrashPoint();
      broadcastWs({ type: 'aviator:state', state: getAviatorPublicState() });
    }
  } else if (aviatorEngine.phase === 'flying') {
    const flightSec = elapsed / 1000;
    const nextMult = Number(Math.pow(Math.E, flightSec * 0.24).toFixed(2));
    if (nextMult >= aviatorEngine.targetCrashPoint) {
      aviatorEngine.multiplier = aviatorEngine.targetCrashPoint;
      aviatorEngine.phase = 'crashed';
      aviatorEngine.phaseStartedAt = now;

      db.aviatorHistory.unshift({
        roundId: aviatorEngine.roundId,
        crashPoint: aviatorEngine.targetCrashPoint,
        timestamp: now,
      });
      if (db.aviatorHistory.length > 50) {
        db.aviatorHistory = db.aviatorHistory.slice(0, 50);
      }
      settleUncashedAviatorBets(aviatorEngine.roundId, aviatorEngine.targetCrashPoint);
      scheduleSave();
      broadcastWs({ type: 'aviator:state', state: getAviatorPublicState() });
    } else {
      aviatorEngine.multiplier = nextMult;
      broadcastWs({ type: 'aviator:tick', state: getAviatorPublicState() });
    }
  } else if (aviatorEngine.phase === 'crashed') {
    if (elapsed >= aviatorEngine.crashDurationMs) {
      aviatorEngine.roundNumber += 1;
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const d = new Date(now + istOffsetMs);
      const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      aviatorEngine.roundId = `AV${ymd}${String(100 + aviatorEngine.roundNumber).padStart(4, '0')}`;
      aviatorEngine.phase = 'betting';
      aviatorEngine.phaseStartedAt = now;
      aviatorEngine.multiplier = 1.0;
      broadcastWs({ type: 'aviator:state', state: getAviatorPublicState() });
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // --- AUTH ROUTES ---
  app.post('/api/auth/register', (req, res) => {
    const { username, mobile, password } = req.body || {};
    const cleanUsername = String(username || '').trim();
    const cleanMobile = String(mobile || '').trim();
    const cleanPassword = String(password || '').trim();

    if (
      cleanUsername.length < 4 ||
      cleanUsername.length > 20 ||
      !/^[a-zA-Z0-9_]+$/.test(cleanUsername) ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanUsername)
    ) {
      return res.status(400).json({
        error: 'Username must be 4-20 chars mixing letters and numbers (e.g. rahul78).',
      });
    }

    const mobileCheck = validateGenuineMobileServer(cleanMobile);
    if (!mobileCheck.valid) {
      return res.status(400).json({ error: mobileCheck.error });
    }

    if (cleanPassword.length < 6 || cleanPassword.length > 24 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPassword)) {
      return res.status(400).json({
        error: 'Password must be 6-24 chars mixing letters and numbers (e.g. rahul123).',
      });
    }

    if (db.users.some((u) => u.mobile === cleanMobile)) {
      return res.status(409).json({
        error: 'This mobile number is already registered. Only one ID is allowed per mobile number.',
      });
    }

    if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return res.status(409).json({ error: 'Username is already taken. Choose a different username.' });
    }

    const now = Date.now();
    let seqNum = 1001 + db.users.length;
    let uniqueUserId = `AD78U${seqNum}`;
    while (db.users.some((u) => u.id === uniqueUserId)) {
      seqNum += 1;
      uniqueUserId = `AD78U${seqNum}`;
    }

    const newUser: StoredUser = {
      id: uniqueUserId,
      username: cleanUsername,
      mobile: cleanMobile,
      passwordHash: hashPassword(cleanPassword),
      balance: 0,
      bonusBalance: 0,
      referralCode: `AD78${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: now,
      isFrozen: false,
      stakePresets: [10, 50, 100, 500],
    };

    db.users.push(newUser);
    scheduleSave();

    const token = signToken(`u:${newUser.id}`);
    return res.json({ token, user: sanitizeUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { identifier, mobile, password } = req.body || {};
    const loginKey = String(mobile || identifier || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!loginKey || !cleanPassword) {
      return res.status(400).json({ error: 'Mobile number/username and password are required.' });
    }

    const user = db.users.find(
      (u) => u.mobile === loginKey || u.username.toLowerCase() === loginKey.toLowerCase()
    );

    if (!user || !verifyPassword(cleanPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid mobile number/username or password.' });
    }

    if (user.isFrozen) {
      return res.status(403).json({ error: 'Account is temporarily frozen. Contact 24x7 support.' });
    }

    const token = signToken(`u:${user.id}`);
    return res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/demo', (_req, res) => {
    const demoUser = db.users.find((u) => u.isDemo) || db.users[0];
    if (!demoUser) {
      return res.status(500).json({ error: 'Demo user unavailable.' });
    }
    const token = signToken(`u:${demoUser.id}`);
    return res.json({ token, user: sanitizeUser(demoUser) });
  });

  app.post('/api/auth/forgot-otp', (req, res) => {
    const { identifier } = req.body || {};
    const key = String(identifier || '').trim();
    const user = db.users.find(
      (u) => u.mobile === key || u.username.toLowerCase() === key.toLowerCase()
    );
    if (!user) {
      return res.status(404).json({ error: 'No account found with that mobile number or username.' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(user.id, { code, userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
    return res.json({
      sent: true,
      maskedMobile: `******${user.mobile.slice(-4)}`,
      demoOtp: code,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { identifier, otp, newPassword } = req.body || {};
    const key = String(identifier || '').trim();
    const cleanPass = String(newPassword || '').trim();

    if (cleanPass.length < 6 || cleanPass.length > 24 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPass)) {
      return res.status(400).json({
        error: 'New password must be 6-24 chars mixing letters and numbers.',
      });
    }

    const user = db.users.find(
      (u) => u.mobile === key || u.username.toLowerCase() === key.toLowerCase()
    );
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const entry = otpStore.get(user.id);
    if (!entry || entry.code !== String(otp || '').trim() || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    user.passwordHash = hashPassword(cleanPass);
    otpStore.delete(user.id);
    scheduleSave();
    return res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/stakes', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const presets = Array.isArray(req.body?.stakePresets)
      ? req.body.stakePresets.map(Number).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 10000).slice(0, 4)
      : [];
    if (presets.length !== 4) {
      return res.status(400).json({ error: 'Provide 4 valid stake preset amounts between ₹1 and ₹10,000.' });
    }
    user.stakePresets = presets;
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/bank', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const accountHolder = String(req.body?.accountHolder || '').trim();
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const ifsc = String(req.body?.ifsc || '').trim().toUpperCase();
    const bankName = String(req.body?.bankName || '').trim();

    if (accountHolder.length < 2) {
      return res.status(400).json({ error: 'Enter a valid Account Holder Name.' });
    }
    if (!/^\d{6,20}$/.test(accountNumber)) {
      return res.status(400).json({ error: 'Enter a valid Bank Account Number (6-20 digits).' });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      return res.status(400).json({ error: 'Enter a valid 11-character IFSC Code (e.g. SBIN0001234).' });
    }
    if (bankName.length < 2) {
      return res.status(400).json({ error: 'Enter your Bank Name.' });
    }

    user.bankAccount = { accountHolder, accountNumber, ifsc, bankName };
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/upi', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const cleanUpi = String(req.body?.savedUpiId || '').trim();
    if (cleanUpi.length < 5 || !cleanUpi.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis).' });
    }
    user.savedUpiId = cleanUpi;
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/user/change-password', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    const currentPassword = String(req.body?.currentPassword || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (
      newPassword.length < 6 ||
      newPassword.length > 24 ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)
    ) {
      return res.status(400).json({
        error: 'New password must be 6-24 chars mixing letters and numbers (e.g. rahul123).',
      });
    }

    user.passwordHash = hashPassword(newPassword);
    scheduleSave();
    return res.json({ success: true });
  });

  // --- WINGO & PLATFORM CONFIG ROUTES ---
  app.get('/api/wingo/state', (_req, res) => {
    return res.json({
      clocks: getWingoClockPayload(),
      platformConfig: db.platformConfig || DEFAULT_PLATFORM_CONFIG,
    });
  });

  app.get('/api/platform/config', (_req, res) => {
    return res.json({
      platformConfig: db.platformConfig || DEFAULT_PLATFORM_CONFIG,
    });
  });

  app.post('/api/wingo/bet', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to place a bet.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const { mode, selectionType, selection, amount } = req.body || {};
    if (!['30s', '1m', '3m'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid WinGo mode.' });
    }

    const wingoMode = mode as WingoMode;
    const periodInfo = getPeriodInfo(wingoMode, Date.now());
    if (periodInfo.isLocked) {
      return res.status(400).json({ error: 'Betting closed in final 5 seconds. Wait for next round.' });
    }

    const betAmount = Number(amount);
    if (!Number.isFinite(betAmount) || betAmount < 1 || betAmount > 5000) {
      return res.status(400).json({ error: 'Color Prediction bet must be between ₹1 and ₹5,000.' });
    }

    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    if (
      (selectionType === 'color' && !['green', 'red', 'violet'].includes(selection)) ||
      (selectionType === 'size' && !['big', 'small'].includes(selection)) ||
      (selectionType === 'number' && !/^\d$/.test(String(selection))) ||
      !['color', 'size', 'number'].includes(selectionType)
    ) {
      return res.status(400).json({ error: 'Invalid WinGo selection.' });
    }

    const now = Date.now();
    user.balance = Number((user.balance - betAmount).toFixed(2));

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'wingo',
      mode: wingoMode,
      periodId: periodInfo.periodId,
      selectionType,
      selection: String(selection),
      amount: betAmount,
      multiplier: 0,
      payout: 0,
      profit: -betAmount,
      status: 'pending',
      createdAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: betAmount,
      method: `WinGo ${wingoMode}`,
      reference: periodInfo.periodId,
      status: 'completed',
      note: `Bet ₹${betAmount} on ${String(selection).toUpperCase()}`,
      createdAt: now,
      updatedAt: now,
    });

    scheduleSave();

    return res.json({ bet, balance: user.balance });
  });

  // --- AVIATOR ROUTES (MIN ₹10, GLOBAL SYNC) ---
  app.get('/api/aviator/state', (_req, res) => {
    return res.json({ state: getAviatorPublicState() });
  });

  app.post('/api/aviator/bet', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to play Aviator.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    if (aviatorEngine.phase !== 'betting') {
      return res.status(400).json({ error: 'Wait for next takeoff countdown to place your bet.' });
    }

    const betAmount = Number(req.body?.amount);
    if (!Number.isFinite(betAmount) || betAmount < 10 || betAmount > 50000) {
      return res.status(400).json({ error: 'Minimum Aviator bet is ₹10 (max ₹50,000).' });
    }
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance. Please deposit.' });
    }

    const alreadyPlaced = db.bets.find(
      (b) =>
        b.game === 'aviator' &&
        b.userId === user.id &&
        b.periodId === aviatorEngine.roundId &&
        b.status === 'pending'
    );
    if (alreadyPlaced) {
      return res.status(400).json({ error: 'You already have an active bet for this flight.' });
    }

    const now = Date.now();
    user.balance = Number((user.balance - betAmount).toFixed(2));

    const bet: BetRecord = {
      id: `bet_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      game: 'aviator',
      periodId: aviatorEngine.roundId,
      selection: 'Aviator Flight',
      amount: betAmount,
      multiplier: 0,
      payout: 0,
      profit: -betAmount,
      status: 'pending',
      createdAt: now,
    };

    db.bets.unshift(bet);
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'bet',
      amount: betAmount,
      method: 'Aviator',
      reference: aviatorEngine.roundId,
      status: 'completed',
      note: `Aviator bet ₹${betAmount}`,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();

    return res.json({ bet, balance: user.balance });
  });

  app.post('/api/aviator/cashout', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (aviatorEngine.phase !== 'flying') {
      return res.status(400).json({ error: 'Plane is not currently flying.' });
    }

    const bet = db.bets.find(
      (b) =>
        b.game === 'aviator' &&
        b.userId === user.id &&
        b.periodId === aviatorEngine.roundId &&
        b.status === 'pending'
    );
    if (!bet) {
      return res.status(400).json({ error: 'No active Aviator bet in this round.' });
    }

    const mult = Number(aviatorEngine.multiplier.toFixed(2));
    const payout = Number((bet.amount * mult).toFixed(2));
    const now = Date.now();

    bet.multiplier = mult;
    bet.payout = payout;
    bet.profit = Number((payout - bet.amount).toFixed(2));
    bet.status = 'won';
    bet.selection = `Cashout ${mult}x`;
    bet.resultText = `Cashed out @ ${mult.toFixed(2)}x`;
    bet.settledAt = now;

    user.balance = Number((user.balance + payout).toFixed(2));
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'win',
      amount: payout,
      method: 'Aviator',
      reference: aviatorEngine.roundId,
      status: 'completed',
      note: `Aviator cashout @ ${mult}x (+₹${payout})`,
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();

    return res.json({
      won: true,
      multiplier: mult,
      payout,
      balance: user.balance,
      bet,
    });
  });

  // --- DEPOSIT (₹100 - ₹50,000, PROCESSING UNTIL ADMIN APPROVAL) & WITHDRAWAL (MIN ₹110) ---
  app.post('/api/wallet/deposit', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const { amount, method, reference, screenshotData } = req.body || {};
    const depAmount = Number(amount);
    if (!Number.isFinite(depAmount) || depAmount < 100 || depAmount > 50000) {
      return res.status(400).json({ error: 'Deposit amount must be between ₹100 and ₹50,000.' });
    }
    const cleanRef = String(reference || '').trim();
    if (cleanRef.length < 4) {
      return res.status(400).json({ error: 'Enter a valid 12-digit UTR / Payment Reference number.' });
    }

    const now = Date.now();
    const methodStr = String(method || 'UPI');
    const isBankMethod = methodStr.toLowerCase().includes('bank');
    const cleanScreenshot =
      typeof screenshotData === 'string' && screenshotData.startsWith('data:image/')
        ? screenshotData.slice(0, 2_500_000)
        : undefined;
    const bonus = isBankMethod ? (depAmount >= 500 ? 2 : 1) : 0;

    // Deposit remains in 'pending' (Processing) until verified & approved in Admin Panel
    const tx: TransactionRecord = {
      id: `PRC${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'deposit',
      amount: Number(depAmount.toFixed(2)),
      method: methodStr,
      reference: cleanRef,
      screenshotData: cleanScreenshot,
      pendingBonus: bonus > 0 ? bonus : undefined,
      status: 'pending',
      note:
        bonus > 0
          ? `Deposit ₹${depAmount} (+₹${bonus} Bank Bonus on approval) · UTR: ${cleanRef}`
          : `Deposit via ${methodStr} · UTR: ${cleanRef}`,
      createdAt: now,
      updatedAt: now,
    };

    db.transactions.unshift(tx);
    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });

    return res.json({ transaction: tx, pendingBonus: bonus, balance: user.balance });
  });

  app.post('/api/wallet/withdraw', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });
    if (user.isFrozen) return res.status(403).json({ error: 'Account frozen.' });

    const { amount, method, accountDetail } = req.body || {};
    const wdAmount = Number(amount);
    if (!Number.isFinite(wdAmount) || wdAmount < 110) {
      return res.status(400).json({ error: 'Minimum withdrawal is ₹110.' });
    }
    if (user.balance < wdAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance for withdrawal.' });
    }
    const cleanAccount = String(accountDetail || '').trim();
    if (cleanAccount.length < 5) {
      return res.status(400).json({ error: 'Enter a valid UPI ID or Bank Account details.' });
    }

    const now = Date.now();
    // Hold withdrawal amount in pending state until Admin approves (rejection refunds automatically)
    user.balance = Number((user.balance - wdAmount).toFixed(2));

    const tx: TransactionRecord = {
      id: `WD${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: 'withdrawal',
      amount: Number(wdAmount.toFixed(2)),
      method: String(method || 'UPI'),
      accountDetail: cleanAccount,
      status: 'pending',
      note: `Withdrawal requested to ${cleanAccount} (Processing)`,
      createdAt: now,
      updatedAt: now,
    };

    db.transactions.unshift(tx);
    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });

    return res.json({ transaction: tx, balance: user.balance });
  });

  app.get('/api/user/history', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userBets = db.bets.filter((b) => b.userId === user.id).slice(0, 150);
    const userTransactions = db.transactions.filter((t) => t.userId === user.id).slice(0, 150);

    const settled = userBets.filter((b) => b.status !== 'pending');
    const totalTurnover = settled.reduce((acc, b) => acc + b.amount, 0);
    const totalPayout = settled.reduce((acc, b) => acc + b.payout, 0);
    const netProfitLoss = totalPayout - totalTurnover;

    return res.json({
      bets: userBets,
      transactions: userTransactions,
      summary: {
        totalBets: userBets.length,
        totalTurnover: Number(totalTurnover.toFixed(2)),
        totalPayout: Number(totalPayout.toFixed(2)),
        netProfitLoss: Number(netProfitLoss.toFixed(2)),
      },
    });
  });

  // --- 24x7 SUPPORT & COMPLAINT TICKETS ---
  app.post('/api/support/tickets', (req, res) => {
    const user = getAuthUser(req);
    const { contactName, mobile, category, message, screenshotData } = req.body || {};

    const cleanName = String(contactName || user?.username || '').trim();
    const cleanMobile = String(mobile || user?.mobile || '').trim();
    const cleanCategory = String(category || 'General Support').trim();
    const cleanMsg = String(message || '').trim();

    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Enter your name or username.' });
    }
    if (!/^\d{10}$/.test(cleanMobile)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    }
    if (cleanMsg.length < 5) {
      return res.status(400).json({ error: 'Describe your issue briefly.' });
    }

    const ticket: SupportTicket = {
      id: `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: user?.id,
      contactName: cleanName,
      mobile: cleanMobile,
      category: cleanCategory,
      message: cleanMsg,
      screenshotData:
        typeof screenshotData === 'string' && screenshotData.startsWith('data:image/')
          ? screenshotData.slice(0, 2_500_000)
          : undefined,
      status: 'open',
      createdAt: Date.now(),
    };

    db.supportTickets.unshift(ticket);
    if (db.supportTickets.length > 200) {
      db.supportTickets = db.supportTickets.slice(0, 200);
    }
    scheduleSave();

    return res.json({ ticket });
  });

  app.get('/api/support/tickets', (req, res) => {
    const user = getAuthUser(req);
    const mobileQuery = String(req.query.mobile || '').trim();
    const tickets = db.supportTickets.filter((t) => {
      if (user && t.userId === user.id) return true;
      if (mobileQuery && t.mobile === mobileQuery) return true;
      return false;
    });
    return res.json({ tickets: tickets.slice(0, 30) });
  });

  // --- SEPARATE ADMIN PANEL ROUTES ---
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (String(password || '') !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid Admin PIN / Password.' });
    }
    const token = signToken(`admin:${crypto.randomBytes(12).toString('hex')}`);
    return res.json({ token });
  });

  app.get('/api/admin/overview', (req, res) => {
    if (!isAdminAuthed(req)) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }

    const clocks = getWingoClockPayload();
    const modes: WingoMode[] = ['30s', '1m', '3m'];
    const livePools: Record<
      WingoMode,
      {
        periodId: string;
        totalAmount: number;
        bySelection: Record<string, number>;
      }
    > = {} as Record<
      WingoMode,
      {
        periodId: string;
        totalAmount: number;
        bySelection: Record<string, number>;
      }
    >;

    for (const m of modes) {
      const pid = clocks[m].periodId;
      const periodBets = db.bets.filter(
        (b) => b.game === 'wingo' && b.mode === m && b.periodId === pid && b.status === 'pending'
      );
      const bySelection: Record<string, number> = {};
      let totalAmount = 0;
      for (const b of periodBets) {
        totalAmount += b.amount;
        bySelection[b.selection] = (bySelection[b.selection] || 0) + b.amount;
      }
      livePools[m] = { periodId: pid, totalAmount, bySelection };
    }

    const depositTxs = db.transactions.filter((t) => t.type === 'deposit' && t.status === 'approved');
    const totalDeposits = depositTxs.reduce((acc, t) => acc + t.amount, 0);
    const totalWithdrawals = db.transactions
      .filter((t) => t.type === 'withdrawal' && t.status === 'approved')
      .reduce((acc, t) => acc + t.amount, 0);

    const openClients = [...wsClients].filter((c) => c.ws.readyState === WebSocket.OPEN);
    const activePlayerIds = new Set<string>();
    for (const c of openClients) {
      if (c.userId) activePlayerIds.add(c.userId);
    }
    for (const b of db.bets) {
      if (b.status === 'pending') activePlayerIds.add(b.userId);
    }

    return res.json({
      clocks,
      livePools,
      overrides: db.wingoOverrides,
      patterns: db.wingoPatterns,
      aviator: getAviatorPublicState(),
      aviatorOverride: db.aviatorOverride,
      platformConfig: db.platformConfig || DEFAULT_PLATFORM_CONFIG,
      users: db.users.map((u) => sanitizeUser(u)),
      pendingTransactions: db.transactions.filter(
        (t) => (t.type === 'deposit' || t.type === 'withdrawal') && t.status === 'pending'
      ),
      allTransactions: db.transactions.slice(0, 120),
      recentBets: db.bets.slice(0, 120),
      supportTickets: db.supportTickets.slice(0, 60),
      stats: {
        totalUsers: db.users.length,
        activeConnections: openClients.length,
        activePlayersNow: activePlayerIds.size,
        totalDepositCount: depositTxs.length,
        totalDeposits: Number(totalDeposits.toFixed(2)),
        totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
        totalBetsCount: db.bets.length,
      },
    });
  });

  app.post('/api/admin/wingo/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { mode, number, pattern } = req.body || {};
    if (!['30s', '1m', '3m'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode.' });
    }
    const m = mode as WingoMode;
    if (number === null || number === undefined || number === '') {
      db.wingoOverrides[m] = null;
    } else {
      const n = Number(number);
      if (!Number.isInteger(n) || n < 0 || n > 9) {
        return res.status(400).json({ error: 'Number must be 0-9.' });
      }
      db.wingoOverrides[m] = n;
    }

    if (Array.isArray(pattern) && pattern.length > 0) {
      const cleaned = pattern.map(Number).filter((x: number) => Number.isInteger(x) && x >= 0 && x <= 9);
      if (cleaned.length > 0) {
        db.wingoPatterns[m] = cleaned;
        db.wingoPatternCursor[m] = 0;
      }
    }

    scheduleSave();
    return res.json({ overrides: db.wingoOverrides, patterns: db.wingoPatterns });
  });

  app.post('/api/admin/aviator/override', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { crashPoint } = req.body || {};
    if (crashPoint === null || crashPoint === undefined || crashPoint === '') {
      db.aviatorOverride = null;
    } else {
      const val = Number(crashPoint);
      if (!Number.isFinite(val) || val < 1.01 || val > 250) {
        return res.status(400).json({ error: 'Crash point must be between 1.01x and 250x.' });
      }
      db.aviatorOverride = Number(val.toFixed(2));
    }
    scheduleSave();
    return res.json({ aviatorOverride: db.aviatorOverride });
  });

  app.post('/api/admin/support/reply', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { ticketId, reply } = req.body || {};
    const ticket = db.supportTickets.find((t) => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    ticket.adminReply = String(reply || 'Resolved by AD78 Support').trim();
    ticket.status = 'resolved';
    scheduleSave();
    return res.json({ ticket });
  });

  app.post('/api/admin/transaction/review', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { transactionId, action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject.' });
    }
    const tx = db.transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    const user = db.users.find((u) => u.id === tx.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const now = Date.now();
    if (tx.status === 'pending') {
      if (action === 'approve') {
        tx.status = 'approved';
        tx.updatedAt = now;
        if (tx.type === 'deposit') {
          const bonusAmt = tx.pendingBonus && tx.pendingBonus > 0 ? tx.pendingBonus : 0;
          user.balance = Number((user.balance + tx.amount + bonusAmt).toFixed(2));
          tx.note = `Deposit Approved · UTR: ${tx.reference || tx.id}`;
          if (bonusAmt > 0) {
            db.transactions.unshift({
              id: `tx_${crypto.randomBytes(6).toString('hex')}`,
              userId: user.id,
              username: user.username,
              mobile: user.mobile,
              type: 'bonus',
              amount: bonusAmt,
              method: 'Bank Deposit Bonus',
              reference: tx.reference || tx.id,
              status: 'completed',
              note: `₹${bonusAmt} extra bonus on approved Bank deposit (${tx.id})`,
              createdAt: now + 1,
              updatedAt: now + 1,
            });
          }
        } else if (tx.type === 'withdrawal') {
          tx.note = `Withdrawal Approved to ${tx.accountDetail || tx.method}`;
        }
      } else {
        tx.status = 'rejected';
        tx.updatedAt = now;
        tx.note = `${tx.note || tx.type} · Rejected by Admin`;
        if (tx.type === 'withdrawal') {
          user.balance = Number((user.balance + tx.amount).toFixed(2));
          db.transactions.unshift({
            id: `tx_${crypto.randomBytes(6).toString('hex')}`,
            userId: user.id,
            username: user.username,
            mobile: user.mobile,
            type: 'refund',
            amount: tx.amount,
            method: tx.method,
            reference: tx.id,
            status: 'completed',
            note: 'Withdrawal rejected — balance refunded',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    } else if (tx.type === 'deposit' && tx.status === 'approved' && action === 'reject') {
      // Allow Admin to reject & reverse a verified-invalid UPI/Bank deposit
      tx.status = 'rejected';
      tx.updatedAt = now;
      tx.note = `${tx.note || ''} · Rejected by Admin`.trim();
      user.balance = Math.max(0, Number((user.balance - tx.amount).toFixed(2)));
    } else {
      return res.status(400).json({ error: 'Transaction cannot be changed in current state.' });
    }

    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ transaction: tx, user: sanitizeUser(user) });
  });

  app.post('/api/admin/platform/config', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const prev = db.platformConfig || { ...DEFAULT_PLATFORM_CONFIG };
    const updated: PlatformConfig = {
      upiId: String(body.upiId ?? prev.upiId).trim() || prev.upiId,
      bankHolder: String(body.bankHolder ?? prev.bankHolder).trim() || prev.bankHolder,
      bankName: String(body.bankName ?? prev.bankName).trim() || prev.bankName,
      bankAccountNumber:
        String(body.bankAccountNumber ?? prev.bankAccountNumber).trim() || prev.bankAccountNumber,
      bankIfsc: String(body.bankIfsc ?? prev.bankIfsc).trim().toUpperCase() || prev.bankIfsc,
      noticeText: String(body.noticeText ?? prev.noticeText).trim(),
    };
    db.platformConfig = updated;
    scheduleSave();
    broadcastWs({ type: 'platform:update', platformConfig: updated });
    return res.json({ platformConfig: updated });
  });

  app.post('/api/admin/user/balance', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, delta, note } = req.body || {};
    const numDelta = Number(delta);
    if (!Number.isFinite(numDelta) || numDelta === 0) {
      return res.status(400).json({ error: 'Invalid balance adjustment amount.' });
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const nextBal = Number((user.balance + numDelta).toFixed(2));
    if (nextBal < 0) {
      return res.status(400).json({ error: 'Balance cannot go below ₹0.' });
    }
    user.balance = nextBal;
    const now = Date.now();
    db.transactions.unshift({
      id: `tx_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      username: user.username,
      mobile: user.mobile,
      type: numDelta > 0 ? 'admin_credit' : 'admin_debit',
      amount: Math.abs(numDelta),
      method: 'Admin Adjustment',
      status: 'completed',
      note: String(note || (numDelta > 0 ? 'Admin wallet credit' : 'Admin wallet debit')),
      createdAt: now,
      updatedAt: now,
    });
    scheduleSave();
    sendToUserWs(user.id, { type: 'wallet:update', balance: user.balance });
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/admin/user/freeze', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, isFrozen } = req.body || {};
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.isFrozen = Boolean(isFrozen);
    scheduleSave();
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/admin/user/password', (req, res) => {
    if (!isAdminAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, newPassword } = req.body || {};
    const cleanPass = String(newPassword || '').trim();
    if (
      cleanPass.length < 6 ||
      cleanPass.length > 24 ||
      !/(?=.*[a-zA-Z])(?=.*\d)/.test(cleanPass)
    ) {
      return res.status(400).json({
        error: 'Password must be 6-24 chars mixing letters and numbers.',
      });
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.passwordHash = hashPassword(cleanPass);
    scheduleSave();
    return res.json({ success: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const meta: WsClientMeta = { ws };
    wsClients.add(meta);

    try {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      const uid = verifyToken(token, 'u:');
      if (uid) {
        meta.userId = uid;
      }
    } catch {
      // Ignore
    }

    ws.send(
      JSON.stringify({
        type: 'wingo:init',
        clocks: getWingoClockPayload(),
        aviator: getAviatorPublicState(),
        platformConfig: db.platformConfig || DEFAULT_PLATFORM_CONFIG,
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === 'auth' && typeof msg.token === 'string') {
          const uid = verifyToken(msg.token, 'u:');
          if (uid) meta.userId = uid;
        }
      } catch {
        // Ignore
      }
    });

    ws.on('close', () => {
      wsClients.delete(meta);
    });
  });

  let lastBroadcastTickSec = -1;
  setInterval(() => {
    const now = Date.now();
    const modes: WingoMode[] = ['30s', '1m', '3m'];
    for (const m of modes) {
      const current = getPeriodInfo(m, now);
      if (current.periodId !== lastKnownPeriod[m]) {
        const finishedPeriodId = lastKnownPeriod[m];
        lastKnownPeriod[m] = current.periodId;
        settleWingoPeriod(m, finishedPeriodId);
      }
    }

    tickAviatorEngine();

    const sec = Math.floor(now / 1000);
    if (sec !== lastBroadcastTickSec) {
      lastBroadcastTickSec = sec;
      broadcastWs({
        type: 'wingo:tick',
        serverNow: now,
        clocks: {
          '30s': getPeriodInfo('30s', now),
          '1m': getPeriodInfo('1m', now),
          '3m': getPeriodInfo('3m', now),
        },
        aviator: getAviatorPublicState(),
      });
    }
  }, 120);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AD78 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
