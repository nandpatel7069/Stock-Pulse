import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    if (!q.trim() || q.trim().length < 2) {
      return NextResponse.json({ results: { products: [], customers: [], sales: [] } });
    }

    const term = `%${q.trim()}%`;

    const [prodRes, custRes, salesRes] = await Promise.all([
      query(`
        SELECT 
          p.product_id, 
          p.product_name, 
          c.category_name, 
          p.unit_price,
          COALESCE(i.quantity_in_hand, 0) AS quantity_in_hand
        FROM product p
        JOIN category c ON c.category_id = p.category_id
        LEFT JOIN inventory i ON i.product_id = p.product_id
        WHERE p.product_name ILIKE $1 OR c.category_name ILIKE $1
        LIMIT 5
      `, [term]),

      query(`
        SELECT 
          customer_id, 
          customer_name, 
          phone, 
          email
        FROM customer
        WHERE customer_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
        LIMIT 5
      `, [term]),

      query(`
        SELECT 
          s.sales_id, 
          c.customer_name, 
          s.sales_date, 
          s.total_amount,
          p.payment_mode
        FROM sales s
        JOIN customer c ON c.customer_id = s.customer_id
        LEFT JOIN payment p ON p.sales_id = s.sales_id
        WHERE s.sales_id::TEXT ILIKE $1 OR c.customer_name ILIKE $1 OR p.reference_no ILIKE $1
        LIMIT 5
      `, [term]),
    ]);

    return NextResponse.json({
      results: {
        products: prodRes.rows,
        customers: custRes.rows,
        sales: salesRes.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
