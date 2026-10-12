import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, quantity } = body;

    const prodId = parseInt(product_id, 10);
    const qty = parseInt(quantity, 10);

    if (!prodId || !qty || qty <= 0) {
      return NextResponse.json({ error: 'Valid product_id and positive quantity are required' }, { status: 400 });
    }

    // Call stored procedure sp_receive_shipment
    await query(`CALL sp_receive_shipment($1, $2)`, [prodId, qty]);

    // Fetch updated balance and product name
    const updated = await query(`
      SELECT 
        p.product_id, 
        p.product_name, 
        i.quantity_in_hand, 
        p.reorder_level,
        i.last_updated
      FROM product p
      JOIN inventory i ON i.product_id = p.product_id
      WHERE p.product_id = $1
    `, [prodId]);

    return NextResponse.json({
      success: true,
      message: `Shipment of ${qty} units successfully inwarded.`,
      product: updated.rows[0],
    });
  } catch (error: any) {
    console.error('Shipment Inward Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to receive shipment' }, { status: 500 });
  }
}
