'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { TierBadge } from '@/components/ui/Badge';
import { formatCurrency, formatCompactCurrency, formatDate, downloadCSV } from '@/lib/utils';
import {
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
} from 'recharts';

type ReportType =
  | 'sales_summary'
  | 'product_performance'
  | 'inventory_valuation'
  | 'supplier_performance'
  | 'top_customers';

export default function ReportsPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ReportType>('sales_summary');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  const loadReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${type}`);
      const json = await res.json();
      if (res.ok) {
        setReportData(json.data || []);
      } else {
        addToast(json.error || 'Failed to load report data', 'error');
      }
    } catch {
      addToast('Error loading report', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadReport(activeTab);
    }
  }, [user, activeTab, loadReport]);

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      addToast('No data to export', 'warning');
      return;
    }
    downloadCSV(`${activeTab}_report`, reportData);
    addToast('Report exported to CSV', 'success');
  };

  const tabs = [
    { id: 'sales_summary' as ReportType, label: 'Sales & revenue' },
    { id: 'product_performance' as ReportType, label: 'Product performance' },
    { id: 'inventory_valuation' as ReportType, label: 'Inventory valuation' },
    { id: 'supplier_performance' as ReportType, label: 'Supplier sourcing' },
    { id: 'top_customers' as ReportType, label: 'Customer tiers' },
  ];



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aggregated business metrics from PostgreSQL analytical views.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadReport(activeTab)}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border scrollbar-none">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Sales & Revenue */}
        {activeTab === 'sales_summary' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-foreground mb-1">Daily revenue trajectory</h3>
              <p className="text-xs text-muted-foreground mb-4">Historical daily net revenue</p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[...reportData].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="sale_date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(d) => formatDate(d)}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
                            <p className="text-muted-foreground mb-1">{formatDate(label)}</p>
                            <p className="font-semibold text-foreground">
                              Net revenue: {formatCurrency(payload[0]?.value as any)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="net_revenue" name="Net revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} barSize={12} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Date</th>
                      <th className="py-2.5 px-4 font-medium text-center">Orders</th>
                      <th className="py-2.5 px-4 font-medium text-center">Units</th>
                      <th className="py-2.5 px-4 font-medium text-right">Gross revenue</th>
                      <th className="py-2.5 px-4 font-medium text-right">Discounts</th>
                      <th className="py-2.5 px-4 font-medium text-right">Net revenue</th>
                      <th className="py-2.5 px-4 font-medium text-right">Avg order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{formatDate(row.sale_date)}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_orders}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_units_sold}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.gross_revenue)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{row.total_discounts > 0 ? `-${formatCurrency(row.total_discounts)}` : '—'}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium text-foreground">{formatCurrency(row.net_revenue)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.avg_order_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Product Performance */}
        {activeTab === 'product_performance' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-foreground mb-1">Top revenue products</h3>
              <p className="text-xs text-muted-foreground mb-4">Ranked by total net revenue</p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.slice(0, 8)} layout="vertical" margin={{ left: 40, right: 30, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="product_name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={180}
                      tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      tickFormatter={(t) => (t.length > 24 ? `${t.slice(0, 24)}…` : t)}
                    />
                    <Tooltip
                      formatter={(v: any) => [formatCurrency(v), 'Net revenue']}
                      contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                    />
                    <Bar dataKey="net_revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Product</th>
                      <th className="py-2.5 px-4 font-medium">Category</th>
                      <th className="py-2.5 px-4 font-medium text-right">Price</th>
                      <th className="py-2.5 px-4 font-medium text-center">Units sold</th>
                      <th className="py-2.5 px-4 font-medium text-right">Net revenue</th>
                      <th className="py-2.5 px-4 font-medium text-center">Current stock</th>
                      <th className="py-2.5 px-4 font-medium text-right">Turnover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{row.product_name}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{row.category_name}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.unit_price)}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.units_sold}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium text-foreground">{formatCurrency(row.net_revenue)}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.current_stock_in_hand}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">{row.stock_turnover_ratio}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Inventory Valuation */}
        {activeTab === 'inventory_valuation' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Category</th>
                      <th className="py-2.5 px-4 font-medium text-center">SKUs</th>
                      <th className="py-2.5 px-4 font-medium text-center">Units in hand</th>
                      <th className="py-2.5 px-4 font-medium text-right">Avg price</th>
                      <th className="py-2.5 px-4 font-medium text-right">Min price</th>
                      <th className="py-2.5 px-4 font-medium text-right">Max price</th>
                      <th className="py-2.5 px-4 font-medium text-right">Inventory value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{row.category_name}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_sku_count}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_units_in_hand}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.avg_unit_price)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.min_unit_price)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.max_unit_price)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium text-foreground">
                          {formatCurrency(row.total_inventory_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Supplier Performance */}
        {activeTab === 'supplier_performance' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Supplier</th>
                      <th className="py-2.5 px-4 font-medium">Phone</th>
                      <th className="py-2.5 px-4 font-medium">Categories</th>
                      <th className="py-2.5 px-4 font-medium text-center">SKUs</th>
                      <th className="py-2.5 px-4 font-medium text-center">Stock units</th>
                      <th className="py-2.5 px-4 font-medium text-center">Low stock</th>
                      <th className="py-2.5 px-4 font-medium text-right">Sourced value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{row.supplier_name}</td>
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">{row.supplier_phone}</td>
                        <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[200px]">{row.categories_supplied}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_products_supplied}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_stock_units}</td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">
                          {row.low_stock_item_count > 0 ? (
                            <span className="text-amber-500 font-medium">{row.low_stock_item_count} items</span>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium text-foreground">
                          {formatCurrency(row.total_stock_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Customer Tiers */}
        {activeTab === 'top_customers' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Customer</th>
                      <th className="py-2.5 px-4 font-medium">Phone</th>
                      <th className="py-2.5 px-4 font-medium">Tier</th>
                      <th className="py-2.5 px-4 font-medium text-center">Orders</th>
                      <th className="py-2.5 px-4 font-medium text-right">Avg order</th>
                      <th className="py-2.5 px-4 font-medium text-right">Latest purchase</th>
                      <th className="py-2.5 px-4 font-medium text-right">Lifetime spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{row.customer_name}</td>
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">{row.phone}</td>
                        <td className="py-2.5 px-4">
                          <TierBadge tier={row.customer_tier || 'Bronze'} />
                        </td>
                        <td className="py-2.5 px-4 text-center tabular-nums text-muted-foreground">{row.total_orders}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{formatCurrency(row.avg_order_value)}</td>
                        <td className="py-2.5 px-4 text-right text-muted-foreground">{formatDate(row.latest_purchase_date)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium text-foreground">
                          {formatCurrency(row.total_spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
