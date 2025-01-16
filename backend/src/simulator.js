// File: src/simulator.js
import mqtt from 'mqtt';
import { setTimeout } from 'timers/promises';

class IrrigationSimulator {
    constructor() {
        this.client = mqtt.connect('mqtt://mosquitto:1883');
        this.isOnline = true;
        this.sprinklers = {};
        this.controllerId = 1;

        this.client.on('connect', () => {
            console.log('Simulator connected to MQTT');
            this.client.subscribe(`controllers/${this.controllerId}/command`);
            this.publishStatus();
        });

        this.client.on('message', async (topic, message) => {
            if (!this.isOnline) return;

            if (topic === `controllers/${this.controllerId}/command`) {
                const command = JSON.parse(message.toString());
                console.log('Received command:', command);

                await setTimeout(1000);

                if (command.command === 'START') {
                    this.sprinklers[command.sprinklerId] = {
                        isIrrigating: true,
                        duration: command.duration,
                        startedAt: new Date().toISOString()
                    };
                } else if (command.command === 'STOP') {
                    this.sprinklers[command.sprinklerId] = {
                        isIrrigating: false,
                        duration: 0,
                        startedAt: null
                    };
                }

                this.client.publish(`controllers/${this.controllerId}/command_ack`, JSON.stringify({
                    commandId: command.id,
                    status: 'DELIVERED'
                }));

                this.publishStatus();
            }
        });

        setInterval(() => {
            this.isOnline = !this.isOnline;
            console.log(`Simulator ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
            if (this.isOnline) {
                this.publishStatus();
            }
        }, Math.random() * 30000 + 30000);
    }

    publishStatus() {
        if (!this.isOnline) return;

        const status = {
            online: this.isOnline,
            sprinklers: this.sprinklers
        };

        this.client.publish(`controllers/${this.controllerId}/status`, JSON.stringify(status));
    }
}

new IrrigationSimulator();