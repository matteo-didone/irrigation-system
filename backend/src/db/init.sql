-- Crea la tabella dei controllori se non esiste
CREATE TABLE IF NOT EXISTS controllers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status BOOLEAN DEFAULT false,
    ip_address VARCHAR(45),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crea la tabella degli irrigatori se non esiste
CREATE TABLE IF NOT EXISTS sprinklers (
    id SERIAL PRIMARY KEY,
    controller_id INTEGER REFERENCES controllers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status BOOLEAN DEFAULT false,
    duration INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crea la tabella della cronologia dei comandi se non esiste
CREATE TABLE IF NOT EXISTS command_history (
    id VARCHAR(36) PRIMARY KEY,  -- Cambiato da SERIAL a VARCHAR(36) per supportare UUID
    controller_id INTEGER REFERENCES controllers(id),
    sprinkler_id INTEGER REFERENCES sprinklers(id),
    command_type VARCHAR(20) NOT NULL,
    duration INTEGER,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Crea indici
CREATE INDEX IF NOT EXISTS idx_controllers_status ON controllers(status);
CREATE INDEX IF NOT EXISTS idx_sprinklers_controller_id ON sprinklers(controller_id);
CREATE INDEX IF NOT EXISTS idx_sprinklers_status ON sprinklers(status);
CREATE INDEX IF NOT EXISTS idx_command_history_controller_id ON command_history(controller_id);
CREATE INDEX IF NOT EXISTS idx_command_history_status ON command_history(status);

-- Inserisci dati di default se non esistono
INSERT INTO controllers (name, ip_address, status)
SELECT 'Controllore Giardino 1', '192.168.1.100', true
WHERE NOT EXISTS (
    SELECT 1 FROM controllers WHERE name = 'Controllore Giardino 1'
);

-- Inserisci gli irrigatori per il controllore appena creato
INSERT INTO sprinklers (controller_id, name)
SELECT 1, 'Irrigatore Prato'
WHERE EXISTS (
    SELECT 1 FROM controllers WHERE id = 1
)
AND NOT EXISTS (
    SELECT 1 FROM sprinklers WHERE name = 'Irrigatore Prato' AND controller_id = 1
);

INSERT INTO sprinklers (controller_id, name)
SELECT 1, 'Irrigatore Aiuole'
WHERE EXISTS (
    SELECT 1 FROM controllers WHERE id = 1
)
AND NOT EXISTS (
    SELECT 1 FROM sprinklers WHERE name = 'Irrigatore Aiuole' AND controller_id = 1
);

INSERT INTO sprinklers (controller_id, name)
SELECT 1, 'Irrigatore Orto'
WHERE EXISTS (
    SELECT 1 FROM controllers WHERE id = 1
)
AND NOT EXISTS (
    SELECT 1 FROM sprinklers WHERE name = 'Irrigatore Orto' AND controller_id = 1
);