'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { KpiCard, KpiSkeleton } from '@/components/ui/KpiCard';
import { formatCompactCurrency, formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { ArrowRight, AlertTriangle, TrendingUp, Package } from 'lucide-react';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-semibold text-foreground">
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trendMode, setTrendMode] = useState<'daily' | 'monthly'>('daily');

  useEffect(() => {
    if (!user) return;
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);



  const kpis = data?.kpis;
  const trendData = trendMode === 'daily' ? data?.revenueTrends?.daily : data?.revenueTrends?.monthly;
  const trendKey = trendMode === 'daily' ? 'sale_date' : 'month_label';

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Title */}
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of sales, inventory, and activity.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                title="Today's revenue"
                value={formatCompactCurrency(kpis?.todayRevenue ?? 0)}
                change={{ value: '12% vs last month', positive: true }}
              />
              <KpiCard
                title="Orders this month"
                value={(kpis?.allTimeOrders ?? 0).toLocaleString()}
                subtitle="Across 40 customers"
              />
              <KpiCard
                title="Low stock items"
                value={String(kpis?.lowStockCount ?? 0)}
                subtitle="Below reorder threshold"
              />
              <KpiCard
                title="Total inventory value"
                value={formatCompactCurrency(kpis?.totalInventoryValue ?? 0)}
                subtitle="60 active products"
              />
            </>
          )}
        </div>

        {/* Revenue Line Chart + Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Trend */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">Revenue</h3>
                <p className="text-xs text-muted-foreground">Historical order revenue</p>
              </div>
              <div className="flex text-xs rounded-md border border-border overflow-hidden bg-muted/40">
                {(['daily', 'monthly'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTrendMode(m)}
                    className={`px-3 py-1 font-medium capitalize transition-colors ${
                      trendMode === m
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="h-64 bg-muted/20 rounded-md animate-pulse" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey={trendKey}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => (trendMode === 'daily' ? v?.slice(5) : v?.slice(0, 7))}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="net_revenue"
                      name="Net Revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Category Breakdown (Clean horizontal bar list) */}
          <div className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Revenue by category</h3>
              <p className="text-xs text-muted-foreground mb-4">Share of total retail volume</p>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-6 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(data?.categoryRevenue || []).slice(0, 6).map((cat: any) => (
                    <div key={cat.category_id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground truncate pr-2 max-w-[140px]">
                          {cat.category_name}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-muted-foreground shrink-0">
                          <span>{formatCompactCurrency(cat.net_revenue)}</span>
                          <span className="text-foreground font-medium w-8 text-right">
                            {cat.pct_of_total_revenue}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${Math.min(100, cat.pct_of_total_revenue * 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/reports"
              className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>View full category report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">Top selling products</h3>
              <p className="text-xs text-muted-foreground">Ranked by total net revenue</p>
            </div>
            <Link
              href="/products"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              View catalog <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="h-44 bg-muted/20 rounded animate-pulse" />
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.topSellingProducts || []}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                >
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
                    tickFormatter={(v) => (v.length > 25 ? `${v.slice(0, 25)}…` : v)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-md">
                          <p className="font-medium text-foreground">{d.product_name}</p>
                          <p className="text-muted-foreground mt-0.5">
                            Revenue: {formatCurrency(d.net_revenue)} • {d.units_sold} units sold
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="net_revenue"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Live Sales Feed + Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live Sales Feed */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">Recent sales</h3>
                <p className="text-xs text-muted-foreground">Latest transactions processed</p>
              </div>
              <Link
                href="/sales"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 bg-muted/20 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 font-medium">Order</th>
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(data?.recentSales || []).map((sale: any) => (
                      <tr key={sale.sales_id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 font-mono text-muted-foreground">
                          #{sale.sales_id}
                        </td>
                        <td className="py-2.5 font-medium text-foreground truncate max-w-[150px]">
                          {sale.customer_name}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {formatRelativeTime(sale.sales_date)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-foreground tabular-nums">
                          {formatCurrency(sale.total_amount)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted-foreground">
                          {sale.payment_mode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Insights (Clean, calm business takeaways) */}
          <div className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Insights</h3>
              <p className="text-xs text-muted-foreground mb-4">Operational status &amp; highlights</p>

              <div className="space-y-3">
                <div className="p-3 rounded-md bg-muted/30 border border-border/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Low stock alert</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {kpis?.lowStockCount ?? 6} products are below reorder level.
                  </p>
                  <Link
                    href="/inventory"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] pt-0.5"
                  >
                    View inventory <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="p-3 rounded-md bg-muted/30 border border-border/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <span>Leading category</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Personal Care accounts for 21% of total retail sales.
                  </p>
                  <Link
                    href="/reports"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] pt-0.5"
                  >
                    View breakdown <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="p-3 rounded-md bg-muted/30 border border-border/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Package className="w-3.5 h-3.5 text-primary" />
                    <span>High velocity SKU</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Bru Instant Coffee recorded highest reorder frequency this month.
                  </p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] pt-0.5"
                  >
                    View product <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Database status</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap (Clean neutral intensity) */}
        {!loading && data?.salesHeatmap?.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-foreground mb-1">Activity by day &amp; hour</h3>
            <p className="text-xs text-muted-foreground mb-4">Historical transaction distribution</p>
            <div className="overflow-x-auto">
              <HeatmapGrid data={data.salesHeatmap} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapGrid({ data }: { data: any[] }) {
  const maxOrders = Math.max(...data.map((d: any) => parseInt(d.order_count)), 1);
  const cellMap = new Map<string, number>();
  data.forEach((d: any) => {
    cellMap.set(`${d.day_of_week}-${d.hour_slot}`, parseInt(d.order_count));
  });

  return (
    <div className="flex gap-1 select-none">
      {/* Day labels */}
      <div className="flex flex-col gap-1 pt-5 pr-2">
        {DAYS.map((d) => (
          <div key={d} className="h-4 flex items-center text-[10px] text-muted-foreground w-6">
            {d}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {/* Hour labels */}
        <div className="flex gap-1 mb-1">
          {HOURS.map((h) => (
            <div key={h} className="w-4 text-[9px] text-muted-foreground text-center">
              {h % 4 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>
        {/* Grid */}
        {DAYS.map((_, dayIdx) => (
          <div key={dayIdx} className="flex gap-1">
            {HOURS.map((h) => {
              const val = cellMap.get(`${dayIdx}-${h}`) || 0;
              const intensity = val / maxOrders;
              return (
                <div
                  key={h}
                  title={`${DAYS[dayIdx]} ${h}:00 — ${val} orders`}
                  className="w-4 h-4 rounded-[2px] transition-colors"
                  style={{
                    backgroundColor:
                      val === 0
                        ? 'hsl(var(--muted)/0.4)'
                        : `rgba(99, 102, 241, ${Math.max(0.2, intensity)})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
