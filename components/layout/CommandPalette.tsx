'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Package,
  Users,
  ShoppingCart,
  X,
  Boxes,
  History,
  FileBarChart,
  ShieldAlert,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<{ products: any[]; customers: any[]; sales: any[] }>({
    products: [],
    customers: [],
    sales: [],
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQueryText('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!queryText.trim() || queryText.length < 2) {
      setResults({ products: [], customers: [], sales: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(queryText)}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        }
      } catch {
        // quiet error
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [queryText]);

  if (!isOpen) return null;

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

  const pages = [
    { name: 'New sale', path: '/pos', icon: ShoppingCart },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Sales ledger', path: '/sales', icon: History },
    { name: 'Reports', path: '/reports', icon: FileBarChart },
    { name: 'Transaction demo', path: '/acid-demo', icon: ShieldAlert },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60">
      <div className="w-full max-w-xl rounded-lg bg-card border border-border shadow-xl overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border gap-2.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search products, customers, orders..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          {queryText && (
            <button
              onClick={() => setQueryText('')}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3">
          {loading && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Searching...
            </div>
          )}

          {/* Quick Navigation Pages */}
          {!queryText && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1.5">
                Navigation
              </p>
              <div className="grid grid-cols-2 gap-1">
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.path}
                      onClick={() => navigateTo(p.path)}
                      className="flex items-center gap-2.5 p-2 rounded-md text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Results */}
          {results.products.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1.5">
                Products ({results.products.length})
              </p>
              <div className="space-y-0.5">
                {results.products.map((prod) => (
                  <button
                    key={prod.product_id}
                    onClick={() => navigateTo(`/products?q=${encodeURIComponent(prod.product_name)}`)}
                    className="w-full flex items-center justify-between p-2 rounded-md text-left text-xs hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {prod.product_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {prod.category_name} • {prod.quantity_in_hand} in stock
                      </p>
                    </div>
                    <span className="font-mono text-muted-foreground text-xs">
                      {formatCurrency(prod.unit_price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customers Results */}
          {results.customers.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1.5">
                Customers ({results.customers.length})
              </p>
              <div className="space-y-0.5">
                {results.customers.map((cust) => (
                  <button
                    key={cust.customer_id}
                    onClick={() => navigateTo(`/customers?q=${encodeURIComponent(cust.customer_name)}`)}
                    className="w-full flex items-center justify-between p-2 rounded-md text-left text-xs hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {cust.customer_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {cust.phone}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {cust.customer_tier || 'Customer'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sales Results */}
          {results.sales.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1.5">
                Sales ({results.sales.length})
              </p>
              <div className="space-y-0.5">
                {results.sales.map((sale) => (
                  <button
                    key={sale.sales_id}
                    onClick={() => navigateTo(`/sales?q=${sale.sales_id}`)}
                    className="w-full flex items-center justify-between p-2 rounded-md text-left text-xs hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground font-mono">
                        Order #{sale.sales_id}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {sale.customer_name} • {sale.payment_mode}
                      </p>
                    </div>
                    <span className="font-mono text-foreground font-medium text-xs">
                      {formatCurrency(sale.total_amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
