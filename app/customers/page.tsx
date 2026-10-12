'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal, Drawer } from '@/components/ui/Modal';
import { TierBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, downloadCSV } from '@/lib/utils';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Download,
} from 'lucide-react';

export default function CustomersPage() {
  const { user } = useAuth();

  // Data states
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  // Customer Drawer Profile
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    address: '',
  });


  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (res.ok) {
        setCustomers(data.customers || []);
      } else {
        addToast(data.error || 'Failed to load customers', 'error');
      }
    } catch {
      addToast('Error loading customers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadCustomers();
  }, [user, loadCustomers]);

  const openProfile = async (id: number) => {
    setSelectedCustomerId(id);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/customers?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        setCustomerProfile(data);
      } else {
        addToast(data.error || 'Failed to load profile', 'error');
        setSelectedCustomerId(null);
      }
    } catch {
      addToast('Error loading customer profile', 'error');
      setSelectedCustomerId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm({ customer_name: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const openEditModal = (c: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCustomer(c);
    setForm({
      customer_name: c.customer_name,
      phone: c.phone,
      email: c.email || '',
      address: c.address || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.phone.trim()) {
      addToast('Name and phone are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const method = editingCustomer ? 'PUT' : 'POST';
      const body = editingCustomer
        ? { ...form, customer_id: editingCustomer.customer_id }
        : form;

      const res = await fetch('/api/customers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(
          editingCustomer ? 'Customer updated' : 'Customer created',
          'success'
        );
        setModalOpen(false);
        loadCustomers();
        if (selectedCustomerId && editingCustomer?.customer_id === selectedCustomerId) {
          openProfile(selectedCustomerId);
        }
      } else {
        addToast(data.error || 'Failed to save customer', 'error');
      }
    } catch {
      addToast('Error saving customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addToast('Customer deleted', 'success');
        if (selectedCustomerId === id) setSelectedCustomerId(null);
        loadCustomers();
      } else {
        addToast(data.error || 'Cannot delete customer', 'error');
      }
    } catch {
      addToast('Error deleting customer', 'error');
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
      const matchesTier = tierFilter === 'all' || c.customer_tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [customers, search, tierFilter]);



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {customers.length} registered customers and lifetime orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rows = customers.map((c) => ({
                  'ID': c.customer_id,
                  'Name': c.customer_name,
                  'Phone': c.phone,
                  'Email': c.email || '',
                  'Tier': c.customer_tier || 'Bronze',
                  'Orders': c.total_orders || 0,
                  'Total Spent': c.total_spent || 0,
                }));
                downloadCSV('Customers', rows);
                addToast('Customers exported to CSV', 'success');
              }}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>
            {user?.role !== 'cashier' && (
              <Button onClick={openAddModal} icon={<Plus className="w-4 h-4" />}>
                Add customer
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by customer name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
          >
            <option value="all">All tiers</option>
            <option value="Platinum VIP">Platinum VIP</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Customer</th>
                  <th className="py-2.5 px-4 font-medium">Phone</th>
                  <th className="py-2.5 px-4 font-medium">Tier</th>
                  <th className="py-2.5 px-4 font-medium text-center">Orders</th>
                  <th className="py-2.5 px-4 font-medium text-right">Lifetime spend</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-muted/30 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr
                      key={c.customer_id}
                      onClick={() => openProfile(c.customer_id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground block">{c.customer_name}</span>
                        {c.email && (
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]">
                            {c.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {c.phone}
                      </td>
                      <td className="py-3 px-4">
                        <TierBadge tier={c.customer_tier || 'Bronze'} />
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                        {c.total_orders || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground tabular-nums">
                        {formatCurrency(c.total_spent || 0)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {user?.role !== 'cashier' && (
                          <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => openEditModal(c, e)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit customer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={(e) => handleDelete(c.customer_id, c.customer_name, e)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                                title="Delete customer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      </div>

      {/* Customer Profile Drawer */}
      <Drawer
        open={selectedCustomerId !== null}
        onClose={() => {
          setSelectedCustomerId(null);
          setCustomerProfile(null);
        }}
        title="Customer details"
      >
        {profileLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Loading customer profile...
          </div>
        ) : customerProfile ? (
          <div className="space-y-5">
            <div className="p-3.5 rounded-md bg-muted/30 border border-border flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {customerProfile.customer.customer_name}
                </h2>
                <div className="mt-1 text-xs space-y-0.5 text-muted-foreground">
                  <p className="font-mono text-foreground">{customerProfile.customer.phone}</p>
                  {customerProfile.customer.email && <p>{customerProfile.customer.email}</p>}
                  {customerProfile.customer.address && <p>{customerProfile.customer.address}</p>}
                </div>
              </div>
              <TierBadge tier={customerProfile.customer.customer_tier || 'Bronze'} />
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-md bg-muted/20 border border-border text-center">
                <span className="text-[11px] text-muted-foreground">Total spent</span>
                <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
                  {formatCurrency(customerProfile.customer.total_spent)}
                </p>
              </div>
              <div className="p-2.5 rounded-md bg-muted/20 border border-border text-center">
                <span className="text-[11px] text-muted-foreground">Orders</span>
                <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
                  {customerProfile.customer.total_orders}
                </p>
              </div>
              <div className="p-2.5 rounded-md bg-muted/20 border border-border text-center">
                <span className="text-[11px] text-muted-foreground">Avg basket</span>
                <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
                  {formatCurrency(customerProfile.customer.avg_order_value)}
                </p>
              </div>
            </div>

            {/* Past Orders */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Order history</p>
              {customerProfile.orders?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No orders recorded</p>
              ) : (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                        <th className="py-2 px-3 text-left font-medium">Order</th>
                        <th className="py-2 px-3 text-left font-medium">Date</th>
                        <th className="py-2 px-3 text-left font-medium">Payment</th>
                        <th className="py-2 px-3 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {customerProfile.orders.map((ord: any) => (
                        <tr key={ord.sales_id}>
                          <td className="py-2 px-3 font-mono font-medium text-foreground">
                            #{ord.sales_id}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {formatDate(ord.sales_date)}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground font-mono">
                            {ord.payment_mode}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-foreground tabular-nums">
                            {formatCurrency(ord.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Add / Edit Customer Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? `Edit customer #${editingCustomer.customer_id}` : 'Add customer'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Customer name *</label>
            <input
              type="text"
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="e.g. Meera Ramanathan"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone number *</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9845012345"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. meera@example.com"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Indiranagar, Bangalore"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} variant="primary">
              {editingCustomer ? 'Save changes' : 'Add customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
