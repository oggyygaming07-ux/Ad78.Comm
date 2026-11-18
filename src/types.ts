export type WingoMode = '30s' | '1m' | '3m';

export type WingoColor = 'green' | 'red' | 'violet';

export type WingoSelectionType = 'color' | 'size' | 'number';

export interface BankAccount {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface WingoRound {
  periodId: string;
  mode: WingoMode;
  number: number; // 0-9
  colors: WingoColor[];
  size: 'big' | 'small';
  timestamp: number;
}

export interface WingoModeClock {
  mode: WingoMode;
  periodId: string;
  secondsRemaining: number;
  totalSeconds: number;
  isLocked: boolean;
  history: WingoRound[];
}

export type AviatorPhase = 'betting' | 'flying' | 'crashed';

export interface AviatorState {
  roundId: string;
  phase: AviatorPhase;
  countdownSec: number;
  multiplier: number;
  crashPoint?: number;
  history: { roundId: string; crashPoint: number; timestamp: number }[];
}

export interface UserProfile {
  id: string;
  username: string;
  mobile: string;
  balance: number;
  bonusBalance: number;
  referralCode: string;
  createdAt: number;
  isFrozen: boolean;
  isDemo?: boolean;
  stakePresets: number[];
  bankAccount?: BankAccount;
  savedUpiId?: string;
}

export interface BetRecord {
  id: string;
  userId: string;
  username: string;
  game: 'wingo' | 'aviator';
  mode?: WingoMode;
  periodId?: string;
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

export interface TransactionRecord {
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

export interface PlatformConfig {
  upiId: string;
  bankHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  noticeText?: string;
}

export interface SupportTicket {
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
