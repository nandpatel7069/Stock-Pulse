'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StockBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Search, Plus, AlertTriangle, ArrowDownToLine, SlidersHorizontal } from 'lucide-react';

export default function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [shipmentModal, setShipmentModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [shipQty, setShipQty] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [saving, setSaving] = useState(false);


  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filter === 'low') params.set('filter', 'low');
    const [invRes, alertRes] = await Promise.all([
      fetch(`/api/inventory?${params}`).then((r) => r.json()),
      fetch('/api/inventory/alerts?status=PENDING').then((r) => r.json()),
    ]);
    setItems(invRes.items || []);
    setAlerts(alertRes.alerts || []);
    setLoading(false);
  }, [search, filter]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const handleReceiveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !shipQty || parseInt(shipQty) <= 0) {
      addToast('Enter a valid received quantity', 'warning');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/inventory/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: selectedItem.product_id, quantity: parseInt(shipQty) }),
    });
    const data = await res.json();
    if (res.ok) {
      addToast(data.message || 'Shipment received and stock updated', 'success');
      setShipmentModal(false);
      setShipQty('');
      loadData();
    } else {
      addToast(data.error || 'Failed to receive shipment', 'error');
    }
    setSaving(false);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const newQty = parseInt(adjustQty);
    if (!selectedItem || isNaN(newQty) || newQty < 0) {
      addToast('Enter a valid non-negative quantity', 'warning');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: selectedItem.product_id, new_quantity: newQty }),
    });
    const data = await res.json();
    if (res.ok) {
      addToast('Inventory count adjusted', 'success');
      setAdjustModal(false);
      setAdjustQty('');
      loadData();
    } else {
      addToast(data.error || 'Failed to adjust inventory', 'error');
    }
    setSaving(false);
  };



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Warehouse stock levels, safety thresholds, and inbound shipments.
            </p>
          </div>
          {user?.role !== 'cashier' && (
            <Button
              onClick={() => {
                setSelectedItem(items[0] || null);
                setShipQty('');
                setShipmentModal(true);
              }}
              icon={<ArrowDownToLine className="w-4 h-4" />}
            >
              Receive shipment
            </Button>
          )}
        </div>

        {/* Low Stock Warning Banner if alerts exist */}
        {alerts.length > 0 && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-foreground font-medium">
                {alerts.length} products below reorder threshold
              </span>
              <span className="text-muted-foreground hidden sm:inline">
                — replenish stock to avoid inventory stockouts.
              </span>
            </div>
            <button
              onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
              className="text-xs text-primary hover:underline font-medium shrink-0"
            >
              {filter === 'low' ? 'Show all items' : 'Filter low stock items'}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name..."
              className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/40 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filter === 'all' ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All items
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filter === 'low' ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Low stock only
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Product</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium text-right">In hand</th>
                  <th className="py-2.5 px-4 font-medium text-right">Reorder level</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Last updated</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-muted/30 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.product_id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground">{item.product_name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">ID: #{item.product_id}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{item.category_name}</td>
                      <td className="py-3 px-4 text-right font-medium text-foreground tabular-nums">
                        {item.quantity_in_hand} units
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">
                        {item.reorder_level} units
                      </td>
                      <td className="py-3 px-4">
                        <StockBadge qty={item.quantity_in_hand} reorderLevel={item.reorder_level} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDateTime(item.last_updated)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {user?.role !== 'cashier' && (
                          <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShipQty('');
                                setShipmentModal(true);
                              }}
                              className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Receive stock"
                            >
                              Receive
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setAdjustQty(String(item.quantity_in_hand));
                                setAdjustModal(true);
                              }}
                              className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Adjust count"
                            >
                              Adjust
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Receive Shipment Modal */}
        <Modal
          open={shipmentModal}
          onClose={() => setShipmentModal(false)}
          title="Receive shipment"
          size="sm"
        >
          <form onSubmit={handleReceiveShipment} className="space-y-3.5">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Target product *</label>
              <select
                value={selectedItem?.product_id ?? ''}
                onChange={(e) => {
                  const p = items.find((i) => i.product_id === parseInt(e.target.value));
                  setSelectedItem(p || null);
                }}
                className="w-full px-2.5 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
              >
                {items.map((i) => (
                  <option key={i.product_id} value={i.product_id}>
                    {i.product_name} (Current: {i.quantity_in_hand})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Quantity received *</label>
              <input
                type="number"
                min="1"
                required
                value={shipQty}
                onChange={(e) => setShipQty(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setShipmentModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} variant="primary">
                Confirm intake
              </Button>
            </div>
          </form>
        </Modal>

        {/* Adjust Stock Count Modal */}
        <Modal
          open={adjustModal}
          onClose={() => setAdjustModal(false)}
          title={`Adjust count • ${selectedItem?.product_name || ''}`}
          size="sm"
        >
          <form onSubmit={handleAdjust} className="space-y-3.5">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Verified physical count *</label>
              <input
                type="number"
                min="0"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Previous recorded in-hand: {selectedItem?.quantity_in_hand ?? 0} units
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setAdjustModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} variant="primary">
                Update count
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
