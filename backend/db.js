import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'IMS',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

export const query = (text, params) => pool.query(text, params);
export default pool;
