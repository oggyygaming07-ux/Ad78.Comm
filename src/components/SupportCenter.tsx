import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Headphones, ImagePlus, Send } from 'lucide-react';
import { SupportTicket, UserProfile } from '../types';

interface SupportCenterProps {
  user: UserProfile | null;
  token: string | null;
  initialCategory?: string;
  onBack: () => void;
}

export const SupportCenter: React.FC<SupportCenterProps> = ({
  user,
  token,
  initialCategory = 'Game Issue',
  onBack,
}) => {
  const [contactName, setContactName] = useState(user?.username || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [category, setCategory] = useState(initialCategory);
  const [message, setMessage] = useState('');
  const [screenshotData, setScreenshotData] = useState<string>('');
  const [screenshotName, setScreenshotName] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadTickets = async (targetMobile?: string) => {
    try {
      const q = targetMobile ? `?mobile=${encodeURIComponent(targetMobile)}` : '';
      const res = await fetch(`/api/support/tickets${q}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadTickets(user?.mobile);
  }, [user?.mobile, token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'err', text: 'Screenshot must be under 2 MB.' });
      return;
    }
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshotData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          contactName: contactName.trim(),
          mobile: mobile.trim(),
          category,
          message: message.trim(),
          screenshotData: screenshotData || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not register complaint');

      setMessage('');
      setScreenshotData('');
      setScreenshotName('');
      setTickets((prev) => [data.ticket, ...prev]);
      setFeedback({
        type: 'ok',
        text: `Complaint Registered (${data.ticket.id}). 24x7 Support will review it shortly.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Submission failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09101d] text-white pb-20">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#0f172a]/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 text-base font-bold text-white">
          <Headphones className="h-4 w-4 text-cyan-300" />
          <span>24×7 Support</span>
        </div>

        <div className="text-xs font-semibold text-white">
          {user ? `₹${user.balance.toFixed(2)}` : 'AD78 Help'}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {feedback && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
              feedback.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{feedback.text}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#101a2f] border border-cyan-500/30 p-5 space-y-4"
        >
          <div>
            <h1 className="text-lg font-bold text-white">Register a Complaint / Support Request</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              24×7 Support for Forgot Password, Deposit, Withdrawal, or Game Issues. Attach a screenshot if needed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Username / Name *
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Your name or username"
                className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white">
                Mobile Number *
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-white">
              Problem Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="Forgot Password / Login">Forgot Password / Login</option>
              <option value="Deposit Issue">Deposit Issue</option>
              <option value="Withdrawal Issue">Withdrawal Issue</option>
              <option value="WinGo / Aviator Game Issue">WinGo / Aviator Game Issue</option>
              <option value="General Support">General Support</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-white">
              Describe Your Issue *
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write details of your issue, UTR or period number..."
              className="w-full rounded-xl bg-[#08101f] border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-white">
              Upload Screenshot (Optional)
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-400/50 bg-[#08101f] px-4 py-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 transition">
              <ImagePlus className="h-4 w-4" />
              <span>{screenshotName ? `Attached: ${screenshotName}` : 'Choose Screenshot Image'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {screenshotData && (
              <img
                src={screenshotData}
                alt="Attached screenshot preview"
                className="mt-2 max-h-40 rounded-xl border border-white/15 object-contain"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
          >
            <Send className="h-4 w-4" />
            <span>{submitting ? 'Submitting Complaint...' : 'Submit Complaint'}</span>
          </button>
        </form>

        {/* Previous Tickets */}
        {tickets.length > 0 && (
          <div className="rounded-2xl bg-[#101a2f] border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">Your Support Tickets</h2>
            <div className="divide-y divide-white/10">
              {tickets.map((t) => (
                <div key={t.id} className="py-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      {t.id} · {t.category}
                    </span>
                    <span
                      className={`font-bold uppercase ${
                        t.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-slate-300">{t.message}</p>
                  {t.adminReply && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-emerald-200">
                      Support Reply: {t.adminReply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
