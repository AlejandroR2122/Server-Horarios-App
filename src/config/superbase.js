import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.DB_HOST,       // aws-1-us-east-2.pooler.supabase.com
  port: process.env.DB_PORT,       // 6543
  database: process.env.DB_NAME,   // postgres
  user: process.env.DB_USER,       // postgres.sakflirgrpuzugqczksw
  password: process.env.DB_PASS,   // tu contraseña
  ssl: { rejectUnauthorized: false }, // necesario para Supabase
});
