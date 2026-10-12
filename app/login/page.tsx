'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

const DEMO_CREDENTIALS = [
  { label: 'Admin', username: 'user_admin', password: 'Admin@Secure123' },
  { label: 'Manager', username: 'user_manager', password: 'Manager@Secure123' },
  { label: 'Cashier', username: 'user_cashier', password: 'Cashier@Secure123' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('user_admin');
  const [password, setPassword] = useState('Admin@Secure123');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(username, password);
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Invalid username or password');
    }
    setLoading(false);
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[380px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-semibold text-base shadow-sm">
            SP
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">StockPulse</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                  placeholder="user_admin"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo shortcuts */}
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2.5">
              Fill demo credentials
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_CREDENTIALS.map((d) => (
                <button
                  key={d.username}
                  type="button"
                  onClick={() => fillDemo(d.username, d.password)}
                  className="py-1.5 px-2.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors text-center"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          StockPulse &middot; Internal retail management
        </p>
      </div>
    </div>
  );
}
