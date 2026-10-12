import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const CustomerSchema = z.object({
  customer_name: z.string().min(2, 'Customer name required'),
  phone: z.string().min(8, 'Phone required'),
  email: z.string().email('Valid email required').or(z.literal('')).optional(),
  address: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');

    if (customerId) {
      // Return customer profile + full purchase history
      const custRes = await query(`
        SELECT 
          c.*,
          COALESCE(tc.total_orders, 0) AS total_orders,
          COALESCE(tc.total_spent, 0) AS total_spent,
          COALESCE(tc.avg_order_value, 0) AS avg_order_value,
          COALESCE(tc.customer_tier, 'Bronze') AS customer_tier
        FROM customer c
        LEFT JOIN v_top_customers tc ON tc.customer_id = c.customer_id
        WHERE c.customer_id = $1
      `, [customerId]);

      if (custRes.rows.length === 0) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      const ordersRes = await query(`
        SELECT 
          s.sales_id,
          s.sales_date,
          s.total_amount,
          p.payment_mode,
          p.reference_no,
          (SELECT COUNT(*) FROM sales_detail sd WHERE sd.sales_id = s.sales_id) AS items_count
        FROM sales s
        LEFT JOIN payment p ON p.sales_id = s.sales_id
        WHERE s.customer_id = $1
        ORDER BY s.sales_date DESC
      `, [customerId]);

      return NextResponse.json({
        customer: custRes.rows[0],
        orders: ordersRes.rows,
      });
    }

    // Return list of customers with loyalty stats
    const res = await query(`
      SELECT 
        c.customer_id,
        c.customer_name,
        c.phone,
        c.email,
        c.address,
        COALESCE(tc.total_orders, 0) AS total_orders,
        COALESCE(tc.total_spent, 0) AS total_spent,
        COALESCE(tc.avg_order_value, 0) AS avg_order_value,
        COALESCE(tc.customer_tier, 'Bronze') AS customer_tier,
        tc.first_purchase_date,
        tc.latest_purchase_date
      FROM customer c
      LEFT JOIN v_top_customers tc ON tc.customer_id = c.customer_id
      ORDER BY total_spent DESC, c.customer_name ASC
    `);

    return NextResponse.json({ customers: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { customer_name, phone, email, address } = parsed.data;
    const res = await query(`
      INSERT INTO customer (customer_name, phone, email, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [customer_name, phone, email || null, address || null]);

    return NextResponse.json({ customer: res.rows[0] }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A customer with this phone number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_id, customer_name, phone, email, address } = body;
    if (!customer_id) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    const res = await query(`
      UPDATE customer
      SET customer_name = $1, phone = $2, email = $3, address = $4
      WHERE customer_id = $5
      RETURNING *
    `, [customer_name, phone, email || null, address || null, customer_id]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customer: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    await query(`DELETE FROM customer WHERE customer_id = $1`, [customerId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Cannot delete customer: Purchase transaction history exists (Foreign Key RESTRICT rule).' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
