'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal, Drawer } from '@/components/ui/Modal';
import { StockBadge } from '@/components/ui/Badge';
import { formatCurrency, downloadCSV } from '@/lib/utils';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Download,
} from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();

  // Data states
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Drawer
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierDetails, setSupplierDetails] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_name: '',
    phone: '',
    email: '',
    address: '',
  });


  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (res.ok) {
        setSuppliers(data.suppliers || []);
      } else {
        addToast(data.error || 'Failed to load suppliers', 'error');
      }
    } catch {
      addToast('Error loading suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadSuppliers();
  }, [user, loadSuppliers]);

  const openSupplierDrawer = async (id: number) => {
    setSelectedSupplierId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/suppliers?id=${id}`);
      const data = await res.json();
      if (res.ok) {
        setSupplierDetails(data);
      } else {
        addToast(data.error || 'Failed to load catalog', 'error');
        setSelectedSupplierId(null);
      }
    } catch {
      addToast('Error loading supplier catalog', 'error');
      setSelectedSupplierId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setForm({ supplier_name: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const openEditModal = (s: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSupplier(s);
    setForm({
      supplier_name: s.supplier_name,
      phone: s.phone,
      email: s.email,
      address: s.address,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_name.trim() || !form.phone.trim() || !form.email.trim() || !form.address.trim()) {
      addToast('All supplier fields are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const method = editingSupplier ? 'PUT' : 'POST';
      const body = editingSupplier
        ? { ...form, supplier_id: editingSupplier.supplier_id }
        : form;

      const res = await fetch('/api/suppliers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(
          editingSupplier ? 'Supplier updated' : 'Supplier created',
          'success'
        );
        setModalOpen(false);
        loadSuppliers();
        if (selectedSupplierId && editingSupplier?.supplier_id === selectedSupplierId) {
          openSupplierDrawer(selectedSupplierId);
        }
      } else {
        addToast(data.error || 'Failed to save supplier', 'error');
      }
    } catch {
      addToast('Error saving supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Delete supplier "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addToast('Supplier deleted', 'success');
        if (selectedSupplierId === id) setSelectedSupplierId(null);
        loadSuppliers();
      } else {
        addToast(data.error || 'Cannot delete supplier', 'error');
      }
    } catch {
      addToast('Error deleting supplier', 'error');
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      return (
        s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search) ||
        (s.categories_supplied && s.categories_supplied.toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [suppliers, search]);



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Suppliers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {suppliers.length} active suppliers and procurement contacts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rows = suppliers.map((s) => ({
                  'ID': s.supplier_id,
                  'Name': s.supplier_name,
                  'Phone': s.phone,
                  'Email': s.email,
                  'SKUs': s.total_products_supplied,
                  'Stock Units': s.total_stock_units,
                  'Stock Value': s.total_stock_value,
                }));
                downloadCSV('Suppliers', rows);
                addToast('Suppliers exported to CSV', 'success');
              }}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>
            {user?.role !== 'cashier' && (
              <Button onClick={openAddModal} icon={<Plus className="w-4 h-4" />}>
                Add supplier
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by supplier name, email, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Supplier</th>
                  <th className="py-2.5 px-4 font-medium">Phone</th>
                  <th className="py-2.5 px-4 font-medium">Categories</th>
                  <th className="py-2.5 px-4 font-medium text-center">SKUs</th>
                  <th className="py-2.5 px-4 font-medium text-right">Stock value</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-muted/30 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No suppliers found
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr
                      key={s.supplier_id}
                      onClick={() => openSupplierDrawer(s.supplier_id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground block">{s.supplier_name}</span>
                        <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]">
                          {s.email}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {s.phone}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">
                        {s.categories_supplied || 'General'}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                        {s.total_products_supplied}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground tabular-nums">
                        {formatCurrency(s.total_stock_value)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {user?.role !== 'cashier' && (
                          <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => openEditModal(s, e)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit supplier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={(e) => handleDelete(s.supplier_id, s.supplier_name, e)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                                title="Delete supplier"
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

      {/* Supplier Profile Drawer */}
      <Drawer
        open={selectedSupplierId !== null}
        onClose={() => {
          setSelectedSupplierId(null);
          setSupplierDetails(null);
        }}
        title="Supplier details"
      >
        {detailLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Loading supplier details...
          </div>
        ) : supplierDetails ? (
          <div className="space-y-5">
            <div className="p-3.5 rounded-md bg-muted/30 border border-border">
              <h2 className="text-sm font-semibold text-foreground">
                {supplierDetails.supplier.supplier_name}
              </h2>
              <div className="mt-1.5 text-xs space-y-0.5 text-muted-foreground">
                <p className="font-mono text-foreground">{supplierDetails.supplier.phone}</p>
                <p>{supplierDetails.supplier.email}</p>
                <p>{supplierDetails.supplier.address}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Supplied products ({supplierDetails.products?.length || 0})
              </p>
              {supplierDetails.products?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No products mapped</p>
              ) : (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                        <th className="py-2 px-3 text-left font-medium">Product</th>
                        <th className="py-2 px-3 text-right font-medium">Price</th>
                        <th className="py-2 px-3 text-right font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {supplierDetails.products.map((p: any) => (
                        <tr key={p.product_id}>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {p.product_name}
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                            {formatCurrency(p.unit_price)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <StockBadge qty={Number(p.quantity_in_hand ?? 0)} reorderLevel={p.reorder_level} />
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

      {/* Add / Edit Supplier Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? `Edit supplier #${editingSupplier.supplier_id}` : 'Add supplier'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Company name *</label>
            <input
              type="text"
              required
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              placeholder="e.g. Apex FMCG Distributors"
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
              placeholder="e.g. 080-23456789"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email address *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. contact@apexfmcg.com"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Address *</label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Industrial Area, Bangalore"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} variant="primary">
              {editingSupplier ? 'Save changes' : 'Add supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
