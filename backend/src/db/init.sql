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
    id SERIAL PRIMARY KEY,
    controller_id INTEGER REFERENCES controllers(id),
    sprinkler_id INTEGER REFERENCES sprinklers(id),
    command_type VARCHAR(20) NOT NULL,
    duration INTEGER,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Crea gli indici
DO $ $ BEGIN IF NOT EXISTS (
    SELECT
        1
    FROM
        pg_indexes
    WHERE
        indexname = 'idx_controllers_status'
) THEN CREATE INDEX idx_controllers_status ON controllers(status);

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        pg_indexes
    WHERE
        indexname = 'idx_sprinklers_controller_id'
) THEN CREATE INDEX idx_sprinklers_controller_id ON sprinklers(controller_id);

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        pg_indexes
    WHERE
        indexname = 'idx_sprinklers_status'
) THEN CREATE INDEX idx_sprinklers_status ON sprinklers(status);

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        pg_indexes
    WHERE
        indexname = 'idx_command_history_controller_id'
) THEN CREATE INDEX idx_command_history_controller_id ON command_history(controller_id);

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        pg_indexes
    WHERE
        indexname = 'idx_command_history_status'
) THEN CREATE INDEX idx_command_history_status ON command_history(status);

END IF;

END $ $;

-- Inserisci dati di default
DO $ $ BEGIN IF NOT EXISTS (
    SELECT
        1
    FROM
        controllers
    WHERE
        name = 'Controllore Giardino 1'
) THEN
INSERT INTO
    controllers (name, ip_address, status)
VALUES
    ('Controllore Giardino 1', '192.168.1.100', true);

INSERT INTO
    sprinklers (controller_id, name)
VALUES
    (1, 'Irrigatore 1');

END IF;

END $ $;