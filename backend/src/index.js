import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// GET controllers
app.get('/api/controllers', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT c.*, 
        (SELECT json_agg(s.*) 
         FROM sprinklers s 
         WHERE s.controller_id = c.id) as sprinklers
      FROM controllers c 
      ORDER BY c.created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching controllers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST command
// POST command
app.post('/api/controllers/:id/command', async (req, res) => {
    const { id } = req.params;
    const { command, duration } = req.body;

    try {
        // Inizio transazione
        await pool.query('BEGIN');

        try {
            // Se è un comando START, imposta il controller come online
            if (command === 'START') {
                await pool.query(
                    'UPDATE controllers SET status = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                    [id]
                );
            }
            // Se è un comando STOP, imposta il controller come offline
            else if (command === 'STOP') {
                await pool.query(
                    'UPDATE controllers SET status = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                    [id]
                );
            }

            // Ottieni l'irrigatore per questo controller
            const sprinklerResult = await pool.query(
                'SELECT id FROM sprinklers WHERE controller_id = $1 LIMIT 1',
                [id]
            );

            if (sprinklerResult.rows.length > 0) {
                const sprinklerId = sprinklerResult.rows[0].id;

                // Aggiorna lo stato dell'irrigatore in base al comando
                if (command === 'START') {
                    await pool.query(
                        'UPDATE sprinklers SET status = true, duration = $1 WHERE id = $2',
                        [duration, sprinklerId]
                    );
                } else if (command === 'STOP') {
                    await pool.query(
                        'UPDATE sprinklers SET status = false, duration = 0 WHERE id = $1',
                        [sprinklerId]
                    );
                }

                // Inserisci nella cronologia dei comandi
                await pool.query(
                    'INSERT INTO command_history (controller_id, sprinkler_id, command_type, duration, status) VALUES ($1, $2, $3, $4, $5)',
                    [id, sprinklerId, command, duration, 'DELIVERED']
                );
            }

            // Commit transazione
            await pool.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            // Rollback in caso di errore
            await pool.query('ROLLBACK');
            throw err;
        }
    } catch (error) {
        console.error('Error executing command:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});