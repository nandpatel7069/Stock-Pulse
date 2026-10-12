import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const paymentMode = searchParams.get('payment_mode');
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        s.sales_id,
        s.customer_id,
        c.customer_name,
        c.phone AS customer_phone,
        s.sales_date,
        s.total_amount,
        p.payment_mode,
        p.reference_no,
        COUNT(sd.sales_detail_id) AS items_count,
        SUM(sd.quantity) AS total_quantity
      FROM sales s
      JOIN customer c ON c.customer_id = s.customer_id
      LEFT JOIN payment p ON p.sales_id = s.sales_id
      LEFT JOIN sales_detail sd ON sd.sales_id = s.sales_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (c.customer_name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR p.reference_no ILIKE $${params.length} OR s.sales_id::TEXT ILIKE $${params.length})`;
    }

    if (paymentMode && paymentMode !== 'all') {
      params.push(paymentMode);
      sql += ` AND p.payment_mode = $${params.length}`;
    }

    if (customerId && customerId !== 'all') {
      params.push(parseInt(customerId, 10));
      sql += ` AND s.customer_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND s.sales_date >= $${params.length}::TIMESTAMP`;
    }

    if (endDate) {
      params.push(`${endDate} 23:59:59`);
      sql += ` AND s.sales_date <= $${params.length}::TIMESTAMP`;
    }

    sql += `
      GROUP BY s.sales_id, s.customer_id, c.customer_name, c.phone, s.sales_date, s.total_amount, p.payment_mode, p.reference_no
      ORDER BY s.sales_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const res = await query(sql, params);

    return NextResponse.json({ sales: res.rows, page, limit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
