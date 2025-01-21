# Sistema di Controllo Irrigazione

## 📝 Requisiti del Sistema

### 1. Monitoraggio Stato Controllori
Requisito: "Conoscere lo stato dei propri controllori (capire se connessi)"

Implementato con:
```javascript
// Backend: Aggiornamento stato via MQTT
client.on('message', async (topic, message) => {
    if (topic.endsWith('/status')) {
        const status = JSON.parse(message.toString());
        await pool.query(
            'UPDATE controllers SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
            [status.online, controllerId]
        );
    }
});

// Frontend: Visualizzazione stato
const getSystemStatus = () => {
    if (!controller.status) {
        return {
            label: "Offline",
            classes: "bg-red-100 text-red-800",
        };
    }
    // ...
};
```

### 2. Monitoraggio Stato Irrigatori
Requisito: "Conoscere lo stato degli irrigatori (capire se stanno irrigando o meno)"

Implementato con:
```javascript
// Backend: Tracciamento stato irrigatori
if (status.sprinklers) {
    await pool.query(
        'UPDATE sprinklers SET status = $1, duration = $2 WHERE id = $3',
        [sprinklerStatus.isIrrigating, sprinklerStatus.duration, sprinklerId]
    );
}

// Frontend: Visualizzazione stato irrigatore
<span className={`text-sm ${sprinkler.status ? "text-green-600" : "text-gray-500"}`}>
    {sprinkler.status ? `Attivo (${sprinkler.duration}m)` : "Inattivo"}
</span>
```

### 3. Gestione Comandi Irrigazione
Requisito: "Impartire comandi di accensione (1/5/10/30/60 minuti) o spegnimento"

Implementato con:
```javascript
// Backend: Gestione comando
app.post('/api/controllers/:controllerId/sprinklers/:sprinklerId/command', async (req, res) => {
    const { command, duration } = req.body;
    // Logica di invio comando...
});

// Frontend: Selezione durata
<select value={selectedDurations[sprinkler.id] || 5}>
    <option value={1}>1 minuto</option>
    <option value={5}>5 minuti</option>
    <option value={10}>10 minuti</option>
    <option value={30}>30 minuti</option>
    <option value={60}>60 minuti</option>
</select>
```

### 4. Gestione Connessione Instabile
Requisito: "I comandi devono essere recapitati non appena il controllore torna raggiungibile"

Implementato con:
```javascript
// Backend: Salvataggio comandi in coda Redis
if (!controller_status) {
    await redis.rpush(`commands:${controllerId}`, JSON.stringify(commandData));
}

// Backend: Invio comandi in coda quando il controllore torna online
async function processQueuedCommands(controllerId) {
    const command = await redis.lpop(`commands:${controllerId}`);
    if (command) {
        mqtt.publish(`controllers/${controllerId}/command`, command);
    }
}
```

## 🛠 Tecnologie Utilizzate
- **Frontend**: React, TailwindCSS
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Messaggistica**: MQTT
- **Container**: Docker, Docker Compose

## 📊 Struttura Database

```sql
CREATE TABLE controllers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status BOOLEAN DEFAULT false,
    last_seen TIMESTAMP
);

CREATE TABLE sprinklers (
    id SERIAL PRIMARY KEY,
    controller_id INTEGER REFERENCES controllers(id),
    name VARCHAR(100) NOT NULL,
    status BOOLEAN DEFAULT false,
    duration INTEGER
);
```

## 🚀 Avvio del Sistema

```bash
# Avvio dell'intero stack
docker-compose up -d

# Backup del database
./backup.sh
```

## 📡 Protocolli di Comunicazione

### MQTT Topics
- `controllers/{id}/command`: Invio comandi
- `controllers/{id}/status`: Stato del controllore
- `controllers/{id}/command_ack`: Conferma comandi

### API Endpoints
- `GET /api/controllers`: Lista controllori e stato
- `POST /api/controllers/:id/sprinklers/:id/command`: Invio comandi
# Spiegazione Dettagliata dei Protocolli e Flusso Dati

