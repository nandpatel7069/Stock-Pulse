import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(`
      SELECT category_id, category_name, description 
      FROM category 
      ORDER BY category_name ASC
    `);
    return NextResponse.json({ categories: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
