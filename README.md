# Sistema di Controllo Irrigazione - Documentazione Completa

## 🌟 Panoramica
Sistema di controllo remoto per apparati di irrigazione che permette di monitorare e controllare irrigatori tramite un'applicazione web, gestendo anche situazioni di connettività instabile.

## 🏗 Panoramica dell'Architettura
L'architettura del sistema è suddivisa in quattro layer principali:
- Layer Dispositivi (Device Layer)
- Layer Messaggistica (Message Layer)
- Layer Server
- Layer Client

```mermaid
flowchart TB
 subgraph Client Layer
 FE[Frontend Web App]
 end
 subgraph Server Layer
 BE[Backend API]
 DB[(Database)]
 RD[(Redis)]
 end
 subgraph Message Layer
 MQTT[MQTT Broker]
 end
 subgraph Device Layer
 CTRL[Controllore]
 IRR1[Irrigatore 1]
 IRR2[Irrigatore 2]
 end
 FE <-->|HTTP/REST| BE
 BE <-->|SQL| DB
 BE <-->|Redis Protocol| RD
 BE <-->|MQTT| MQTT
 MQTT <-->|MQTT| CTRL
 CTRL -->|GPIO/Serial| IRR1
 CTRL -->|GPIO/Serial| IRR2
```

## 📝 Requisiti e Implementazione

### 1. Monitoraggio Stato Controllori
**Requisito:** Conoscere lo stato dei propri controllori (capire se connessi)

**Implementato con:**
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
        return { label: "Offline", classes: "bg-red-100 text-red-800" };
    }
};
```

### 2. Monitoraggio Stato Irrigatori
**Requisito:** Conoscere lo stato degli irrigatori (capire se stanno irrigando o meno)

**Implementato con:**
```javascript
// Backend: Tracciamento stato irrigatori
if (status.sprinklers) {
    await pool.query(
        'UPDATE sprinklers SET status = $1, duration = $2 WHERE id = $3',
        [sprinklerStatus.isIrrigating, sprinklerStatus.duration, sprinklerId]
    );
}

// Frontend: Visualizzazione stato
<span className={`text-sm ${sprinkler.status ? "text-green-600" : "text-gray-500"}`}>
    {sprinkler.status ? `Attivo (${sprinkler.duration}m)` : "Inattivo"}
</span>
```

### 3. Gestione Comandi Irrigazione
**Requisito:** Impartire comandi di accensione (1/5/10/30/60 minuti) o spegnimento

**Implementato con:**
```javascript
// Backend: API endpoint per comandi
app.post('/api/controllers/:controllerId/sprinklers/:sprinklerId/command', 
    async (req, res) => {
    const { command, duration } = req.body;
    // Logica gestione comando...
});

// Frontend: Interfaccia durata
<select value={selectedDurations[sprinkler.id] || 5}>
    <option value={1}>1 minuto</option>
    <option value={5}>5 minuti</option>
    <option value={10}>10 minuti</option>
    <option value={30}>30 minuti</option>
    <option value={60}>60 minuti</option>
</select>
```

### 4. Gestione Connessione Instabile
**Requisito:** Recapito dei comandi quando il controllore torna raggiungibile

**Implementato con:**
```javascript
// Salvataggio comandi offline
if (!controller_status) {
    await redis.rpush(`commands:${controllerId}`, JSON.stringify(commandData));
}

// Processamento comandi al ritorno online
async function processQueuedCommands(controllerId) {
    const command = await redis.lpop(`commands:${controllerId}`);
    if (command) {
        mqtt.publish(`controllers/${controllerId}/command`, command);
    }
}
```

## 📱 Layer Dispositivi (Device Layer)
### Componenti
- **Irrigatori**: Dispositivi finali che controllano il flusso d'acqua
- **Controllore**: Dispositivo (es. Raspberry Pi) che gestisce gli irrigatori

### Comunicazione
- **Protocollo**: GPIO/Serial
- **Motivazione**: La comunicazione diretta via GPIO o seriale garantisce:
  - Bassa latenza
  - Alta affidabilità
  - Controllo hardware diretto

## 📡 Layer Messaggistica (Message Layer)
### Componenti
- **MQTT Broker**: Gestore centrale dei messaggi

### Comunicazione
- **Protocollo**: MQTT
- **Motivazione**:
  - Protocollo leggero ottimizzato per IoT
  - Gestione efficiente di connessioni instabili
  - Pattern publish/subscribe ideale per IoT
  - Minimo overhead di rete

## 🖥️ Layer Server
### Componenti
- **Backend API** (Express.js)
- **Database** (PostgreSQL)
- **Cache** (Redis)

### Comunicazioni
1. **Backend ↔️ MQTT**
   - Protocollo: MQTT
   - Uso: Comunicazione real-time con dispositivi
2. **Backend ↔️ Database**
   - Protocollo: SQL
   - Uso: Persistenza dati e query complesse
3. **Backend ↔️ Redis**
   - Protocollo: Redis Protocol
   - Uso: Gestione comandi offline e cache

## 🌐 Layer Client
### Componenti
- **Frontend Web App**

### Comunicazione
- **Protocollo**: HTTP/REST
- **Motivazione**:
  - Standard web universale
  - Facilità di implementazione
  - Ampio supporto strumenti/librerie
  - Natura stateless

## 🔄 Flussi di Dati

### Flusso dei Dati Base

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend
    participant RD as Redis
    participant MQTT as MQTT Broker
    participant C as Controller
    
    %% Invio comando
    FE->>BE: POST /command
    BE->>BE: Verifica stato
    alt Controller Online
        BE->>MQTT: Pubblica comando
        MQTT->>C: Invia comando
    else Controller Offline
        BE->>RD: Salva in coda
    end
    BE->>FE: Risposta
```

