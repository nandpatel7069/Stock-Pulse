'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  History,
  Users,
  Building2,
  FileBarChart,
  ShieldAlert,
  LogOut,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles: Array<'admin' | 'manager' | 'cashier'>;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  useEffect(() => {
    // Sync with same query as KPI card (v_low_stock from dashboard)
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (data?.kpis?.lowStockCount !== undefined) {
          setLowStockCount(data.kpis.lowStockCount);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const groups: NavGroup[] = [
    {
      label: 'Main',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier'] },
        { name: 'Reports', href: '/reports', icon: FileBarChart, roles: ['admin', 'manager'] },
        { name: 'Transaction demo', href: '/acid-demo', icon: ShieldAlert, roles: ['admin', 'manager'] },
      ],
    },
    {
      label: 'Sales',
      items: [
        { name: 'New sale', href: '/pos', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
        { name: 'Sales', href: '/sales', icon: History, roles: ['admin', 'manager', 'cashier'] },
        { name: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'manager'] },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { name: 'Products', href: '/products', icon: Package, roles: ['admin', 'manager', 'cashier'] },
        {
          name: 'Inventory',
          href: '/inventory',
          icon: Boxes,
          roles: ['admin', 'manager'],
          badge: lowStockCount > 0 ? lowStockCount : undefined,
        },
        { name: 'Suppliers', href: '/suppliers', icon: Building2, roles: ['admin', 'manager'] },
      ],
    },
  ];

  const userRole = user?.role || 'admin';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] bg-card border-r border-border flex flex-col select-none">
      {/* Brand Header */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs">
            S
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">
            StockPulse
          </span>
        </Link>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-0.5">
              <p className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground/70">
                {group.label}
              </p>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.badge !== undefined && (
                      <span className="text-xs text-muted-foreground font-mono bg-muted/80 px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer / User Profile & Role */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0 border border-border">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium truncate text-foreground leading-tight">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-muted-foreground capitalize leading-tight">
                {userRole}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors ml-1"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