## 1. HTTP (Frontend ↔️ Backend)

### 1.1 Polling dello Stato
```javascript
// Frontend (App.jsx)
const fetchControllers = async () => {
    const response = await axios.get("/api/controllers");
    setControllers(response.data);
};

// Polling ogni 10 secondi
useEffect(() => {
    fetchControllers();
    const interval = setInterval(fetchControllers, 10000);
    return () => clearInterval(interval);
}, []);

// Backend (index.js)
app.get('/api/controllers', async (req, res) => {
    const result = await pool.query(`
        SELECT c.*, json_agg(s.*) as sprinklers
        FROM controllers c
        LEFT JOIN sprinklers s ON s.controller_id = c.id
        GROUP BY c.id
    `);
    res.json(result.rows);
});
```

### 1.2 Invio Comandi
```javascript
// Frontend (ControllerCard.jsx)
const handleStart = async (sprinklerId) => {
    await axios.post(
        `/api/controllers/${controllerId}/sprinklers/${sprinklerId}/command`,
        { command: "START", duration }
    );
};

// Backend (index.js)
app.post('/api/controllers/:controllerId/sprinklers/:sprinklerId/command', 
    async (req, res) => {
    const { command, duration } = req.body;
    // Verifica stato controllore e gestisce il comando...
});
```

## 2. MQTT (Backend ↔️ Controllore)

### 2.1 Configurazione MQTT
```javascript
// mqtt.js
const client = mqtt.connect('mqtt://mosquitto:1883');

client.on('connect', () => {
    client.subscribe('controllers/+/status');
    client.subscribe('controllers/+/command_ack');
});
```

### 2.2 Pubblicazione Comandi
```javascript
// Invio comando al controllore
mqtt.publish(`controllers/${controllerId}/command`, JSON.stringify({
    id: commandId,
    sprinklerId: parseInt(sprinklerId),
    command,
    duration: duration || 0,
    timestamp: new Date().toISOString()
}));
```

### 2.3 Ricezione Status
```javascript
client.on('message', async (topic, message) => {
    if (topic.endsWith('/status')) {
        const status = JSON.parse(message.toString());
        // Aggiorna stato nel database
        await pool.query(
            'UPDATE controllers SET status = $1, last_seen = CURRENT_TIMESTAMP',
            [status.online]
        );
    }
});
```

## 3. Redis (Gestione Code)

### 3.1 Salvataggio Comandi Offline
```javascript
// Se il controllore è offline
if (!controller_status) {
    await redis.rpush(`commands:${controllerId}`, JSON.stringify(commandData));
    await pool.query(
        'INSERT INTO command_history (status) VALUES ($1)',
        ['QUEUED']
    );
}
```

### 3.2 Processamento Comandi in Coda
```javascript
async function processQueuedCommands(controllerId) {
    const command = await redis.lpop(`commands:${controllerId}`);
    if (command) {
        mqtt.publish(`controllers/${controllerId}/command`, command);
        // Aggiorna stato comando
        await pool.query(
            'UPDATE command_history SET status = $1',
            ['SENT']
        );
    }
}

## 4. Flusso Completo dei Dati

1. **Invio Comando**:
   - Frontend invia comando HTTP al Backend
   - Backend verifica stato del controllore
   - Se online: invia via MQTT
   - Se offline: salva in Redis

2. **Gestione Stato**:
   - Controllore pubblica stato su MQTT
   - Backend riceve e aggiorna database
   - Frontend riceve aggiornamenti via polling

3. **Recupero Comandi**:
   - Quando il controllore torna online:
     - Pubblica stato su MQTT
     - Backend verifica Redis
     - Invia comandi in coda via MQTT
     - Aggiorna storico comandi

4. **Conferme**:
   - Controllore conferma ricezione comando via MQTT
   - Backend aggiorna stato comando nel database
   - Frontend mostra stato aggiornato al prossimo polling