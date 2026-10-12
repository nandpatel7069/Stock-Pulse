import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const ProductSchema = z.object({
  product_name: z.string().min(2, 'Product name is required'),
  category_id: z.number().int().positive('Category is required'),
  supplier_id: z.number().int().positive('Supplier is required'),
  unit_price: z.number().positive('Unit price must be greater than 0'),
  reorder_level: z.number().int().min(0).default(10),
  initial_stock: z.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const categoryId = searchParams.get('category_id');
    const supplierId = searchParams.get('supplier_id');
    const stockStatus = searchParams.get('status');

    let sql = `
      SELECT 
        p.product_id,
        p.product_name,
        p.category_id,
        c.category_name,
        p.supplier_id,
        s.supplier_name,
        p.unit_price,
        p.reorder_level,
        COALESCE(i.quantity_in_hand, 0) AS quantity_in_hand,
        i.last_updated,
        CASE
          WHEN COALESCE(i.quantity_in_hand, 0) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(i.quantity_in_hand, 0) <= p.reorder_level THEN 'CRITICAL'
          WHEN COALESCE(i.quantity_in_hand, 0) <= p.reorder_level * 1.5 THEN 'LOW'
          ELSE 'HEALTHY'
        END AS stock_status
      FROM product p
      JOIN category c ON c.category_id = p.category_id
      JOIN supplier s ON s.supplier_id = p.supplier_id
      LEFT JOIN inventory i ON i.product_id = p.product_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (p.product_name ILIKE $${params.length} OR c.category_name ILIKE $${params.length} OR s.supplier_name ILIKE $${params.length})`;
    }

    if (categoryId && categoryId !== 'all') {
      params.push(parseInt(categoryId, 10));
      sql += ` AND p.category_id = $${params.length}`;
    }

    if (supplierId && supplierId !== 'all') {
      params.push(parseInt(supplierId, 10));
      sql += ` AND p.supplier_id = $${params.length}`;
    }

    if (stockStatus && stockStatus !== 'all') {
      if (stockStatus === 'CRITICAL') {
        sql += ` AND COALESCE(i.quantity_in_hand, 0) <= p.reorder_level`;
      } else if (stockStatus === 'OUT_OF_STOCK') {
        sql += ` AND COALESCE(i.quantity_in_hand, 0) = 0`;
      } else if (stockStatus === 'HEALTHY') {
        sql += ` AND COALESCE(i.quantity_in_hand, 0) > p.reorder_level`;
      }
    }

    sql += ` ORDER BY p.product_id ASC`;

    const res = await query(sql, params);
    return NextResponse.json({ products: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { product_name, category_id, supplier_id, unit_price, reorder_level, initial_stock } = parsed.data;

    // Insert product
    const prodRes = await query(`
      INSERT INTO product (product_name, category_id, supplier_id, unit_price, reorder_level)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [product_name, category_id, supplier_id, unit_price, reorder_level]);

    const newProd = prodRes.rows[0];

    // Initialize inventory record
    await query(`
      INSERT INTO inventory (product_id, quantity_in_hand, last_updated)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id) DO UPDATE 
      SET quantity_in_hand = EXCLUDED.quantity_in_hand
    `, [newProd.product_id, initial_stock]);

    return NextResponse.json({ product: newProd }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, product_name, category_id, supplier_id, unit_price, reorder_level } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const res = await query(`
      UPDATE product
      SET product_name = $1, category_id = $2, supplier_id = $3, unit_price = $4, reorder_level = $5
      WHERE product_id = $6
      RETURNING *
    `, [product_name, category_id, supplier_id, unit_price, reorder_level, product_id]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('id');
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    await query(`DELETE FROM product WHERE product_id = $1`, [productId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Cannot delete product: Historical sales line items reference this product (Foreign Key RESTRICT rule).' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
