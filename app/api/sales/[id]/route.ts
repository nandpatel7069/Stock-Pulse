import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const saleId = parseInt(params.id, 10);
    if (!saleId) {
      return NextResponse.json({ error: 'Valid sales ID required' }, { status: 400 });
    }

    const saleRes = await query(`
      SELECT 
        s.sales_id,
        s.customer_id,
        c.customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address,
        s.sales_date,
        s.total_amount,
        p.payment_mode,
        p.reference_no,
        p.payment_date
      FROM sales s
      JOIN customer c ON c.customer_id = s.customer_id
      LEFT JOIN payment p ON p.sales_id = s.sales_id
      WHERE s.sales_id = $1
    `, [saleId]);

    if (saleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Sale record not found' }, { status: 404 });
    }

    const detailsRes = await query(`
      SELECT 
        sd.sales_detail_id,
        sd.sales_id,
        sd.product_id,
        p.product_name,
        c.category_name,
        sd.quantity,
        sd.unit_price,
        sd.discount,
        sd.sub_total,
        COALESCE(i.quantity_in_hand, 0) AS current_stock
      FROM sales_detail sd
      JOIN product p ON p.product_id = sd.product_id
      JOIN category c ON c.category_id = p.category_id
      LEFT JOIN inventory i ON i.product_id = p.product_id
      WHERE sd.sales_id = $1
      ORDER BY sd.sales_detail_id ASC
    `, [saleId]);

    return NextResponse.json({
      sale: saleRes.rows[0],
      items: detailsRes.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
