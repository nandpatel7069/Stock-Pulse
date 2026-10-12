import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. KPI Queries
    const [kpiRes, lowStockRes, invValRes, activeSkusRes] = await Promise.all([
      query(`
        SELECT 
          COALESCE(SUM(CASE WHEN sales_date::DATE = (SELECT MAX(sales_date::DATE) FROM sales) THEN total_amount END), 0) AS latest_day_revenue,
          COALESCE(COUNT(CASE WHEN sales_date::DATE = (SELECT MAX(sales_date::DATE) FROM sales) THEN 1 END), 0) AS latest_day_orders,
          (SELECT MAX(sales_date::DATE) FROM sales) AS latest_sales_date,
          COALESCE(SUM(total_amount), 0) AS all_time_revenue,
          COUNT(sales_id) AS all_time_orders
        FROM sales
      `),
      query(`SELECT COUNT(*) AS count FROM v_low_stock`),
      query(`SELECT COALESCE(SUM(total_inventory_value), 0) AS total_val FROM v_inventory_valuation`),
      query(`SELECT COUNT(*) AS count FROM product`),
    ]);

    const latestDayRevenue = parseFloat(kpiRes.rows[0].latest_day_revenue || '0');
    const latestDayOrders = parseInt(kpiRes.rows[0].latest_day_orders || '0', 10);
    const lowStockCount = parseInt(lowStockRes.rows[0].count || '0', 10);
    const totalInventoryValue = parseFloat(invValRes.rows[0].total_val || '0');
    const activeSkus = parseInt(activeSkusRes.rows[0].count || '0', 10);

    // 2. Revenue Trends (Daily and Monthly from views)
    const [dailyTrendsRes, monthlyTrendsRes] = await Promise.all([
      query(`
        SELECT 
          TO_CHAR(sale_date, 'YYYY-MM-DD') AS sale_date,
          ROUND(net_revenue, 2) AS net_revenue,
          total_orders
        FROM v_daily_sales
        ORDER BY sale_date ASC
        LIMIT 30
      `),
      query(`
        SELECT 
          month_label,
          ROUND(net_revenue, 2) AS net_revenue,
          total_orders,
          sales_year,
          sales_month
        FROM v_monthly_sales
        ORDER BY sales_year ASC, sales_month ASC
      `),
    ]);

    // 3. Category Revenue Donut Chart (from v_category_revenue)
    const categoryRevRes = await query(`
      SELECT 
        category_id,
        category_name,
        ROUND(net_revenue, 2) AS net_revenue,
        pct_of_total_revenue,
        units_sold
      FROM v_category_revenue
      ORDER BY net_revenue DESC
    `);

    // 4. Top Selling Products (from v_product_wise_sales)
    const topProductsRes = await query(`
      SELECT 
        product_id,
        product_name,
        ROUND(net_revenue, 2) AS net_revenue,
        units_sold
      FROM v_product_wise_sales
      ORDER BY net_revenue DESC
      LIMIT 6
    `);

    // 5. Recent Sales Feed
    const recentSalesRes = await query(`
      SELECT 
        s.sales_id,
        c.customer_name,
        s.sales_date,
        s.total_amount,
        p.payment_mode
      FROM sales s
      JOIN customer c ON c.customer_id = s.customer_id
      JOIN payment p  ON p.sales_id = s.sales_id
      ORDER BY s.sales_date DESC
      LIMIT 8
    `);

    // 6. Heatmap of sales by Day of Week & Hour
    const heatmapRes = await query(`
      SELECT 
        TRIM(TO_CHAR(sales_date, 'Day')) AS day_name,
        EXTRACT(DOW FROM sales_date)::INT AS day_of_week,
        EXTRACT(HOUR FROM sales_date)::INT AS hour_slot,
        COUNT(*) AS order_count,
        ROUND(SUM(total_amount), 2) AS revenue
      FROM sales
      GROUP BY TRIM(TO_CHAR(sales_date, 'Day')), EXTRACT(DOW FROM sales_date), EXTRACT(HOUR FROM sales_date)
      ORDER BY day_of_week ASC, hour_slot ASC
    `);

    // 7. Dynamic Rule-Based AI Insights
    const topCategory = categoryRevRes.rows[0];
    const topProduct = topProductsRes.rows[0];
    const lowStockItems = await query(`
      SELECT product_name, quantity_in_hand, reorder_level 
      FROM v_low_stock 
      LIMIT 3
    `);

    const aiInsights = [
      {
        id: 'insight-1',
        type: 'critical',
        title: `${lowStockCount} SKUs Breached Safety Threshold`,
        description: lowStockItems.rows.length
          ? `${lowStockItems.rows.map((r: any) => `${r.product_name} (${r.quantity_in_hand} left)`).join(', ')} require urgent supplier replenishment.`
          : 'All inventory items are currently above their minimum reorder thresholds.',
        metric: `${lowStockCount} Critical SKUs`,
      },
      {
        id: 'insight-2',
        type: 'growth',
        title: `${topCategory?.category_name || 'Personal Care'} Dominating Sales`,
        description: `Generated ₹${Number(topCategory?.net_revenue || 0).toLocaleString('en-IN')} contributing ${topCategory?.pct_of_total_revenue || 0}% of total retail revenue.`,
        metric: `${topCategory?.pct_of_total_revenue || 0}% Share`,
      },
      {
        id: 'insight-3',
        type: 'velocity',
        title: `Highest Velocity: ${topProduct?.product_name || 'Top Product'}`,
        description: `Recorded ${topProduct?.units_sold || 0} unit sales generating ₹${Number(topProduct?.net_revenue || 0).toLocaleString('en-IN')}. Stock velocity remains high.`,
        metric: `${topProduct?.units_sold || 0} Units Sold`,
      },
      {
        id: 'insight-4',
        type: 'opportunity',
        title: `Average Basket Size Healthy`,
        description: `Average order checkout value across 300+ orders stands at ₹${Math.round(kpiRes.rows[0].all_time_revenue / (kpiRes.rows[0].all_time_orders || 1))}.`,
        metric: `₹${Math.round(kpiRes.rows[0].all_time_revenue / (kpiRes.rows[0].all_time_orders || 1))} AOV`,
      },
    ];

    return NextResponse.json({
      kpis: {
        todayRevenue: latestDayRevenue,
        todayOrders: latestDayOrders,
        lowStockCount,
        totalInventoryValue,
        activeSkus,
        allTimeRevenue: parseFloat(kpiRes.rows[0].all_time_revenue || '0'),
        allTimeOrders: parseInt(kpiRes.rows[0].all_time_orders || '0', 10),
      },
      revenueTrends: {
        daily: dailyTrendsRes.rows,
        monthly: monthlyTrendsRes.rows,
      },
      categoryRevenue: categoryRevRes.rows,
      topSellingProducts: topProductsRes.rows,
      recentSales: recentSalesRes.rows,
      salesHeatmap: heatmapRes.rows,
      aiInsights,
    });
  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
