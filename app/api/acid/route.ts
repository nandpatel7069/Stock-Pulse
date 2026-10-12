import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [auditRes, alertRes, productsRes] = await Promise.all([
      query(`
        SELECT 
          log_id,
          table_name,
          action,
          record_id,
          old_data,
          new_data,
          changed_at,
          changed_by
        FROM audit_log
        ORDER BY log_id DESC
        LIMIT 12
      `),
      query(`
        SELECT 
          sa.alert_id,
          sa.product_id,
          p.product_name,
          sa.quantity_at_alert,
          sa.reorder_level,
          sa.alert_date,
          sa.alert_message,
          sa.status
        FROM stock_alert sa
        JOIN product p ON p.product_id = sa.product_id
        ORDER BY sa.alert_id DESC
        LIMIT 10
      `),
      query(`
        SELECT 
          p.product_id,
          p.product_name,
          p.unit_price,
          p.reorder_level,
          COALESCE(i.quantity_in_hand, 0) AS quantity_in_hand
        FROM product p
        LEFT JOIN inventory i ON i.product_id = p.product_id
        WHERE p.product_id IN (1, 2, 3, 9, 26, 35)
        ORDER BY p.product_id ASC
      `),
    ]);

    return NextResponse.json({
      auditLogs: auditRes.rows,
      stockAlerts: alertRes.rows,
      sampleProducts: productsRes.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenario } = body;

    if (scenario === 'success') {
      const prodId = 1; // Aashirvaad Atta
      const preRes = await query(`SELECT quantity_in_hand FROM inventory WHERE product_id = $1`, [prodId]);
      const stockBefore = preRes.rows[0]?.quantity_in_hand;

      const sqlExecuted = `CALL sp_create_sale(
  1, 
  '[{"product_id": 1, "quantity": 1, "discount": 10.00}]'::jsonb, 
  'UPI', 
  'ACID-DEMO-SUCCESS', 
  NULL
);`;

      const saleRes = await query(`CALL sp_create_sale($1, $2::jsonb, $3, $4, NULL)`, [
        1,
        JSON.stringify([{ product_id: prodId, quantity: 1, discount: 10.0 }]),
        'UPI',
        `ACID-SUCCESS-${Date.now()}`,
      ]);

      const salesId = saleRes.rows[0]?.p_sales_id;
      const postRes = await query(`SELECT quantity_in_hand FROM inventory WHERE product_id = $1`, [prodId]);
      const stockAfter = postRes.rows[0]?.quantity_in_hand;

      return NextResponse.json({
        scenario: 'success',
        status: 'SUCCESS',
        productName: 'Aashirvaad Superior MP Shudh Chakki Atta 5kg',
        stockBefore,
        stockAfter,
        salesId,
        sqlExecuted,
        explanation: 'Transaction committed successfully. Triggers calculated subtotal, decremented inventory by 1, and created synchronized payment record in 1 atomic step.',
      });
    }

    if (scenario === 'oversell') {
      // Find a low stock SKU
      const lowProdRes = await query(`
        SELECT p.product_id, p.product_name, i.quantity_in_hand, p.reorder_level
        FROM product p
        JOIN inventory i ON i.product_id = p.product_id
        ORDER BY i.quantity_in_hand ASC
        LIMIT 1
      `);
      const targetProd = lowProdRes.rows[0];
      const prodId = targetProd.product_id;
      const stockBefore = targetProd.quantity_in_hand;
      const requestedQty = stockBefore + 200;

      const sqlExecuted = `-- Attempting to sell ${requestedQty} units when only ${stockBefore} are available
CALL sp_create_sale(
  1, 
  '[{"product_id": ${prodId}, "quantity": ${requestedQty}}]'::jsonb, 
  'Cash', 
  'ACID-DEMO-OVERSELL', 
  NULL
);`;

      let errorCaught = '';
      try {
        await query(`CALL sp_create_sale($1, $2::jsonb, $3, $4, NULL)`, [
          1,
          JSON.stringify([{ product_id: prodId, quantity: requestedQty }]),
          'Cash',
          'ACID-DEMO-OVERSELL',
        ]);
      } catch (err: any) {
        errorCaught = err.message;
      }

      const postRes = await query(`SELECT quantity_in_hand FROM inventory WHERE product_id = $1`, [prodId]);
      const stockAfter = postRes.rows[0]?.quantity_in_hand;

      return NextResponse.json({
        scenario: 'oversell',
        status: 'REJECTED',
        productName: targetProd.product_name,
        stockBefore,
        stockAfter,
        requestedQty,
        sqlExecuted,
        errorMessage: errorCaught,
        explanation: 'The database trigger "trg_sync_inventory_on_sales_detail" executed a pessimistic check and raised an exception, immediately preventing overselling and preserving inventory integrity.',
      });
    }

    if (scenario === 'rollback') {
      const validProdId = 2; // Fortune Sunflower Oil
      const overProdId = 26; // Nescafe Classic (low stock)

      const preRes = await query(`SELECT quantity_in_hand FROM inventory WHERE product_id = $1`, [validProdId]);
      const stockBefore = preRes.rows[0]?.quantity_in_hand;

      const preSalesCount = await query(`SELECT COUNT(*) FROM sales`);
      const salesCountBefore = parseInt(preSalesCount.rows[0].count, 10);

      const sqlExecuted = `-- Multi-item transaction where Item 1 is valid, but Item 2 fails stock check
BEGIN;
CALL sp_create_sale(
  1, 
  '[{"product_id": 2, "quantity": 1}, {"product_id": 26, "quantity": 9999}]'::jsonb, 
  'Card', 
  'ACID-DEMO-ROLLBACK', 
  NULL
);
-- When Item 2 fails, PostgreSQL automatically executes ROLLBACK!`;

      let errorCaught = '';
      try {
        await query(`CALL sp_create_sale($1, $2::jsonb, $3, $4, NULL)`, [
          1,
          JSON.stringify([
            { product_id: validProdId, quantity: 1 },
            { product_id: overProdId, quantity: 9999 },
          ]),
          'Card',
          'ACID-DEMO-ROLLBACK',
        ]);
      } catch (err: any) {
        errorCaught = err.message;
      }

      const postRes = await query(`SELECT quantity_in_hand FROM inventory WHERE product_id = $1`, [validProdId]);
      const stockAfter = postRes.rows[0]?.quantity_in_hand;

      const postSalesCount = await query(`SELECT COUNT(*) FROM sales`);
      const salesCountAfter = parseInt(postSalesCount.rows[0].count, 10);

      return NextResponse.json({
        scenario: 'rollback',
        status: 'ROLLED_BACK',
        productName: 'Fortune Sunlite Sunflower Oil (Item 1 in Cart)',
        stockBefore,
        stockAfter,
        salesCountBefore,
        salesCountAfter,
        sqlExecuted,
        errorMessage: errorCaught,
        explanation: 'Atomicity Guaranteed: Even though Item 1 had ample stock, the failure on Item 2 triggered a complete rollback. Stock of Item 1 was untouched (no partial updates), and 0 orphan sales headers were created.',
      });
    }

    return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
