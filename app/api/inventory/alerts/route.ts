import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    let sql = `
      SELECT 
        sa.alert_id,
        sa.product_id,
        p.product_name,
        c.category_name,
        s.supplier_name,
        sa.quantity_at_alert,
        sa.reorder_level,
        i.quantity_in_hand AS current_quantity,
        sa.alert_date,
        sa.alert_message,
        sa.status
      FROM stock_alert sa
      JOIN product p ON p.product_id = sa.product_id
      JOIN category c ON c.category_id = p.category_id
      JOIN supplier s ON s.supplier_id = p.supplier_id
      LEFT JOIN inventory i ON i.product_id = p.product_id
    `;

    const params: any[] = [];
    if (status !== 'ALL') {
      params.push(status);
      sql += ` WHERE sa.status = $1`;
    }

    sql += ` ORDER BY sa.alert_date DESC LIMIT 50`;

    const res = await query(sql, params);
    return NextResponse.json({ alerts: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { alert_id, status } = body;

    if (!alert_id || !status) {
      return NextResponse.json({ error: 'alert_id and status are required' }, { status: 400 });
    }

    const res = await query(`
      UPDATE stock_alert
      SET status = $1
      WHERE alert_id = $2
      RETURNING *
    `, [status, alert_id]);

    return NextResponse.json({ alert: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
