import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import { v4 as uuidv4 } from 'uuid';
import redis from './config/redis.js';

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
app.post('/api/controllers/:id/command', async (req, res) => {
    const { id } = req.params;
    const { command, duration } = req.body;

    try {
        const commandId = uuidv4();

        // Inizio transazione
        await pool.query('BEGIN');

        try {
            // Verifica stato del controllore
            const controllerStatus = await pool.query(
                'SELECT status FROM controllers WHERE id = $1',
                [id]
            );

            // Struttura comando
            const commandData = {
                id: commandId,
                command,
                duration,
                timestamp: new Date().toISOString()
            };

            // Ottieni l'irrigatore per questo controller
            const sprinklerResult = await pool.query(
                'SELECT id FROM sprinklers WHERE controller_id = $1 LIMIT 1',
                [id]
            );

            if (!controllerStatus.rows[0].status) {
                // Controllore offline - salva in coda Redis
                await redis.rpush(`commands:${id}`, JSON.stringify(commandData));

                if (sprinklerResult.rows.length > 0) {
                    // Salva nella cronologia come "QUEUED"
                    await pool.query(
                        'INSERT INTO command_history (id, controller_id, sprinkler_id, command_type, duration, status) VALUES ($1, $2, $3, $4, $5, $6)',
                        [commandId, id, sprinklerResult.rows[0].id, command, duration, 'QUEUED']
                    );
                }

                await pool.query('COMMIT');
                res.json({ status: 'queued', commandId });
            } else {
                // Procedi con comando diretto
                if (command === 'START') {
                    await pool.query(
                        'UPDATE controllers SET status = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                        [id]
                    );
                } else if (command === 'STOP') {
                    await pool.query(
                        'UPDATE controllers SET status = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                        [id]
                    );
                }

                if (sprinklerResult.rows.length > 0) {
                    const sprinklerId = sprinklerResult.rows[0].id;

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

                    await pool.query(
                        'INSERT INTO command_history (id, controller_id, sprinkler_id, command_type, duration, status) VALUES ($1, $2, $3, $4, $5, $6)',
                        [commandId, id, sprinklerId, command, duration, 'PENDING']
                    );
                }

                await pool.query('COMMIT');
                res.json({ status: 'sent', commandId });
            }
        } catch (err) {
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