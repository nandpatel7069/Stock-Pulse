'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Drawer, Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDateTime, formatDate, downloadCSV } from '@/lib/utils';
import {
  Search,
  Download,
  Calendar,
  Eye,
  RotateCcw,
  Printer,
  FileText,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalesHistoryPage() {
  const { user } = useAuth();

  // Data states
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Drawer / Details
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [saleDetail, setSaleDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Return modal
  const [returnModal, setReturnModal] = useState<{ open: boolean; item: any | null }>({
    open: false,
    item: null,
  });
  const [returnQty, setReturnQty] = useState<number>(1);
  const [processingReturn, setProcessingReturn] = useState(false);


  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (paymentMode !== 'all') params.set('payment_mode', paymentMode);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/sales?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSales(data.sales || []);
      } else {
        addToast(data.error || 'Failed to fetch sales', 'error');
      }
    } catch {
      addToast('Error loading sales ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, paymentMode, startDate, endDate, page, limit]);

  useEffect(() => {
    if (user) loadSales();
  }, [user, loadSales]);

  const openSaleDetail = async (saleId: number) => {
    setSelectedSaleId(saleId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      const data = await res.json();
      if (res.ok) {
        setSaleDetail(data);
      } else {
        addToast(data.error || 'Failed to load details', 'error');
        setSelectedSaleId(null);
      }
    } catch {
      addToast('Error loading details', 'error');
      setSelectedSaleId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!returnModal.item || returnQty <= 0) return;
    if (returnQty > returnModal.item.quantity) {
      addToast(`Cannot return more than purchased quantity (${returnModal.item.quantity})`, 'warning');
      return;
    }

    setProcessingReturn(true);
    try {
      const res = await fetch('/api/sales/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_detail_id: returnModal.item.sales_detail_id,
          quantity: returnQty,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast('Return processed and inventory restocked', 'success');
        setReturnModal({ open: false, item: null });
        if (selectedSaleId) openSaleDetail(selectedSaleId);
        loadSales();
      } else {
        addToast(data.error || 'Failed to process return', 'error');
      }
    } catch {
      addToast('Network error processing return', 'error');
    } finally {
      setProcessingReturn(false);
    }
  };

  const exportPDFInvoice = (detail: any) => {
    if (!detail?.sale) return;
    const doc = new jsPDF();
    const s = detail.sale;

    doc.setFontSize(16);
    doc.text('StockPulse Retail', 14, 20);
    doc.setFontSize(10);
    doc.text(`Invoice #${s.sales_id}`, 14, 28);
    doc.text(`Date: ${formatDateTime(s.sales_date)}`, 14, 34);

    doc.text(`Billed To: ${s.customer_name} (${s.customer_phone || ''})`, 14, 44);
    doc.text(`Payment Mode: ${s.payment_mode || 'Cash'} ${s.reference_no ? `(Ref: ${s.reference_no})` : ''}`, 14, 50);

    const tableData = detail.items.map((i: any, idx: number) => [
      idx + 1,
      i.product_name,
      i.quantity,
      formatCurrency(i.unit_price),
      i.discount > 0 ? formatCurrency(i.discount) : '-',
      formatCurrency(i.sub_total),
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['#', 'Item', 'Qty', 'Rate', 'Discount', 'Subtotal']],
      body: tableData,
      theme: 'plain',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Amount: ${formatCurrency(s.total_amount)}`, 140, finalY);

    doc.save(`Invoice_${s.sales_id}.pdf`);
    addToast(`Invoice #${s.sales_id} downloaded`, 'success');
  };

  const stats = useMemo(() => {
    let revenue = 0;
    let units = 0;
    sales.forEach((s) => {
      revenue += parseFloat(s.total_amount || 0);
      units += parseInt(s.total_quantity || 0, 10);
    });
    return {
      revenue,
      orders: sales.length,
      units,
      aov: sales.length > 0 ? revenue / sales.length : 0,
    };
  }, [sales]);



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Sales</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historical orders, line-item details, and returns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const exportRows = sales.map((s) => ({
                  'Sale ID': s.sales_id,
                  'Customer': s.customer_name,
                  'Phone': s.customer_phone,
                  'Date': s.sales_date,
                  'Amount': s.total_amount,
                  'Payment': s.payment_mode,
                  'Reference': s.reference_no,
                  'Items': s.items_count,
                }));
                downloadCSV('Sales_Ledger', exportRows);
                addToast('Sales exported to CSV', 'success');
              }}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Quick Context Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs text-muted-foreground">Filtered revenue</span>
            <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">{formatCurrency(stats.revenue)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs text-muted-foreground">Orders</span>
            <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">{stats.orders}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs text-muted-foreground">Units sold</span>
            <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">{stats.units}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs text-muted-foreground">Average order value</span>
            <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">{formatCurrency(stats.aov)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by customer, phone, or order #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="py-1.5 px-2.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
          >
            <option value="all">All payment modes</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="NetBanking">NetBanking</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-muted/40 border border-border rounded-md px-2 py-1 text-foreground text-xs focus:outline-none"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-muted/40 border border-border rounded-md px-2 py-1 text-foreground text-xs focus:outline-none"
            />
          </div>

          {(search || paymentMode !== 'all' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch('');
                setPaymentMode('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Order</th>
                  <th className="py-2.5 px-4 font-medium">Customer</th>
                  <th className="py-2.5 px-4 font-medium">Date &amp; time</th>
                  <th className="py-2.5 px-4 font-medium">Payment</th>
                  <th className="py-2.5 px-4 font-medium text-center">Items</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
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
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No sales records found
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr
                      key={s.sales_id}
                      onClick={() => openSaleDetail(s.sales_id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        #{s.sales_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground block">{s.customer_name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{s.customer_phone}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDateTime(s.sales_date)}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {s.payment_mode || 'Cash'}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                        {s.items_count} items
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground tabular-nums">
                        {formatCurrency(s.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs text-muted-foreground group-hover:text-foreground">
                          View details
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={selectedSaleId !== null}
        onClose={() => {
          setSelectedSaleId(null);
          setSaleDetail(null);
        }}
        title={`Order #${selectedSaleId}`}
      >
        {detailLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Loading order details...
          </div>
        ) : saleDetail ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPDFInvoice(saleDetail)}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Download PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.print()}
                icon={<Printer className="w-3.5 h-3.5" />}
              >
                Print
              </Button>
            </div>

            {/* Customer & Info Grid */}
            <div className="text-xs space-y-1.5 p-3 rounded-md bg-muted/30 border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{saleDetail.sale.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-mono text-foreground">{saleDetail.sale.customer_phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment:</span>
                <span className="font-mono text-foreground">{saleDetail.sale.payment_mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="text-foreground">{formatDateTime(saleDetail.sale.sales_date)}</span>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Purchased items</p>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                      <th className="py-2 px-3 text-left font-medium">Item</th>
                      <th className="py-2 px-2 text-center font-medium">Qty</th>
                      <th className="py-2 px-3 text-right font-medium">Price</th>
                      <th className="py-2 px-3 text-right font-medium">Subtotal</th>
                      {user?.role !== 'cashier' && (
                        <th className="py-2 px-3 text-right font-medium">Return</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {saleDetail.items.map((item: any) => (
                      <tr key={item.sales_detail_id}>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-foreground">{item.product_name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.category_name}</p>
                        </td>
                        <td className="py-2.5 px-2 text-center tabular-nums font-medium text-foreground">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-foreground tabular-nums">
                          {formatCurrency(item.sub_total)}
                        </td>
                        {user?.role !== 'cashier' && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setReturnModal({ open: true, item });
                                setReturnQty(1);
                              }}
                              className="text-[11px] text-rose-500 hover:underline"
                            >
                              Return
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-border">
              <span className="text-sm font-medium text-foreground">Total settled</span>
              <span className="text-base font-semibold text-foreground tabular-nums">
                {formatCurrency(saleDetail.sale.total_amount)}
              </span>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Return Modal */}
      <Modal
        open={returnModal.open}
        onClose={() => setReturnModal({ open: false, item: null })}
        title="Return item"
        size="sm"
      >
        {returnModal.item && (
          <div className="space-y-3.5">
            <div className="text-xs space-y-1">
              <p className="font-medium text-foreground">{returnModal.item.product_name}</p>
              <p className="text-muted-foreground">
                Purchased: {returnModal.item.quantity} @ {formatCurrency(returnModal.item.unit_price)}
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Quantity to return</label>
              <input
                type="number"
                min="1"
                max={returnModal.item.quantity}
                value={returnQty}
                onChange={(e) => setReturnQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 rounded-md bg-muted/40 border border-border text-foreground text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setReturnModal({ open: false, item: null })}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={processingReturn}
                onClick={handleProcessReturn}
              >
                Confirm return
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
