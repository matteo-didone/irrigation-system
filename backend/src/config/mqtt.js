import mqtt from 'mqtt';
import { pool } from './db.js';
import redis from './redis.js';

const client = mqtt.connect('mqtt://mosquitto:1883');

async function processQueuedCommands(controllerId) {
    const command = await redis.lpop(`commands:${controllerId}`);
    if (command) {
        const parsedCommand = JSON.parse(command);
        client.publish(`controllers/${controllerId}/command`, JSON.stringify(parsedCommand));

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

            await pool.query(
                'UPDATE controllers SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
                [status.online, controllerId]
            );

            if (status.online) {
                await processQueuedCommands(controllerId);
            }

            if (status.sprinklers) {
                for (const [sprinklerId, sprinklerStatus] of Object.entries(status.sprinklers)) {
                    await pool.query(
                        'UPDATE sprinklers SET status = $1, duration = $2, last_active = CURRENT_TIMESTAMP WHERE id = $3',
                        [sprinklerStatus.isIrrigating, sprinklerStatus.duration, parseInt(sprinklerId)]
                    );
                }
            }
        } else if (topic.endsWith('/command_ack')) {
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

// Controlla i comandi in coda ogni 5 secondi
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