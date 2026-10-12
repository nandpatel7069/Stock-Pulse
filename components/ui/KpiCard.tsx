'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: { value: string; positive: boolean };
  icon?: React.ReactNode;
}

export function KpiCard({ title, value, subtitle, change }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="mt-2.5">
        <p className="text-[28px] font-semibold text-foreground tracking-tight tabular-nums leading-none">
          {value}
        </p>
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5 truncate">
        {change && (
          <span
            className={cn(
              'font-medium',
              change.positive ? 'text-emerald-500' : 'text-rose-500'
            )}
          >
            {change.positive ? '↑' : '↓'} {change.value}
          </span>
        )}
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="h-3.5 w-24 bg-muted rounded" />
      <div className="h-7 w-32 bg-muted rounded mt-3" />
      <div className="h-3 w-28 bg-muted rounded mt-2.5" />
    </div>
  );
}
