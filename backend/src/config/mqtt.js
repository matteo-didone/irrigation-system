import mqtt from 'mqtt';
import { pool } from './db.js';
import redis from './config/redis.js';

const client = mqtt.connect('mqtt://mosquitto:1883');

// Funzione per processare i comandi in coda
async function processQueuedCommands(controllerId) {
    const command = await redis.lpop(`commands:${controllerId}`);
    if (command) {
        const parsedCommand = JSON.parse(command);
        client.publish(`controllers/${controllerId}/command`, JSON.stringify(parsedCommand));

        // Aggiorna lo stato del comando a SENT
        await pool.query(
            'UPDATE command_history SET status = $1 WHERE id = $2',
            ['SENT', parsedCommand.id]
        );
    }
}

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    client.subscribe('controllers/+/status');
    client.subscribe('controllers/+/command_ack');
});

client.on('message', async (topic, message) => {
    try {
        const controllerId = topic.split('/')[1];

        if (topic.endsWith('/status')) {
            const status = JSON.parse(message.toString());

            // Update controller status
            await pool.query(
                'UPDATE controllers SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
                [status.online, controllerId]
            );

            // Se il controllore è tornato online, processa i comandi in coda
            if (status.online) {
                await processQueuedCommands(controllerId);
            }

            // Update sprinkler status
            if (status.sprinklers) {
                for (const [sprinklerId, sprinklerStatus] of Object.entries(status.sprinklers)) {
                    await pool.query(
                        'UPDATE sprinklers SET status = $1, duration = $2, last_active = $3 WHERE id = $4',
                        [sprinklerStatus.isIrrigating, sprinklerStatus.duration, sprinklerStatus.startedAt, sprinklerId]
                    );
                }
            }
        }
        else if (topic.endsWith('/command_ack')) {
            const ack = JSON.parse(message.toString());
            await pool.query(
                'UPDATE command_history SET status = $1, executed_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['DELIVERED', ack.commandId]
            );
        }
    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

// Intervallo per verificare i comandi in coda
setInterval(async () => {
    try {
        const keys = await redis.keys('commands:*');
        for (const key of keys) {
            const controllerId = key.split(':')[1];
            const controllerStatus = await pool.query(
                'SELECT status FROM controllers WHERE id = $1',
                [controllerId]
            );

            if (controllerStatus.rows[0].status) {
                await processQueuedCommands(controllerId);
            }
        }
    } catch (error) {
        console.error('Error checking queued commands:', error);
    }
}, 5000);

export default client;