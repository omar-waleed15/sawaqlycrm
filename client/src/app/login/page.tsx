'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12 text-[#0F172A] select-none font-sans">
      <div className="w-full max-w-[390px] border border-[#E2E8F0] bg-white p-8 shadow-xl rounded-xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="Sawaqly Marketing Agency" className="size-full object-contain" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0F172A]">Sawaqly</h2>
            <p className="text-[9px] text-[#1D61E7] uppercase tracking-wider font-extrabold font-mono">Marketing Agency</p>
            <p className="text-[8px] text-[#64748B] uppercase tracking-widest font-mono">Agency Team Dashboard</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[10px] uppercase font-mono tracking-wider px-3.5 py-2.5 rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-start">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] font-mono">
              {t('login.emailAddress')}
            </label>
            <input
              id="email"
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="bg-white border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] focus:border-[#1D61E7] focus:ring-2 focus:ring-[#1D61E7]/25 outline-none text-xs h-10 px-3 transition-all rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] font-mono">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-white border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] focus:border-[#1D61E7] focus:ring-2 focus:ring-[#1D61E7]/25 outline-none text-xs h-10 px-3 transition-all rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="w-full h-10 bg-[#FFD200] hover:bg-[#E6BD00] text-[#111827] font-bold uppercase tracking-widest text-[10px] mt-2 transition-colors duration-250 flex items-center justify-center rounded-lg font-mono shadow-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-2" />
                {t('login.signingIn')}
              </>
            ) : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
