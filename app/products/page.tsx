'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StockBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_name: '',
    category_id: '',
    supplier_id: '',
    unit_price: '',
    reorder_level: '10',
    initial_stock: '100',
  });


  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (catFilter !== 'all') params.set('category_id', catFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const [pRes, cRes, sRes] = await Promise.all([
      fetch(`/api/products?${params}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/suppliers').then((r) => r.json()),
    ]);
    setProducts(pRes.products || []);
    setCategories(cRes.categories || []);
    setSuppliers(sRes.suppliers || []);
    setLoading(false);
  }, [search, catFilter, statusFilter]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const openAdd = () => {
    setEditProduct(null);
    setForm({
      product_name: '',
      category_id: categories[0]?.category_id ? String(categories[0].category_id) : '',
      supplier_id: suppliers[0]?.supplier_id ? String(suppliers[0].supplier_id) : '',
      unit_price: '',
      reorder_level: '10',
      initial_stock: '100',
    });
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditProduct(p);
    setForm({
      product_name: p.product_name,
      category_id: String(p.category_id),
      supplier_id: String(p.supplier_id),
      unit_price: String(p.unit_price),
      reorder_level: String(p.reorder_level),
      initial_stock: '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      category_id: parseInt(form.category_id),
      supplier_id: parseInt(form.supplier_id),
      unit_price: parseFloat(form.unit_price),
      reorder_level: parseInt(form.reorder_level || '10'),
      initial_stock: parseInt(form.initial_stock || '0'),
    };
    const method = editProduct ? 'PUT' : 'POST';
    const body = editProduct ? { ...payload, product_id: editProduct.product_id } : payload;
    const res = await fetch('/api/products', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      addToast(editProduct ? 'Product updated' : 'Product added', 'success');
      setModalOpen(false);
      loadData();
    } else {
      addToast(data.error || 'Failed to save product', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      addToast('Product deleted', 'success');
      loadData();
    } else {
      addToast(data.error || 'Cannot delete product', 'error');
    }
  };



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {products.length} products across {categories.length} categories
            </p>
          </div>
          {user?.role !== 'cashier' && (
            <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>
              Add product
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or ID..."
              className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-md text-xs text-foreground focus:outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((c: any) => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-md text-xs text-foreground focus:outline-none"
          >
            <option value="all">All stock statuses</option>
            <option value="HEALTHY">In stock</option>
            <option value="CRITICAL">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">ID</th>
                  <th className="py-2.5 px-4 font-medium">Product</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">Supplier</th>
                  <th className="py-2.5 px-4 font-medium text-right">Price</th>
                  <th className="py-2.5 px-4 font-medium text-right">Reorder level</th>
                  <th className="py-2.5 px-4 font-medium">Stock status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-muted/30 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.product_id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3 px-4 font-mono text-muted-foreground">#{p.product_id}</td>
                      <td className="py-3 px-4 font-medium text-foreground max-w-xs">
                        <span className="line-clamp-1">{p.product_name}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{p.category_name}</td>
                      <td className="py-3 px-4 text-muted-foreground truncate max-w-[140px]">{p.supplier_name}</td>
                      <td className="py-3 px-4 text-right font-medium text-foreground tabular-nums">
                        {formatCurrency(p.unit_price)}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">
                        {p.reorder_level}
                      </td>
                      <td className="py-3 px-4">
                        <StockBadge qty={p.quantity_in_hand} reorderLevel={p.reorder_level} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {user?.role !== 'cashier' && (
                          <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => handleDelete(p.product_id, p.product_name)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                                title="Delete product"
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

        {/* Add/Edit Modal */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editProduct ? `Edit product #${editProduct.product_id}` : 'Add product'}
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Product name *</label>
              <input
                required
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                placeholder="e.g. Fortune Sunflower Oil 1L"
                className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Category *</label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
                >
                  {categories.map((c: any) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Supplier *</label>
                <select
                  required
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
                >
                  {suppliers.map((s: any) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Unit price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  placeholder="e.g. 145.00"
                  className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Reorder level *</label>
                <input
                  type="number"
                  required
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                  placeholder="10"
                  className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
                />
              </div>
            </div>

            {!editProduct && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Initial stock quantity</label>
                <input
                  type="number"
                  value={form.initial_stock}
                  onChange={(e) => setForm({ ...form, initial_stock: e.target.value })}
                  placeholder="100"
                  className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} variant="primary">
                {editProduct ? 'Save changes' : 'Add product'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
