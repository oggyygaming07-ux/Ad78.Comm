import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileSpreadsheet,
  Gift,
  Headphones,
  History,
  ImagePlus,
  KeyRound,
  Landmark,
  LogOut,
  Megaphone,
  QrCode,
  Receipt,
  Settings,
  Share2,
  Smartphone,
  TrendingUp,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { BetRecord, PlatformConfig, TransactionRecord, UserProfile } from '../types';
import {
  MAX_DEPOSIT,
  MIN_DEPOSIT,
  MIN_WITHDRAWAL,
  validateMixedPassword,
} from '../utils/validation';

export type MenuPage =
  | 'menu'
  | 'profile'
  | 'statement'
  | 'bank'
  | 'deposit'
  | 'withdraw'
  | 'bets'
  | 'wallet'
  | 'pnl'
  | 'turnover'
  | 'bonus'
  | 'transactions'
  | 'stakes'
  | 'rules'
  | 'promotions'
  | 'affiliate';

interface WalletAndMenuProps {
  page: MenuPage;
  user: UserProfile | null;
  token: string | null;
  bets: BetRecord[];
  transactions: TransactionRecord[];
  summary: {
    totalBets: number;
    totalTurnover: number;
    totalPayout: number;
    netProfitLoss: number;
  };
  platformConfig?: PlatformConfig | null;
  onNavigate: (page: MenuPage) => void;
  onBackHome: () => void;
  onRequireAuth: () => void;
  onOpenSupport: () => void;
  onBalanceUpdate: (newBalance: number) => void;
  onUserUpdate: (u: UserProfile) => void;
  onRefreshHistory: () => void;
  onLogout: () => void;
}

