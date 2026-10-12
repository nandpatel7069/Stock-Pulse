import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'sales_summary';

    let data: any[] = [];

    switch (type) {
      case 'sales_summary': {
        const res = await query(`
          SELECT 
            sale_date,
            total_orders,
            total_units_sold,
            gross_revenue,
            total_discounts,
            net_revenue,
            avg_order_value
          FROM v_daily_sales
          ORDER BY sale_date DESC
          LIMIT 90
        `);
        data = res.rows;
        break;
      }

      case 'product_performance': {
        const res = await query(`
          SELECT 
            product_id,
            product_name,
            category_name,
            supplier_name,
            unit_price,
            units_sold,
            gross_revenue,
            total_discounts,
            net_revenue,
            total_orders_count,
            current_stock_in_hand,
            stock_turnover_ratio
          FROM v_product_wise_sales
          ORDER BY net_revenue DESC
        `);
        data = res.rows;
        break;
      }

      case 'inventory_valuation': {
        const res = await query(`
          SELECT 
            category_id,
            category_name,
            total_sku_count,
            total_units_in_hand,
            total_inventory_value,
            avg_unit_price,
            min_unit_price,
            max_unit_price
          FROM v_inventory_valuation
          ORDER BY total_inventory_value DESC
        `);
        data = res.rows;
        break;
      }

      case 'supplier_performance': {
        const res = await query(`
          SELECT 
            supplier_id,
            supplier_name,
            supplier_phone,
            supplier_email,
            total_products_supplied,
            categories_supplied,
            total_stock_units,
            total_stock_value,
            low_stock_item_count
          FROM v_supplier_product_map
          ORDER BY total_stock_value DESC
        `);
        data = res.rows;
        break;
      }

      case 'top_customers': {
        const res = await query(`
          SELECT 
            customer_id,
            customer_name,
            phone,
            email,
            total_orders,
            total_spent,
            avg_order_value,
            customer_tier,
            latest_purchase_date
          FROM v_top_customers
          ORDER BY total_spent DESC
        `);
        data = res.rows;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    return NextResponse.json({ type, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
