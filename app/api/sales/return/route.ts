import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sales_detail_id, quantity } = body;

    const detailId = parseInt(sales_detail_id, 10);
    const returnQty = parseInt(quantity, 10);

    if (!detailId || !returnQty || returnQty <= 0) {
      return NextResponse.json({ error: 'Valid sales_detail_id and positive return quantity required' }, { status: 400 });
    }

    // Call stored procedure sp_process_return
    await query(`CALL sp_process_return($1, $2)`, [detailId, returnQty]);

    return NextResponse.json({
      success: true,
      message: `Return of ${returnQty} units processed. Inventory restocked and order total recalculated.`,
    });
  } catch (error: any) {
    console.error('Process Return Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process return' }, { status: 400 });
  }
}
