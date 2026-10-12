import mysql from 'mysql2/promise';
import type { Pool, PoolConnection } from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: Pool | undefined;
}

const pool: Pool =
  globalThis.mysqlPool ||
  mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'retail_db',
    waitForConnections: true,
    connectionLimit: 20,
    decimalNumbers: true,
    multipleStatements: true,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.mysqlPool = pool;
}

function translateQuery(text: string): string {
  let sql = text;

  // 1. Remove PostgreSQL type casts
  sql = sql.replace(/::jsonb/gi, '');
  sql = sql.replace(/::TEXT/gi, '');
  sql = sql.replace(/::TIMESTAMP/gi, '');
  sql = sql.replace(/::NUMERIC/gi, '');
  sql = sql.replace(/::INT/gi, '');

  // 2. sales_date::DATE -> DATE(sales_date)
  sql = sql.replace(/([a-zA-Z0-9_.]+)::DATE/gi, 'DATE($1)');

  // 3. TO_CHAR conversions
  sql = sql.replace(/TO_CHAR\(\s*sale_date\s*,\s*'YYYY-MM-DD'\s*\)/gi, "DATE_FORMAT(sale_date, '%Y-%m-%d')");
  sql = sql.replace(/TO_CHAR\(\s*sales_date\s*,\s*'YYYY-MM-DD'\s*\)/gi, "DATE_FORMAT(sales_date, '%Y-%m-%d')");
  sql = sql.replace(/TO_CHAR\(\s*s\.sales_date\s*,\s*'YYYY-MM-DD'\s*\)/gi, "DATE_FORMAT(s.sales_date, '%Y-%m-%d')");
  sql = sql.replace(/TRIM\s*\(\s*TO_CHAR\s*\(\s*sales_date\s*,\s*'Day'\s*\)\s*\)/gi, "DAYNAME(sales_date)");

  // 4. EXTRACT conversions
  sql = sql.replace(/EXTRACT\s*\(\s*DOW\s+FROM\s+sales_date\s*\)/gi, "(DAYOFWEEK(sales_date) - 1)");
  sql = sql.replace(/EXTRACT\s*\(\s*HOUR\s+FROM\s+sales_date\s*\)/gi, "HOUR(sales_date)");
  sql = sql.replace(/EXTRACT\s*\(\s*YEAR\s+FROM\s+sales_date\s*\)/gi, "YEAR(sales_date)");
  sql = sql.replace(/EXTRACT\s*\(\s*MONTH\s+FROM\s+sales_date\s*\)/gi, "MONTH(sales_date)");

  // 5. ILIKE -> LIKE
  sql = sql.replace(/\bILIKE\b/gi, 'LIKE');

  // 6. Parameter placeholders: replace $1, $2, ... with ?
  sql = sql.replace(/\$\d+/g, '?');

  return sql;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: any[];
  insertId?: number;
}

export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const start = Date.now();
  const norm = text.trim();

  try {
    // Special handling for sp_create_sale
    if (norm.toUpperCase().startsWith('CALL SP_CREATE_SALE')) {
      const conn = await pool.getConnection();
      try {
        await conn.query('SET @p_sales_id = NULL;');
        const callSql = 'CALL sp_create_sale(?, ?, ?, ?, @p_sales_id);';
        const callParams = [params[0], params[1], params[2], params[3] || null];
        await conn.query(callSql, callParams);
        const [outRows]: any = await conn.query('SELECT @p_sales_id AS p_sales_id;');
        return {
          rows: outRows as T[],
          rowCount: outRows.length,
          fields: [],
        };
      } finally {
        conn.release();
      }
    }

    // Special handling for RETURNING * in INSERT / UPDATE
    const returningMatch = norm.match(/RETURNING\s+\*/i);
    if (returningMatch) {
      const sqlWithoutReturning = translateQuery(norm.replace(/RETURNING\s+\*/i, '').trim());
      const isInsert = /^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i.exec(norm);
      const isUpdate = /^\s*UPDATE\s+([a-zA-Z0-9_]+)/i.exec(norm);

      const pkMap: Record<string, string> = {
        supplier: 'supplier_id',
        category: 'category_id',
        product: 'product_id',
        customer: 'customer_id',
        inventory: 'inventory_id',
        sales: 'sales_id',
        sales_detail: 'sales_detail_id',
        payment: 'payment_id',
        stock_alert: 'alert_id',
        audit_log: 'log_id',
      };

      if (isInsert) {
        const tableName = isInsert[1].toLowerCase();
        const pk = pkMap[tableName] || 'id';
        const [res]: any = await pool.query(sqlWithoutReturning, params);
        const insertId = res.insertId;
        const [fetched]: any = await pool.query(`SELECT * FROM ${tableName} WHERE ${pk} = ?`, [insertId]);
        return { rows: fetched as T[], rowCount: fetched.length, fields: [], insertId };
      }

      if (isUpdate) {
        const tableName = isUpdate[1].toLowerCase();
        const pk = pkMap[tableName] || 'id';
        await pool.query(sqlWithoutReturning, params);
        const lastParam = params[params.length - 1];
        const [fetched]: any = await pool.query(`SELECT * FROM ${tableName} WHERE ${pk} = ?`, [lastParam]);
        return { rows: fetched as T[], rowCount: fetched.length, fields: [] };
      }
    }

    const translated = translateQuery(norm);
    const [results, fields]: any = await pool.query(translated, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`Slow Query (${duration}ms):`, translated);
    }

    if (Array.isArray(results)) {
      return {
        rows: results as T[],
        rowCount: results.length,
        fields: fields || [],
      };
    }

    return {
      rows: [],
      rowCount: results?.affectedRows || 0,
      insertId: results?.insertId,
      fields: fields || [],
    };
  } catch (error) {
    console.error('Database Query Error:', { text, error });
    throw error;
  }
}

export async function getClient(): Promise<PoolConnection> {
  return await pool.getConnection();
}

export default pool;
