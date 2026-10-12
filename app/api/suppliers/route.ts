import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const SupplierSchema = z.object({
  supplier_name: z.string().min(2, 'Supplier name required'),
  phone: z.string().min(8, 'Phone number required'),
  email: z.string().email('Valid email required'),
  address: z.string().min(5, 'Address required'),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('id');

    if (supplierId) {
      // Return single supplier with supplied products
      const supRes = await query(`SELECT * FROM supplier WHERE supplier_id = $1`, [supplierId]);
      if (supRes.rows.length === 0) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
      }

      const productsRes = await query(`
        SELECT 
          p.product_id, 
          p.product_name, 
          c.category_name, 
          p.unit_price, 
          p.reorder_level, 
          COALESCE(i.quantity_in_hand, 0) AS quantity_in_hand
        FROM product p
        JOIN category c ON c.category_id = p.category_id
        LEFT JOIN inventory i ON i.product_id = p.product_id
        WHERE p.supplier_id = $1
        ORDER BY p.product_name ASC
      `, [supplierId]);

      return NextResponse.json({
        supplier: supRes.rows[0],
        products: productsRes.rows,
      });
    }

    // Return all suppliers with stats from v_supplier_product_map
    const res = await query(`
      SELECT 
        s.supplier_id,
        s.supplier_name,
        s.phone,
        s.email,
        s.address,
        COALESCE(m.total_products_supplied, 0) AS total_products_supplied,
        COALESCE(m.total_stock_units, 0) AS total_stock_units,
        COALESCE(m.total_stock_value, 0) AS total_stock_value,
        COALESCE(m.low_stock_item_count, 0) AS low_stock_item_count,
        m.categories_supplied
      FROM supplier s
      LEFT JOIN v_supplier_product_map m ON m.supplier_id = s.supplier_id
      ORDER BY s.supplier_id ASC
    `);

    return NextResponse.json({ suppliers: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { supplier_name, phone, email, address } = parsed.data;
    const res = await query(`
      INSERT INTO supplier (supplier_name, phone, email, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [supplier_name, phone, email, address]);

    return NextResponse.json({ supplier: res.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A supplier with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { supplier_id, supplier_name, phone, email, address } = body;
    if (!supplier_id) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    const res = await query(`
      UPDATE supplier 
      SET supplier_name = $1, phone = $2, email = $3, address = $4
      WHERE supplier_id = $5
      RETURNING *
    `, [supplier_name, phone, email, address, supplier_id]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json({ supplier: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('id');
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID required' }, { status: 400 });
    }

    await query(`DELETE FROM supplier WHERE supplier_id = $1`, [supplierId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Cannot delete supplier: Products are currently mapped to this supplier (Foreign Key RESTRICT rule).' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
