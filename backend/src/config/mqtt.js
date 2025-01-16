import mqtt from 'mqtt';
import { pool } from './db.js';

const client = mqtt.connect('mqtt://mosquitto:1883');

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

export default client;