### 1. Flusso Comandi (Top-down)
```
Frontend → Backend → MQTT Broker → Controllore → Irrigatore
```

Esempio comando:
```json
{
"command": "START",
"duration": 5,
"sprinklerId": 1
}
```

### 2. Flusso Stati (Bottom-up)
```
Irrigatore → Controllore → MQTT Broker → Backend → Database/Frontend
```

Esempio stato:
```json
{
"controllerId": 1,
"online": true,
"sprinklers": [
 {"id": 1, "status": "active", "duration": 5}
 ]
}
```

### 3. Flusso Offline
```
Frontend → Backend → Redis → Backend → MQTT (quando online)
```

### Processo Dettagliato:

1. **Invio Comando**
   - Frontend → Backend (HTTP)
   - Verifica stato controllore
   - Se online: MQTT
   - Se offline: Redis

2. **Gestione Stato**
   - Controllore → MQTT (status)
   - Backend aggiorna DB
   - Frontend polling ogni 10s

3. **Recupero Comandi**
   - Controllore pubblica stato online
   - Backend verifica Redis
   - Invio comandi pendenti
   - Aggiornamento storico

4. **Conferme**
   - Controllore → MQTT (ACK)
   - Backend aggiorna DB
   - Frontend aggiorna vista

## 🛠 Tecnologie

- **Frontend**: React, TailwindCSS
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Messaggistica**: MQTT
- **Container**: Docker, Docker Compose

## 📊 Schema Database

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

## 📡 Endpoint e Topics

### API REST
- `GET /api/controllers`: Lista controllori e stato
- `POST /api/controllers/:id/sprinklers/:id/command`: Invio comandi

### MQTT Topics
- `controllers/{id}/command`: Invio comandi
- `controllers/{id}/status`: Stato controllore
- `controllers/{id}/command_ack`: Conferme

## 🤔 Motivazioni Scelte Tecnologiche

### 1. MQTT per IoT
- Ottimizzato per reti non affidabili
- Supporto Quality of Service (QoS)
- Efficiente per dispositivi con risorse limitate
- Pattern publish/subscribe ideale per IoT

### 2. Redis per Code
- Performance elevate per code messaggi
- Ottimo per dati temporanei
- Supporto strutture dati complesse
- Facile implementazione producer/consumer

### 3. HTTP/REST per Frontend
- Standard universale
- Debug facilitato
- Ampio ecosistema tool/librerie
- Caching naturale
- Stateless

### 4. PostgreSQL per Dati
- ACID compliance
- Ottimo per relazioni (controllori-irrigatori)
- Query complesse
- Alta affidabilità

## ✅ Vantaggi dell'Architettura

1. **Scalabilità**
   - Componenti indipendenti
   - Facile aggiunta nuovi dispositivi
   - Load balancing naturale

2. **Resilienza**
   - Gestione offline/online
   - Persistenza comandi
   - Recupero automatico

3. **Manutenibilità**
   - Separazione responsabilità
   - Modularità
   - Facile debugging

4. **Flessibilità**
   - Facile aggiunta nuove funzionalità
   - Supporto diversi tipi dispositivi
   - Aggiornamenti non invasivi

## 🚀 Deployment

```bash
# Avvio sistema
docker-compose up -d

# Backup database
./backup.sh
```

## 📝 Note
- Il polling è impostato a 10 secondi per bilanciare reattività e carico
- I comandi offline vengono gestiti in ordine FIFO
- Lo stato del controllore viene considerato offline dopo 30 secondi senza aggiornamenti