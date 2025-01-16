import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: 6379
});

// Gestione errori di connessione
redis.on('error', (error) => {
    console.error('Redis Error:', error);
});

// Gestione connessione stabilita
redis.on('connect', () => {
    console.log('Successfully connected to Redis');
});

// Gestione riconnessione
redis.on('reconnecting', () => {
    console.log('Reconnecting to Redis...');
});

export default redis;