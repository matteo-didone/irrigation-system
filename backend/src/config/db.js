import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);  // Corretto __dirname invece di dirname

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'irrigation',
    user: process.env.DB_USER || 'irrigation_user',
    password: process.env.DB_PASSWORD || 'development_password',
});

async function initializeDatabase() {
    try {
        const sqlPath = path.join(__dirname, '..', 'db', 'init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('Database initialized successfully');
        return true;
    } catch (error) {
        if (error.code === '42P07') {
            console.log('Database tables already initialized');
            return true;
        }
        console.error('Error initializing database:', error);
        throw error;
    }
}

export { pool, initializeDatabase };