import express from 'express';
import cors from 'cors';
import { pool, initializeDatabase } from './config/db.js';
import { v4 as uuidv4 } from 'uuid';
import redis from './config/redis.js';
import mqtt from './config/mqtt.js';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Inizializza il database all'avvio
initializeDatabase().catch(console.error);

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

// POST command per singolo irrigatore
app.post('/api/controllers/:controllerId/sprinklers/:sprinklerId/command', async (req, res) => {
    const { controllerId, sprinklerId } = req.params;
    const { command, duration } = req.body;

    try {
        await pool.query('BEGIN');

        const result = await pool.query(
            'SELECT c.status as controller_status, s.id as sprinkler_id ' +
            'FROM controllers c ' +
            'JOIN sprinklers s ON s.controller_id = c.id ' +
            'WHERE c.id = $1 AND s.id = $2',
            [parseInt(controllerId), parseInt(sprinklerId)]
        );

        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Controllore o irrigatore non trovato' });
        }

        const { controller_status } = result.rows[0];
        const commandId = uuidv4();

        const commandData = {
            id: commandId,
            sprinklerId: parseInt(sprinklerId),
            command,
            duration: duration || 0,
            timestamp: new Date().toISOString()
        };

        if (!controller_status) {
            // Controllore offline - salva in coda Redis
            await redis.rpush(`commands:${controllerId}`, JSON.stringify(commandData));

            await pool.query(
                'INSERT INTO command_history (id, controller_id, sprinkler_id, command_type, duration, status) ' +
                'VALUES ($1, $2, $3, $4, $5, $6)',
                [commandId, parseInt(controllerId), parseInt(sprinklerId), command, duration || 0, 'QUEUED']
            );

            await pool.query('COMMIT');
            res.json({ status: 'queued', commandId });
        } else {
            // Controllore online - invia comando MQTT
            mqtt.publish(`controllers/${controllerId}/command`, JSON.stringify(commandData));

            if (command === 'START') {
                await pool.query(
                    'UPDATE sprinklers SET status = true, duration = $1 WHERE id = $2',
                    [duration || 0, parseInt(sprinklerId)]
                );
            } else if (command === 'STOP') {
                await pool.query(
                    'UPDATE sprinklers SET status = false, duration = 0 WHERE id = $1',
                    [parseInt(sprinklerId)]
                );
            }

            await pool.query(
                'INSERT INTO command_history (id, controller_id, sprinkler_id, command_type, duration, status) ' +
                'VALUES ($1, $2, $3, $4, $5, $6)',
                [commandId, parseInt(controllerId), parseInt(sprinklerId), command, duration || 0, 'QUEUED']
            );

            await pool.query('COMMIT');
            res.json({ status: 'sent', commandId });
        }
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error executing command:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});