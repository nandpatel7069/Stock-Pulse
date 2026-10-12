import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const filter = searchParams.get('filter'); // 'low', 'all'

    let sql = `
      SELECT 
        i.inventory_id,
        i.product_id,
        p.product_name,
        c.category_name,
        s.supplier_name,
        p.unit_price,
        p.reorder_level,
        i.quantity_in_hand,
        ROUND(i.quantity_in_hand * p.unit_price, 2) AS stock_valuation,
        i.last_updated,
        CASE
          WHEN i.quantity_in_hand = 0 THEN 'OUT_OF_STOCK'
          WHEN i.quantity_in_hand <= p.reorder_level THEN 'CRITICAL'
          WHEN i.quantity_in_hand <= p.reorder_level * 1.5 THEN 'LOW'
          ELSE 'HEALTHY'
        END AS stock_status,
        -- Progress percentage benchmarked against 3x reorder level
        LEAST(100, ROUND((i.quantity_in_hand::NUMERIC / GREATEST(1, p.reorder_level * 3)) * 100)) AS stock_progress_pct
      FROM inventory i
      JOIN product p ON p.product_id = i.product_id
      JOIN category c ON c.category_id = p.category_id
      JOIN supplier s ON s.supplier_id = p.supplier_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (p.product_name ILIKE $${params.length} OR s.supplier_name ILIKE $${params.length})`;
    }

    if (category && category !== 'all') {
      params.push(parseInt(category, 10));
      sql += ` AND p.category_id = $${params.length}`;
    }

    if (filter === 'low') {
      sql += ` AND i.quantity_in_hand <= p.reorder_level`;
    }

    sql += ` ORDER BY (i.quantity_in_hand <= p.reorder_level) DESC, i.quantity_in_hand ASC`;

    const res = await query(sql, params);
    return NextResponse.json({ items: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, new_quantity } = body;

    if (!product_id || new_quantity === undefined || new_quantity < 0) {
      return NextResponse.json({ error: 'Valid product_id and non-negative quantity required' }, { status: 400 });
    }

    const res = await query(`
      UPDATE inventory
      SET quantity_in_hand = $1, last_updated = CURRENT_TIMESTAMP
      WHERE product_id = $2
      RETURNING *
    `, [new_quantity, product_id]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Inventory record not found' }, { status: 404 });
    }

    return NextResponse.json({ item: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
