'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StockBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import confetti from 'canvas-confetti';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  Building,
  UserPlus,
  RotateCcw,
} from 'lucide-react';

interface CartItem {
  product_id: number;
  product_name: string;
  category_name?: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
  discount: number;
}

export default function PosPage() {
  const { user } = useAuth();

  // Data states
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI' | 'NetBanking'>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  // Modals
  const [newCustModal, setNewCustModal] = useState(false);
  const [custForm, setCustForm] = useState({ customer_name: '', phone: '', email: '', address: '' });
  const [savingCust, setSavingCust] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);


  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, custRes] = await Promise.all([
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/customers').then((r) => r.json()),
      ]);
      setProducts(prodRes.products || []);
      setCategories(catRes.categories || []);
      setCustomers(custRes.customers || []);
      if (custRes.customers?.length > 0 && !selectedCustomer) {
        setSelectedCustomer(custRes.customers[0].customer_id);
      }
    } catch {
      addToast('Failed to load catalog data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const addToCart = (prod: any) => {
    const stock = Number(prod.quantity_in_hand ?? 0);
    if (stock <= 0) {
      addToast(`"${prod.product_name}" is out of stock`, 'warning');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === prod.product_id);
      if (existing) {
        if (existing.quantity >= stock) {
          addToast(`Maximum stock (${stock}) reached`, 'warning');
          return prev;
        }
        return prev.map((item) =>
          item.product_id === prod.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: prod.product_id,
          product_name: prod.product_name,
          category_name: prod.category_name,
          unit_price: parseFloat(prod.unit_price),
          quantity: 1,
          max_stock: stock,
          discount: 0,
        },
      ];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.max_stock) {
              addToast(`Only ${item.max_stock} units available in inventory`, 'warning');
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateDiscount = (productId: number, discountAmount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, discount: Math.max(0, discountAmount) }
          : item
      )
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => setCart([]);

  const { subTotal, totalDiscount, netTotal, totalItemsCount } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    let count = 0;
    cart.forEach((i) => {
      sub += i.unit_price * i.quantity;
      disc += Number(i.discount || 0);
      count += i.quantity;
    });
    const net = Math.max(0, sub - disc);
    return { subTotal: sub, totalDiscount: disc, netTotal: net, totalItemsCount: count };
  }, [cart]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.customer_name || !custForm.phone) {
      addToast('Customer name and phone are required', 'warning');
      return;
    }
    setSavingCust(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custForm),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`Customer "${data.customer.customer_name}" added`, 'success');
        setCustomers((prev) => [data.customer, ...prev]);
        setSelectedCustomer(data.customer.customer_id);
        setNewCustModal(false);
        setCustForm({ customer_name: '', phone: '', email: '', address: '' });
      } else {
        addToast(data.error || 'Failed to create customer', 'error');
      }
    } catch {
      addToast('Error saving customer', 'error');
    } finally {
      setSavingCust(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      addToast('Add products to cart to checkout', 'warning');
      return;
    }
    if (!selectedCustomer) {
      addToast('Please select a customer', 'warning');
      return;
    }

    setCheckingOut(true);
    try {
      const payload = {
        customer_id: selectedCustomer,
        payment_mode: paymentMode,
        reference_no: referenceNo.trim() || `${paymentMode.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount: item.discount,
          unit_price: item.unit_price,
        })),
      };

      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Subtle confetti on sale complete
        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.7 },
        });

        addToast(`Sale #${data.sales_id} completed`, 'success');
        setReceiptData(data.receipt);
        clearCart();
        setReferenceNo('');
        loadData();
      } else {
        addToast(data.error || 'Transaction could not be completed', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error processing sale', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.category_name?.toLowerCase().includes(search.toLowerCase()) ||
        String(p.product_id).includes(search);
      const matchesCat =
        selectedCat === 'all' || String(p.category_id) === String(selectedCat);
      return matchesSearch && matchesCat;
    });
  }, [products, search, selectedCat]);



  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-6rem)] max-w-7xl mx-auto">
        {/* Left Column: Product Selection */}
        <div className="flex-1 flex flex-col min-w-0 bg-card border border-border rounded-lg p-4 overflow-hidden">
          {/* Header & Search */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-base font-semibold text-foreground">Products</h1>
              <p className="text-xs text-muted-foreground">Select items to add to cart</p>
            </div>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:border-border focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none border-b border-border/50">
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                selectedCat === 'all'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.category_id}
                onClick={() => setSelectedCat(String(c.category_id))}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                  selectedCat === String(c.category_id)
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.category_name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-md bg-muted/20 animate-pulse border border-border" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((p) => {
                  const stock = Number(p.quantity_in_hand ?? 0);
                  const isOutOfStock = stock <= 0;
                  const inCartItem = cart.find((i) => i.product_id === p.product_id);

                  return (
                    <div
                      key={p.product_id}
                      onClick={() => !isOutOfStock && addToCart(p)}
                      className={`p-3 rounded-md border text-left flex flex-col justify-between transition-colors select-none ${
                        isOutOfStock
                          ? 'opacity-40 cursor-not-allowed bg-muted/10 border-border'
                          : 'cursor-pointer bg-card hover:bg-muted/30 border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] text-muted-foreground truncate">
                            {p.category_name}
                          </span>
                          <StockBadge qty={stock} reorderLevel={p.reorder_level} />
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                          {p.product_name}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/50">
                        <span className="text-xs font-semibold text-foreground tabular-nums">
                          {formatCurrency(p.unit_price)}
                        </span>
                        {inCartItem ? (
                          <span className="text-[11px] font-medium text-primary">
                            {inCartItem.quantity} in cart
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground hover:text-foreground">
                            + Add
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="w-full lg:w-[380px] flex flex-col bg-card border border-border rounded-lg p-4 shrink-0">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Cart</h2>
              <span className="text-xs text-muted-foreground">({totalItemsCount} items)</span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Customer Selection */}
          <div className="py-3 border-b border-border space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Customer</span>
              <button
                onClick={() => setNewCustModal(true)}
                className="text-primary hover:underline flex items-center gap-1 text-[11px]"
              >
                <UserPlus className="w-3 h-3" />
                New customer
              </button>
            </div>
            <select
              value={selectedCustomer ?? ''}
              onChange={(e) => setSelectedCustomer(Number(e.target.value))}
              className="w-full py-1.5 px-2.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-border"
            >
              <option value="" disabled>Select customer</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.customer_name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 min-h-[160px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
                <p className="text-xs">No items in cart</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">Click products on the left to add</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product_id}
                  className="p-2.5 rounded-md bg-muted/20 border border-border flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground truncate flex-1">
                      {item.product_name}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.product_id, -1)}
                        className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center tabular-nums font-medium text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, 1)}
                        className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Disc ₹</span>
                      <input
                        type="number"
                        min="0"
                        value={item.discount || ''}
                        placeholder="0"
                        onChange={(e) => updateDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                        className="w-12 py-0.5 px-1 rounded bg-muted border border-border text-[11px] text-foreground text-right focus:outline-none"
                      />
                    </div>

                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCurrency(item.unit_price * item.quantity - item.discount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Method */}
          <div className="pt-3 border-t border-border space-y-2">
            <span className="text-xs text-muted-foreground font-medium block">Payment method</span>
            <div className="grid grid-cols-4 gap-1">
              {[
                { mode: 'UPI', icon: QrCode },
                { mode: 'Card', icon: CreditCard },
                { mode: 'Cash', icon: Banknote },
                { mode: 'NetBanking', icon: Building, label: 'NetBank' },
              ].map(({ mode, icon: Icon, label }) => {
                const active = paymentMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode as any)}
                    className={`py-1.5 px-1 rounded text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                      active
                        ? 'bg-muted text-foreground border border-border font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{label || mode}</span>
                  </button>
                );
              })}
            </div>

            {paymentMode !== 'Cash' && (
              <input
                type="text"
                placeholder={`Reference / UTR (${paymentMode})`}
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-md bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none font-mono"
              />
            )}
          </div>

          {/* Totals & Charge Button */}
          <div className="pt-3 border-t border-border space-y-1.5 mt-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subTotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-500">
                <span>Discount</span>
                <span className="tabular-nums">-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-foreground pt-1.5 border-t border-border">
              <span>Total</span>
              <span className="text-lg tabular-nums">
                {formatCurrency(netTotal)}
              </span>
            </div>
          </div>

          <div className="pt-3">
            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut}
              loading={checkingOut}
              variant="primary"
              className="w-full py-2 text-sm"
            >
              Charge {formatCurrency(netTotal)}
            </Button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <Modal
        open={newCustModal}
        onClose={() => setNewCustModal(false)}
        title="New customer"
        size="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3.5">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Full name *</label>
            <input
              type="text"
              required
              value={custForm.customer_name}
              onChange={(e) => setCustForm({ ...custForm, customer_name: e.target.value })}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone number *</label>
            <input
              type="tel"
              required
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              placeholder="e.g. +91 9876543210"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email address</label>
            <input
              type="email"
              value={custForm.email}
              onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
              placeholder="e.g. rahul@example.com"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Address</label>
            <input
              type="text"
              value={custForm.address}
              onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
              placeholder="e.g. Indiranagar, Bangalore"
              className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-border"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setNewCustModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingCust} variant="primary">
              Save customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sale Success Receipt Modal */}
      <Modal
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
        title={`Receipt • Sale #${receiptData?.order?.sales_id}`}
        size="md"
      >
        {receiptData && (
          <div className="space-y-4">
            <div className="text-xs space-y-1 py-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{receiptData.order?.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="text-foreground">{formatDateTime(receiptData.order?.sales_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment mode:</span>
                <span className="font-mono text-foreground">{receiptData.order?.payment_mode}</span>
              </div>
              {receiptData.order?.reference_no && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono text-foreground">{receiptData.order?.reference_no}</span>
                </div>
              )}
            </div>

            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Item</th>
                    <th className="py-2 px-3 text-center font-medium">Qty</th>
                    <th className="py-2 px-3 text-right font-medium">Price</th>
                    <th className="py-2 px-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {receiptData.items?.map((item: any) => (
                    <tr key={item.sales_detail_id}>
                      <td className="py-2 px-3 text-foreground font-medium">{item.product_name}</td>
                      <td className="py-2 px-3 text-center tabular-nums">{item.quantity}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium text-foreground">
                        {formatCurrency(item.sub_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-border">
              <span className="text-sm font-medium text-foreground">Total charged</span>
              <span className="text-base font-semibold text-foreground tabular-nums">
                {formatCurrency(receiptData.order?.total_amount)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setReceiptData(null)}
              >
                New sale
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
