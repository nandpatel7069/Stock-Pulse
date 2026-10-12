export type Role = 'admin' | 'manager' | 'cashier';

export interface UserSession {
  username: string;
  role: Role;
  name: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  description: string | null;
  created_at?: string;
}

export interface Supplier {
  supplier_id: number;
  supplier_name: string;
  phone: string;
  email: string;
  address: string;
  created_at?: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  category_id: number;
  category_name?: string;
  supplier_id: number;
  supplier_name?: string;
  unit_price: number;
  reorder_level: number;
  quantity_in_hand?: number;
  last_updated?: string;
  stock_status?: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'HEALTHY';
}

export interface Customer {
  customer_id: number;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at?: string;
  total_orders?: number;
  total_spent?: number;
  customer_tier?: string;
}

export interface SalesHeader {
  sales_id: number;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  sales_date: string;
  total_amount: number;
  payment_mode?: string;
  reference_no?: string;
  items_count?: number;
}

export interface SalesDetail {
  sales_detail_id: number;
  sales_id: number;
  product_id: number;
  product_name?: string;
  category_name?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  sub_total: number;
}

export interface StockAlert {
  alert_id: number;
  product_id: number;
  product_name: string;
  quantity_at_alert: number;
  reorder_level: number;
  alert_date: string;
  alert_message: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface AuditLogEntry {
  log_id: number;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: number;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_at: string;
  changed_by: string;
}

export interface DashboardMetrics {
  kpis: {
    todayRevenue: number;
    todayOrders: number;
    lowStockCount: number;
    totalInventoryValue: number;
    revenueGrowthMoM: number;
    activeSkus: number;
  };
  revenueTrends: {
    daily: Array<{ sale_date: string; net_revenue: number; total_orders: number }>;
    monthly: Array<{ month_label: string; net_revenue: number; total_orders: number }>;
  };
  categoryRevenue: Array<{
    category_id: number;
    category_name: string;
    net_revenue: number;
    pct_of_total_revenue: number;
    units_sold: number;
  }>;
  topSellingProducts: Array<{
    product_id: number;
    product_name: string;
    net_revenue: number;
    units_sold: number;
  }>;
  recentSales: Array<{
    sales_id: number;
    customer_name: string;
    sales_date: string;
    total_amount: number;
    payment_mode: string;
  }>;
  salesHeatmap: Array<{
    day_name: string;
    day_of_week: number;
    hour_slot: number;
    order_count: number;
    revenue: number;
  }>;
  aiInsights: Array<{
    id: string;
    type: 'critical' | 'growth' | 'velocity' | 'opportunity';
    title: string;
    description: string;
    metric?: string;
  }>;
}
