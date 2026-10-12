'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const dotVariants = {
    default: 'bg-muted-foreground',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    muted: 'bg-muted-foreground/50',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotVariants[variant])} />
      <span>{children}</span>
    </span>
  );
}

export function StockBadge({ qty, reorderLevel }: { qty: number; reorderLevel: number }) {
  if (qty === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Out of stock
      </span>
    );
  }
  if (qty <= reorderLevel) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Critical ({qty})
      </span>
    );
  }
  if (qty <= reorderLevel * 1.5) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Low stock ({qty})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {qty} in stock
    </span>
  );
}

export function PaymentBadge({ mode }: { mode: string }) {
  return (
    <span className="text-xs text-muted-foreground font-medium font-mono">
      {mode}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const isVip = tier.includes('Platinum') || tier.includes('Gold');
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border border-border',
        isVip ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted/50 text-muted-foreground'
      )}
    >
      {tier}
    </span>
  );
}
