import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const CheckoutSchema = z.object({
  customer_id: z.number().int().positive('Customer is required'),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().int().positive('Quantity must be greater than 0'),
      discount: z.number().min(0).default(0),
      unit_price: z.number().positive().optional(),
    })
  ).min(1, 'Cart must have at least one product'),
  payment_mode: z.enum(['Cash', 'Card', 'UPI', 'NetBanking']),
  reference_no: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { customer_id, items, payment_mode, reference_no } = parsed.data;

    // Call stored procedure sp_create_sale
    // Runs as ONE single ACID transaction. Triggers validate stock, calculate subtotals,
    // sync order totals, insert payment, and log alerts/audits.
    const res = await query(
      `CALL sp_create_sale($1, $2::jsonb, $3, $4, NULL)`,
      [customer_id, JSON.stringify(items), payment_mode, reference_no || null]
    );

    const salesId = res.rows[0]?.p_sales_id;
    if (!salesId) {
      throw new Error('Failed to retrieve generated sales ID');
    }

    // Fetch finalized sale details for receipt display
    const saleHeader = await query(`
      SELECT 
        s.sales_id,
        s.sales_date,
        s.total_amount,
        c.customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        p.payment_mode,
        p.reference_no,
        p.amount AS settled_amount
      FROM sales s
      JOIN customer c ON c.customer_id = s.customer_id
      JOIN payment p  ON p.sales_id = s.sales_id
      WHERE s.sales_id = $1
    `, [salesId]);

    const lineItems = await query(`
      SELECT 
        sd.sales_detail_id,
        sd.product_id,
        pr.product_name,
        cat.category_name,
        sd.quantity,
        sd.unit_price,
        sd.discount,
        sd.sub_total
      FROM sales_detail sd
      JOIN product pr ON pr.product_id = sd.product_id
      JOIN category cat ON cat.category_id = pr.category_id
      WHERE sd.sales_id = $1
      ORDER BY sd.sales_detail_id ASC
    `, [salesId]);

    return NextResponse.json({
      success: true,
      sales_id: salesId,
      receipt: {
        order: saleHeader.rows[0],
        items: lineItems.rows,
      },
    });
  } catch (error: any) {
    console.error('Checkout Transaction Error:', error);
    // Provide user-friendly trigger error messages
    const errorMsg = error.message || 'Transaction failed';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