const MENU_ITEMS: { id: MenuPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile Settings', icon: User },
  { id: 'statement', label: 'Account Statement', icon: Landmark },
  { id: 'bank', label: 'Bank Account', icon: Building2 },
  { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
  { id: 'withdraw', label: 'Withdrawal', icon: ArrowUpFromLine },
  { id: 'bets', label: 'My Bets', icon: Receipt },
  { id: 'wallet', label: 'My Wallet', icon: Wallet },
  { id: 'pnl', label: 'Betting Profit & Loss', icon: TrendingUp },
  { id: 'turnover', label: 'Turnover History', icon: History },
  { id: 'bonus', label: 'Bonus Statement', icon: Gift },
  { id: 'transactions', label: 'My Transaction', icon: FileSpreadsheet },
  { id: 'stakes', label: 'Stake Settings', icon: Settings },
  { id: 'rules', label: 'Game Rules', icon: BookOpen },
  { id: 'promotions', label: 'Promotions', icon: Megaphone },
  { id: 'affiliate', label: 'Affiliate Program', icon: Share2 },
];

const UPI_APPS = ['PhonePe', 'Paytm', 'Google Pay', 'Other UPI'] as const;

export const WalletAndMenu: React.FC<WalletAndMenuProps> = ({
  page,
  user,
  token,
  bets,
  transactions,
  summary,
  platformConfig,
  onNavigate,
  onBackHome,
  onRequireAuth,
  onOpenSupport,
  onBalanceUpdate,
  onUserUpdate,
  onRefreshHistory,
  onLogout,
}) => {
  const activeUpiId = platformConfig?.upiId || 'ad78.pay@upi';
  const activeBankHolder = platformConfig?.bankHolder || 'AD78 PAYMENTS ENTERPRISE';
  const activeBankName = platformConfig?.bankName || 'HDFC BANK';
  const activeBankAccount = platformConfig?.bankAccountNumber || '50200078451290';
  const activeBankIfsc = platformConfig?.bankIfsc || 'HDFC0001780';

  const [depAmount, setDepAmount] = useState('100');
  const [depMode, setDepMode] = useState<'upi' | 'bank'>('upi');
  const [depStep, setDepStep] = useState<'select' | 'pay'>('select');
  const [depUpiApp, setDepUpiApp] = useState<string>('PhonePe');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [depRef, setDepRef] = useState('');
  const [depScreenshotData, setDepScreenshotData] = useState('');
  const [depScreenshotName, setDepScreenshotName] = useState('');

  const [wdAmount, setWdAmount] = useState('110');
  const [wdMode, setWdMode] = useState<'upi' | 'bank'>('upi');
  const [wdUpiApp, setWdUpiApp] = useState<string>('PhonePe');
  const [wdUpiId, setWdUpiId] = useState(user?.savedUpiId || '');
  const [savedUpiInput, setSavedUpiInput] = useState(user?.savedUpiId || '');
  const [depSubmittedModal, setDepSubmittedModal] = useState<{
    transaction: TransactionRecord;
    pendingBonus: number;
  } | null>(null);

  // Bank Account form fields
  const [accountHolder, setAccountHolder] = useState(user?.bankAccount?.accountHolder || '');
  const [accountNumber, setAccountNumber] = useState(user?.bankAccount?.accountNumber || '');
  const [ifsc, setIfsc] = useState(user?.bankAccount?.ifsc || '');
  const [bankName, setBankName] = useState(user?.bankAccount?.bankName || '');

  // Change Password form fields (inside Profile Settings)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [presets, setPresets] = useState<string[]>(
    (user?.stakePresets || [10, 50, 100, 500]).map(String)
  );

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user?.savedUpiId) {
      setSavedUpiInput(user.savedUpiId);
      setWdUpiId((prev) => prev || user.savedUpiId || '');
    }
    if (user?.bankAccount) {
      setAccountHolder((prev) => prev || user.bankAccount?.accountHolder || '');
      setAccountNumber((prev) => prev || user.bankAccount?.accountNumber || '');
      setIfsc((prev) => prev || user.bankAccount?.ifsc || '');
      setBankName((prev) => prev || user.bankAccount?.bankName || '');
    }
  }, [user?.savedUpiId, user?.bankAccount]);

  const handleBack = () => {
    setMsg(null);
    setDepStep('select');
    if (page === 'menu') {
      onBackHome();
    } else {
      onNavigate('menu');
    }
  };

  const buildUpiUri = (amt: number) =>
    `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=AD78&am=${amt.toFixed(2)}&cu=INR&tn=AD78Deposit`;

  const handleProceedDeposit = async () => {
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(depAmount);
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT || amt > MAX_DEPOSIT) {
      setMsg({
        type: 'err',
        text: `Deposit amount must be between ₹${MIN_DEPOSIT} and ₹${MAX_DEPOSIT.toLocaleString('en-IN')}.`,
      });
      return;
    }

    if (depMode === 'upi') {
      try {
        const upiUri = buildUpiUri(amt);
        const url = await QRCode.toDataURL(upiUri, {
          width: 220,
          margin: 2,
          color: { dark: '#09101d', light: '#ffffff' },
        });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl('');
      }
    }
    setDepStep('pay');
  };

  const handleLaunchUpiApp = (appName: 'PhonePe' | 'Google Pay' | 'Paytm') => {
    const amt = Number(depAmount) || MIN_DEPOSIT;
    const query = `pa=${encodeURIComponent(activeUpiId)}&pn=AD78&am=${amt.toFixed(2)}&cu=INR&tn=AD78Deposit`;
    const schemeMap: Record<'PhonePe' | 'Google Pay' | 'Paytm', string> = {
      PhonePe: `phonepe://pay?${query}`,
      'Google Pay': `tez://upi/pay?${query}`,
      Paytm: `paytmmp://pay?${query}`,
    };
    setDepUpiApp(appName);
    setMsg({
      type: 'ok',
      text: `Opening ${appName} for ₹${amt.toFixed(0)}... Upload payment screenshot & enter UTR below.`,
    });
    const link = document.createElement('a');
    link.href = schemeMap[appName];
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDepScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Payment screenshot image must be under 2 MB.' });
      return;
    }
    setDepScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDepScreenshotData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(depAmount);
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT || amt > MAX_DEPOSIT) {
      setMsg({
        type: 'err',
        text: `Deposit amount must be between ₹${MIN_DEPOSIT} and ₹${MAX_DEPOSIT.toLocaleString('en-IN')}.`,
      });
      return;
    }
    if (depRef.trim().length < 4) {
      setMsg({ type: 'err', text: 'Enter your 12-digit UTR / Payment Reference number.' });
      return;
    }
    if (depMode === 'upi' && !depScreenshotData) {
      setMsg({ type: 'err', text: 'Please upload your UPI payment screenshot image along with the UTR.' });
      return;
    }
    const methodLabel = depMode === 'upi' ? `${depUpiApp} UPI` : 'Bank Account IMPS/NEFT';
    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: amt,
          method: methodLabel,
          reference: depRef.trim(),
          screenshotData: depMode === 'upi' ? depScreenshotData : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deposit failed');
      onBalanceUpdate(data.balance);
      setDepRef('');
      setDepScreenshotData('');
      setDepScreenshotName('');
      setDepStep('select');
      onRefreshHistory();
      setDepSubmittedModal({
        transaction: data.transaction,
        pendingBonus: Number(data.pendingBonus || 0),
      });
      setMsg({
        type: 'ok',
        text: `Deposit Submitted (Processing) · Process ID: ${data.transaction?.id} · User ID: ${user.id}`,
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Deposit failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveUpiId = async (upiValue: string) => {
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const clean = upiValue.trim();
    if (clean.length < 5 || !clean.includes('@')) {
      setMsg({ type: 'err', text: 'Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis).' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ savedUpiId: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save UPI ID');
      onUserUpdate(data.user);
      setWdUpiId(clean);
      setSavedUpiInput(clean);
      setMsg({ type: 'ok', text: `UPI ID (${clean}) saved to your profile for withdrawals!` });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save UPI ID' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (!currentPassword.trim()) {
      setMsg({ type: 'err', text: 'Enter your current password.' });
      return;
    }
    const pCheck = validateMixedPassword(newPassword);
    if (!pCheck.valid) {
      setMsg({ type: 'err', text: pCheck.error || 'New password must mix letters and numbers.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setMsg({ type: 'err', text: 'Confirm new password does not match.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMsg({ type: 'ok', text: 'Password updated successfully!' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBankAccount = async () => {
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          accountHolder: accountHolder.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          bankName: bankName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save bank account');
      onUserUpdate(data.user);
      setMsg({ type: 'ok', text: 'Bank Account saved successfully for withdrawals!' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save bank account' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const amt = Number(wdAmount);
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAWAL) {
      setMsg({ type: 'err', text: `Minimum withdrawal is ₹${MIN_WITHDRAWAL}.` });
      return;
    }
    if (user.balance < amt) {
      setMsg({ type: 'err', text: 'Insufficient balance for this withdrawal.' });
      return;
    }

    let method = `${wdUpiApp} UPI`;
    let accountDetail = wdUpiId.trim();

    if (wdMode === 'bank') {
      const holder = accountHolder.trim() || user.bankAccount?.accountHolder || '';
      const accNo = accountNumber.trim() || user.bankAccount?.accountNumber || '';
      const ifscCode = (ifsc.trim() || user.bankAccount?.ifsc || '').toUpperCase();
      const bName = bankName.trim() || user.bankAccount?.bankName || '';

      if (!holder || !accNo || !ifscCode || !bName) {
        setMsg({
          type: 'err',
          text: 'Please fill in Account Holder Name, Account Number, IFSC Code, and Bank Name.',
        });
        return;
      }
      method = `Bank (${bName})`;
      accountDetail = `${holder} · A/C ${accNo} · IFSC ${ifscCode}`;
    } else if (accountDetail.length < 5) {
      setMsg({ type: 'err', text: 'Enter a valid UPI ID (e.g. mobile@ybl or name@okaxis).' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, method, accountDetail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      onBalanceUpdate(data.balance);
      onRefreshHistory();
      setMsg({
        type: 'ok',
        text: `Withdrawal Processing · Process ID: ${data.transaction?.id} · User ID: ${user.id} · ₹${amt} to ${method}`,
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Withdrawal failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePresets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const nums = presets.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 10000)) {
      setMsg({ type: 'err', text: 'Each stake preset must be between ₹1 and ₹10,000.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/stakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stakePresets: nums }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      onUserUpdate(data.user);
      setMsg({ type: 'ok', text: 'Quick stake settings saved!' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const pageTitle =
    page === 'menu'
      ? 'Account Menu'
      : MENU_ITEMS.find((m) => m.id === page)?.label || 'Account';

  return (
    <div className="min-h-screen bg-[#09101d] text-white pb-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f172a]/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <h1 className="text-base sm:text-lg font-bold text-white">{pageTitle}</h1>

        {user ? (
          <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white tabular-nums">
            ₹{user.balance.toFixed(2)}
          </div>
        ) : (
          <button
            onClick={onRequireAuth}
            className="rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            Login
          </button>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {msg && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-semibold border ${
              msg.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* ACCOUNT MENU LIST */}
        {page === 'menu' && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 text-xs font-bold tracking-wider text-slate-300 uppercase">
              Account &amp; Wallet
            </div>
            <div className="divide-y divide-white/5">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMsg(null);
                      if (!user && item.id !== 'rules' && item.id !== 'promotions') {
                        onRequireAuth();
                        return;
                      }
                      onNavigate(item.id);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#091224] border border-cyan-500/30 text-cyan-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                );
              })}

              {/* 24x7 Support shortcut inside Account Menu */}
              <button
                onClick={onOpenSupport}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#091224] border border-cyan-500/30 text-cyan-300">
                    <Headphones className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-white">24×7 Support (Complaint / Screenshot)</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {user && (
                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-rose-500/10 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                      <LogOut className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-rose-300">Logout</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-rose-500/60" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* DEPOSIT SCREEN (STEP 1: SELECT METHOD & AMOUNT -> PROCEED -> STEP 2: QR/APP OR BANK) */}
        {page === 'deposit' && (
          <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Deposit</h2>
                <p className="text-xs text-slate-300">
                  Min ₹{MIN_DEPOSIT} · Max ₹{MAX_DEPOSIT.toLocaleString('en-IN')}
                </p>
              </div>
              <span className="rounded-lg bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-xs font-semibold text-amber-200">
                Admin Verified
              </span>
            </div>

            {depStep === 'select' ? (
              <div className="space-y-4">
                {/* Step 1: Only Method Selection & Amount */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Choose Deposit Method
                  </label>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#08101f] p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDepMode('upi')}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${
                        depMode === 'upi' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>UPI Payment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepMode('bank')}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${
                        depMode === 'bank' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span>Bank Account (+₹1–₹2)</span>
                    </button>
                  </div>
                </div>

                {depMode === 'bank' && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                    <Gift className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span>
                      Bank Account deposits include an instant extra bonus: <strong>+₹1</strong> (under ₹500) or <strong>+₹2</strong> (₹500+).
                    </span>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Enter Manual Deposit Amount (₹100 – ₹50,000)
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={50000}
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    placeholder="Minimum ₹100"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-base font-semibold text-white focus:outline-none focus:border-cyan-400"
                  />
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {[100, 500, 1000, 5000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDepAmount(String(v))}
                        className={`rounded-lg py-2 text-xs font-semibold transition ${
                          Number(depAmount) === v
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-white/10 text-white hover:bg-cyan-500/20'
                        }`}
                      >
                        ₹{v}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedDeposit}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
                >
                  Proceed to Pay ₹{depAmount || 0}
                </button>
              </div>
            ) : (
              <form onSubmit={handleDeposit} className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-[#08101f] border border-white/10 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDepStep('select');
                      setMsg(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Change Amount / Method</span>
                  </button>
                  <span className="text-sm font-bold text-white tabular-nums">
                    Payable: ₹{Number(depAmount || 0).toFixed(2)}
                  </span>
                </div>

                {depMode === 'upi' ? (
                  <div className="space-y-3">
                    {/* Scannable QR Code generated for exact amount */}
                    <div className="flex flex-col items-center rounded-2xl bg-[#08101f] border border-cyan-500/30 p-4 text-center space-y-2.5">
                      <div className="text-xs font-bold text-cyan-300">
                        Scan QR Code with Any UPI App (₹{Number(depAmount || 0).toFixed(0)})
                      </div>
                      {qrDataUrl ? (
                        <div className="rounded-xl bg-white p-2 shadow-lg">
                          <img
                            src={qrDataUrl}
                            alt={`UPI QR Code for ₹${depAmount}`}
                            className="h-44 w-44 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-white/10 text-xs text-slate-300">
                          QR Ready
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-white font-semibold">
                        <span>{activeUpiId}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeUpiId);
                            setMsg({ type: 'ok', text: 'AD78 UPI ID copied!' });
                          }}
                          className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[11px] text-cyan-300"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                    </div>

                    {/* Direct Tap to Open PhonePe / Google Pay / Paytm */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Smartphone className="h-3.5 w-3.5 text-cyan-300" />
                        <span>Tap to Pay via UPI App</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleLaunchUpiApp('PhonePe')}
                          className={`rounded-xl py-2.5 px-2 text-xs font-bold border transition ${
                            depUpiApp === 'PhonePe'
                              ? 'bg-[#5f259f] text-white border-purple-300'
                              : 'bg-[#08101f] text-white border-white/15 hover:bg-white/10'
                          }`}
                        >
                          PhonePe
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchUpiApp('Google Pay')}
                          className={`rounded-xl py-2.5 px-2 text-xs font-bold border transition ${
                            depUpiApp === 'Google Pay'
                              ? 'bg-[#1a73e8] text-white border-blue-300'
                              : 'bg-[#08101f] text-white border-white/15 hover:bg-white/10'
                          }`}
                        >
                          Google Pay
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLaunchUpiApp('Paytm')}
                          className={`rounded-xl py-2.5 px-2 text-xs font-bold border transition ${
                            depUpiApp === 'Paytm'
                              ? 'bg-[#00baf2] text-slate-950 border-cyan-200'
                              : 'bg-[#08101f] text-white border-white/15 hover:bg-white/10'
                          }`}
                        >
                          Paytm
                        </button>
                      </div>
                    </div>

                    {/* Upload UPI Payment Screenshot Image (checked in Admin Panel) */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-white">
                        Upload UPI Payment Screenshot *
                      </label>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-400/50 bg-[#08101f] px-4 py-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 transition">
                        <ImagePlus className="h-4 w-4" />
                        <span>
                          {depScreenshotName
                            ? `Uploaded: ${depScreenshotName}`
                            : 'Choose Payment Screenshot Image'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDepScreenshotChange}
                          className="hidden"
                        />
                      </label>
                      {depScreenshotData && (
                        <img
                          src={depScreenshotData}
                          alt="UPI payment screenshot preview"
                          className="mt-2 max-h-40 rounded-xl border border-white/15 object-contain"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#08101f] border border-white/10 p-4 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300">
                          AD78 Official Bank Account (IMPS / NEFT)
                        </span>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          +₹{Number(depAmount) >= 500 ? 2 : 1} Bonus
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Transfer Amount</span>
                        <span className="font-bold text-white tabular-nums">
                          ₹{Number(depAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Holder</span>
                        <span className="font-semibold text-white">{activeBankHolder}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bank Name</span>
                        <span className="font-semibold text-white">{activeBankName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Account Number</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeBankAccount);
                            setMsg({ type: 'ok', text: 'Bank Account Number copied!' });
                          }}
                          className="inline-flex items-center gap-1.5 font-bold text-white"
                        >
                          <span>{activeBankAccount}</span>
                          <Copy className="h-3 w-3 text-cyan-300" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">IFSC Code</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(activeBankIfsc);
                            setMsg({ type: 'ok', text: 'IFSC Code copied!' });
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-white"
                        >
                          <span>{activeBankIfsc}</span>
                          <Copy className="h-3 w-3 text-cyan-300" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    UTR / Transaction Reference Number *
                  </label>
                  <input
                    type="text"
                    value={depRef}
                    onChange={(e) => setDepRef(e.target.value)}
                    placeholder="Enter 12-digit UTR number after payment"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {submitting
                      ? 'Submitting Deposit...'
                      : `Submit Deposit ₹${depAmount || 0}`}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* WITHDRAWAL SCREEN (MIN ₹110 + UPI Apps & Bank Account) */}
        {page === 'withdraw' && (
          <form
            onSubmit={handleWithdraw}
            className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Withdrawal</h2>
                <p className="text-xs text-slate-300">Minimum Withdrawal: ₹{MIN_WITHDRAWAL}</p>
              </div>
              <span className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                Min ₹110
              </span>
            </div>

            <div className="rounded-xl bg-[#08101f] border border-white/10 p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-300">Withdrawable Balance</span>
              <span className="text-lg font-bold text-white tabular-nums">
                ₹{user?.balance.toFixed(2) || '0.00'}
              </span>
            </div>

            {/* Payout Mode Selector: UPI Apps vs Bank Account */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#08101f] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setWdMode('upi')}
                className={`rounded-lg py-2.5 text-xs font-bold transition ${
                  wdMode === 'upi' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
                }`}
              >
                UPI (PhonePe / Paytm / GPay)
              </button>
              <button
                type="button"
                onClick={() => setWdMode('bank')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${
                  wdMode === 'bank' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Bank Account</span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white">
                Withdrawal Amount (₹110 minimum)
              </label>
              <input
                type="number"
                min={110}
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-base font-semibold text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {wdMode === 'upi' ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Select UPI App
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {UPI_APPS.map((app) => (
                      <button
                        key={app}
                        type="button"
                        onClick={() => setWdUpiApp(app)}
                        className={`rounded-xl py-2 px-2 text-xs font-semibold border transition ${
                          wdUpiApp === app
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                            : 'bg-[#08101f] text-white border-white/15'
                        }`}
                      >
                        {app}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-white">
                      Your {wdUpiApp} UPI ID *
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSaveUpiId(wdUpiId)}
                      disabled={submitting}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-white/20"
                    >
                      Save UPI ID
                    </button>
                  </div>
                  <input
                    type="text"
                    value={wdUpiId}
                    onChange={(e) => setWdUpiId(e.target.value)}
                    placeholder="e.g. 9876543210@ybl or name@okicici"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-[#08101f] border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Bank Account Details</span>
                  <button
                    type="button"
                    onClick={handleSaveBankAccount}
                    disabled={submitting}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-white/20"
                  >
                    Save Bank Info
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">Account Holder Name *</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Full name as per bank passbook"
                    className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">Bank Account Number *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter Bank Account Number"
                    className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">IFSC Code *</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white uppercase focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">Bank Name *</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      className="w-full rounded-xl bg-[#101a2f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
            >
              {submitting ? 'Submitting...' : `Submit Withdrawal ₹${wdAmount || 0}`}
            </button>
          </form>
        )}

        {/* BANK ACCOUNT SECTION */}
        {page === 'bank' && (
          <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Bank Account Settings</h2>
              <p className="text-xs text-slate-300">
                Save your bank account details once for instant withdrawals.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Account Holder Name *</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Full name as per bank passbook"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Bank Account Number *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter Bank Account Number"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">IFSC Code *</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white uppercase focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-300">Bank Name *</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveBankAccount}
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950"
            >
              {submitting ? 'Saving...' : 'Save Bank Account'}
            </button>
          </div>
        )}

        {/* MY WALLET */}
        {page === 'wallet' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#0e2a38] to-[#0a1426] border border-cyan-400/30 p-5 space-y-4">
              <div className="text-xs text-slate-300">Total Available Balance</div>
              <div className="text-4xl font-bold text-white tabular-nums">
                ₹{user?.balance.toFixed(2) || '0.00'}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => onNavigate('deposit')}
                  className="rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950"
                >
                  Deposit (Min ₹100)
                </button>
                <button
                  onClick={() => onNavigate('withdraw')}
                  className="rounded-xl bg-white/10 border border-white/20 py-3 text-sm font-bold text-white"
                >
                  Withdraw (Min ₹110)
                </button>
              </div>
            </div>

            {user?.bankAccount && (
              <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4 space-y-1 text-xs">
                <div className="font-bold text-white">Saved Bank Account</div>
                <div className="text-slate-300">
                  Holder: {user.bankAccount.accountHolder} · {user.bankAccount.bankName}
                </div>
                <div className="text-slate-300">
                  A/C: {user.bankAccount.accountNumber} · IFSC: {user.bankAccount.ifsc}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MY BETS / TURNOVER */}
        {(page === 'bets' || page === 'turnover') && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 divide-y divide-white/5">
            {bets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No bets recorded yet.</div>
            ) : (
              bets.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <div className="font-bold text-white uppercase">
                      {b.game === 'aviator' ? 'Aviator' : `WinGo ${b.mode || ''}`} · {b.selection}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
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
              ))
            )}
          </div>
        )}

        {/* BETTING PROFIT & LOSS (PLUS / MINUS) */}
        {page === 'pnl' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4">
              <div className="text-xs text-slate-300">Total Turnover</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                ₹{summary.totalTurnover.toFixed(2)}
              </div>
            </div>
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4">
              <div className="text-xs text-slate-300">Total Winnings</div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">
                ₹{summary.totalPayout.toFixed(2)}
              </div>
            </div>
            <div className="col-span-2 rounded-2xl bg-[#101a2f] border border-white/10 p-4">
              <div className="text-xs text-slate-300">Net Profit &amp; Loss (+/-)</div>
              <div
                className={`mt-1 text-3xl font-bold tabular-nums ${
                  summary.netProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.netProfitLoss >= 0 ? '+' : ''}₹{summary.netProfitLoss.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* TRANSACTIONS / ACCOUNT STATEMENT / BONUS STATEMENT */}
        {(page === 'transactions' || page === 'statement' || page === 'bonus') && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 divide-y divide-white/5">
            {transactions.filter((t) => (page === 'bonus' ? t.type === 'bonus' : true)).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No transactions yet.</div>
            ) : (
              transactions
                .filter((t) => (page === 'bonus' ? t.type === 'bonus' : true))
                .map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 p-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-white uppercase">
                        {t.type} · {t.method || 'Wallet'}
                      </div>
                      <div className="text-[11px] text-cyan-300 font-semibold tabular-nums">
                        Process ID: {t.id} · User ID: {t.userId}
                      </div>
                      {t.reference && (
                        <div className="text-[11px] text-slate-200 tabular-nums">
                          UTR / Ref: {t.reference}
                        </div>
                      )}
                      {(t.note || t.accountDetail) && (
                        <div className="text-[11px] text-slate-300">
                          {t.note || t.accountDetail}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white tabular-nums">
                        ₹{t.amount.toFixed(2)}
                      </div>
                      <span
                        className={`inline-block mt-0.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          t.status === 'approved' || t.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : t.status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {t.status === 'pending'
                          ? 'PROCESSING'
                          : t.status === 'approved'
                          ? 'SUCCESS'
                          : t.status}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* AFFILIATE PROGRAM */}
        {page === 'affiliate' && (
          <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-white">AD78 Affiliate Program</h2>
                <p className="text-xs text-slate-300">Earn daily commission on friend turnover</p>
              </div>
            </div>
            <div className="rounded-xl bg-[#08101f] p-4 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">Your Referral Code</div>
                <div className="text-xl font-bold text-white">
                  {user?.referralCode || 'AD78'}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${window.location.origin}/?ref=${user?.referralCode || ''}`
                  );
                  setMsg({ type: 'ok', text: 'Affiliate invite link copied!' });
                }}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}

        {/* PROMOTIONS */}
        {page === 'promotions' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gradient-to-r from-[#0e3242] to-[#101a2f] border border-cyan-500/30 p-5">
              <div className="text-xs font-bold text-amber-400 uppercase">Welcome Offer</div>
              <h3 className="mt-1 text-xl font-bold text-white">Deposit Rewards</h3>
              <p className="mt-1 text-xs text-slate-300">
                Deposit ₹100 or more via UPI or Bank Account to start playing and earn Bank Deposit bonus rewards.
              </p>
            </div>
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-5">
              <div className="text-xs font-bold text-emerald-400 uppercase">Live Games</div>
              <h3 className="mt-1 text-lg font-bold text-white">WinGo &amp; Aviator</h3>
              <p className="mt-1 text-xs text-slate-300">
                Play WinGo (₹1 – ₹5,000) and Aviator (Min ₹10) with verified Deposit &amp; Withdrawal.
              </p>
            </div>
          </div>
        )}

        {/* STAKE SETTINGS */}
        {page === 'stakes' && (
          <form
            onSubmit={handleSavePresets}
            className="rounded-2xl bg-[#101a2f] border border-white/10 p-5 space-y-4"
          >
            <h2 className="text-lg font-bold text-white">Quick Stake Presets</h2>
            <p className="text-xs text-slate-300">
              Customize your 4 quick bet buttons shown on WinGo betting slips.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {presets.map((val, i) => (
                <div key={i}>
                  <label className="mb-1 block text-xs text-slate-300">Button {i + 1} (₹)</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={val}
                    onChange={(e) => {
                      const next = [...presets];
                      next[i] = e.target.value;
                      setPresets(next);
                    }}
                    className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3 py-2.5 text-sm font-bold text-white"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950"
            >
              Save Stake Settings
            </button>
          </form>
        )}

        {/* GAME RULES */}
        {page === 'rules' && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
            <h2 className="text-base font-bold text-white">AD78 Platform Rules</h2>
            <p>1. WinGo Color Prediction supports 30 Sec, 1 Min, and 3 Min synchronized rounds with ₹1 to ₹5,000 manual bets.</p>
            <p>2. Aviator supports live synchronized flights with ₹10 minimum bet.</p>
            <p>3. Auto Deposit accepts ₹100 to ₹50,000 via UPI (PhonePe/Paytm/Google Pay) or Bank Account.</p>
            <p>4. Auto Withdrawal minimum is ₹110 to UPI or Bank Account. 24×7 Support is available for any issue.</p>
          </div>
        )}

        {/* PROFILE SETTINGS + SAVED UPI + CHANGE PASSWORD */}
        {page === 'profile' && user && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-5 space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">User ID</span>
                <span className="font-bold text-cyan-300 tabular-nums">{user.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Username</span>
                <span className="font-bold text-white">{user.username}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Verified Mobile</span>
                <span className="font-bold text-white">{user.mobile}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Referral Code</span>
                <span className="font-bold text-white">{user.referralCode}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-300">Joined</span>
                <span className="text-white">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => onNavigate('bank')}
                  className="rounded-xl bg-white/10 py-2.5 font-semibold text-white hover:bg-white/20"
                >
                  Bank Account
                </button>
                <button
                  onClick={() => onNavigate('statement')}
                  className="rounded-xl bg-white/10 py-2.5 font-semibold text-white hover:bg-white/20"
                >
                  Account Statement
                </button>
              </div>
            </div>

            {/* Saved UPI ID for Withdrawals */}
            <div className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Saved UPI ID (Withdrawals)</h3>
                {user.savedUpiId && (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Saved
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={savedUpiInput}
                  onChange={(e) => setSavedUpiInput(e.target.value)}
                  placeholder="Enter your UPI ID (e.g. 9876543210@ybl)"
                  className="flex-1 rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveUpiId(savedUpiInput)}
                  className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:brightness-110 transition"
                >
                  Save UPI
                </button>
              </div>
            </div>

            <form
              onSubmit={handleChangePassword}
              className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-bold text-white">Change Account Password</h3>
              </div>
              <p className="text-[11px] text-slate-300">
                Passwords can only be changed here inside your account or by AD78 Admin.
              </p>

              <div>
                <label className="mb-1 block text-xs text-slate-300">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  New Password (Letters + Numbers)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 chars, e.g. ad78new"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950 hover:brightness-110 transition"
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* DEPOSIT SUBMITTED (PROCESSING) POPUP MODAL */}
      {depSubmittedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setDepSubmittedModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-amber-400/50 bg-[#0d182d] p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-wider">
                  Deposit Processing
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDepSubmittedModal(null)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20"
                aria-label="Close deposit popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#08101f] border border-white/10 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-extrabold text-amber-300 uppercase">Processing</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount</span>
                <span className="font-bold text-white tabular-nums">
                  ₹{depSubmittedModal.transaction.amount.toFixed(2)}
                  {depSubmittedModal.pendingBonus > 0
                    ? ` (+₹${depSubmittedModal.pendingBonus} Bonus)`
                    : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Process ID</span>
                <span className="font-bold text-cyan-300 tabular-nums">
                  {depSubmittedModal.transaction.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">User ID</span>
                <span className="font-bold text-white tabular-nums">
                  {depSubmittedModal.transaction.userId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UTR Number</span>
                <span className="font-bold text-white tabular-nums">
                  {depSubmittedModal.transaction.reference}
                </span>
              </div>
            </div>

            {depSubmittedModal.transaction.screenshotData && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-300">
                  Submitted Payment Screenshot
                </div>
                <img
                  src={depSubmittedModal.transaction.screenshotData}
                  alt="Submitted deposit screenshot"
                  className="max-h-40 w-full rounded-xl border border-white/15 bg-[#08101f] object-contain"
                />
              </div>
            )}

            <p className="text-[11px] text-slate-300 text-center">
              Your wallet will update to <strong>Success</strong> once verified &amp; approved in the Admin Panel.
            </p>

            <button
              type="button"
              onClick={() => {
                setDepSubmittedModal(null);
                onNavigate('transactions');
              }}
              className="w-full rounded-xl bg-amber-400 py-3 text-xs font-extrabold text-slate-950 hover:brightness-110 transition"
            >
              View Processing Status in History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
