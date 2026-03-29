DROP TABLE IF EXISTS avaliacao, fatura, pedido_viagem, viagem, reabastecimento, turno, periodo_tempo, motorista, gestor, cliente, utilizador, taxi CASCADE;

-- TAXI
CREATE TABLE taxi ( 
    matricula VARCHAR(10) PRIMARY KEY, 
    ano_compra INT NOT NULL,
    quilometragem INT NOT NULL,
    marca VARCHAR(40) NOT NULL,
    modelo VARCHAR(40) NOT NULL,
    nivel_conforto VARCHAR(10) NOT NULL,  
    tipo_motor VARCHAR(40) NOT NULL,
    n_passageiros INT NOT NULL
);

-- UTILIZADORES
CREATE TABLE utilizador (
    id SERIAL PRIMARY KEY,
    nif VARCHAR(9) NOT NULL UNIQUE, 
    nome VARCHAR(60) NOT NULL,
    email VARCHAR(60),
    genero VARCHAR(15) NOT NULL, 
    senha VARCHAR(255) NOT NULL,
    is_banned BOOLEAN DEFAULT FALSE
);

-- MOTORISTA 
CREATE TABLE motorista (
    id_user INTEGER PRIMARY KEY REFERENCES utilizador(id) ON DELETE CASCADE, 
    carta_conducao VARCHAR(12) NOT NULL,
    ano_nascimento INT NOT NULL
);

-- GESTOR
CREATE TABLE gestor (
    id_user INTEGER PRIMARY KEY REFERENCES utilizador(id) ON DELETE CASCADE
);

-- CLIENTE
CREATE TABLE cliente (
    id_user INTEGER PRIMARY KEY REFERENCES utilizador(id) ON DELETE CASCADE
);

-- PERIODO DE TEMPO
CREATE TABLE periodo_tempo (
    id_periodo SERIAL PRIMARY KEY,
    hora_inicio TIMESTAMP NOT NULL,
    hora_fim TIMESTAMP NOT NULL
);

-- TURNO
CREATE TABLE turno (
    id SERIAL PRIMARY KEY,
    id_taxi VARCHAR(10) NOT NULL REFERENCES taxi(matricula), 
    id_motorista INTEGER NOT NULL REFERENCES motorista(id_user),
    id_periodo INTEGER NOT NULL REFERENCES periodo_tempo(id_periodo)
);

-- REABASTECIMENTO
CREATE TABLE reabastecimento (
    id SERIAL PRIMARY KEY,
    euros DECIMAL(10,2),
    kwh INT,
    litros INT,
    quilometragem_inicial INT NOT NULL,
    id_turno INTEGER NOT NULL REFERENCES turno(id),
    id_periodo INTEGER NOT NULL REFERENCES periodo_tempo(id_periodo)
);

-- VIAGEM
CREATE TABLE viagem (
    id SERIAL PRIMARY KEY,
    quilometros INT NOT NULL,
    origem_coords VARCHAR(255) NOT NULL,
    destino_coords VARCHAR(255) NOT NULL,
    origem_morada VARCHAR(255) NOT NULL,
    destino_morada VARCHAR(255) NOT NULL,
    nivel_conforto VARCHAR(10) NOT NULL,
    preco DECIMAL(10,2) NOT NULL, 
    n_passageiros INT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'EM_ESPERA',

    id_cliente INTEGER NOT NULL REFERENCES cliente(id_user),
    id_turno INTEGER NOT NULL REFERENCES turno(id),
    id_periodo INTEGER NOT NULL REFERENCES periodo_tempo(id_periodo)
);

-- AVALIACAO
CREATE TABLE avaliacao (
    id_viagem PRIMARY KEY INTEGER NOT NULL UNIQUE REFERENCES viagem(id),
    valor INT NOT NULL
);

-- FATURA
CREATE TABLE fatura (
    id_viagem INTEGER PRIMARY KEY REFERENCES viagem(id),
    numero INT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_total DECIMAL(10,2) NOT NULL,
    valor_pago DECIMAL(10,2) NOT NULL,
    nif VARCHAR(9) NOT NULL,
    ano INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM data)::INT) STORED
);


-- ==============================================================================
-- CONSTRAINTS (RIAs SIMPLES)
-- ==============================================================================

ALTER TABLE utilizador
    ADD CONSTRAINT uq_utilizador_email UNIQUE (email),
    ADD CONSTRAINT chk_utilizador_nif CHECK (nif ~ '^[1-9][0-9]{8}$'), -- RIA 12
    ADD CONSTRAINT chk_utilizador_genero CHECK (genero IN ('masculino', 'feminino', 'outro')), -- RIA 13
    ADD CONSTRAINT chk_utilizador_senha CHECK (char_length(senha) >= 6 AND senha ~ '[A-Za-z]' AND senha ~ '[0-9]'); -- RIA 15

ALTER TABLE motorista
    ADD CONSTRAINT uq_motorista_carta UNIQUE (carta_conducao), -- RIA 14
    ADD CONSTRAINT chk_motorista_maior_idade CHECK (ano_nascimento <= EXTRACT(YEAR FROM CURRENT_DATE)::INT - 18), -- RIA 4
    ADD CONSTRAINT chk_motorista_ano_nascimento CHECK (ano_nascimento >= 1900);

ALTER TABLE taxi
    ADD CONSTRAINT chk_taxi_tipo_motor CHECK (tipo_motor IN ('combustao', 'eletrico')), -- RIA 17
    ADD CONSTRAINT chk_taxi_marca_modelo_not_empty CHECK (marca <> '' AND modelo <> ''),
    ADD CONSTRAINT chk_taxi_quilometragem CHECK (quilometragem >= 0),
    ADD CONSTRAINT chk_taxi_nivel_conforto CHECK (nivel_conforto IN ('basico', 'luxuoso')), -- RIA 16
    ADD CONSTRAINT chk_taxi_n_passageiros CHECK (n_passageiros BETWEEN 1 AND 4); -- RIA 18

ALTER TABLE periodo_tempo
    ADD CONSTRAINT chk_periodo_hora CHECK (hora_inicio < hora_fim); -- RIA 1

ALTER TABLE turno
    ADD CONSTRAINT uq_turno_taxi_periodo UNIQUE (id_taxi, id_periodo),
    ADD CONSTRAINT uq_turno_motorista_periodo UNIQUE (id_motorista, id_periodo);

ALTER TABLE reabastecimento
    ADD CONSTRAINT chk_reabastecimento_quilometragem CHECK (quilometragem_inicial > 0), -- RIA 25
    ADD CONSTRAINT chk_reabastecimento_euros CHECK (euros > 0), -- RIA 24
    ADD CONSTRAINT chk_reabastecimento_quantidade CHECK (
        num_nonnulls(litros, kwh) = 1
        AND (litros IS NULL OR litros > 0) -- RIA 22
        AND (kwh IS NULL OR kwh > 0) -- RIA 23
    );
    
ALTER TABLE viagem
    ADD CONSTRAINT chk_viagem_origem_destino CHECK (origem_coords <> destino_coords),
    ADD CONSTRAINT chk_viagem_conforto CHECK (nivel_conforto IN ('basico', 'luxuoso')),
    ADD CONSTRAINT chk_viagem_quilometros CHECK (quilometros > 0), -- RIA 19
    ADD CONSTRAINT chk_viagem_preco CHECK (preco > 0), -- RIA 20
    ADD CONSTRAINT chk_viagem_passageiros CHECK (n_passageiros BETWEEN 1 AND 4), -- RIA 18
    ADD CONSTRAINT chk_viagem_estado CHECK (estado IN ('EM_ESPERA', 'ACEITE_MOTORISTA', 'ACEITE_CLIENTE', 'A_DECORRER', 'CONCLUIDA', 'CANCELADO')); -- RIA 27

ALTER TABLE fatura
    ADD CONSTRAINT uq_fatura_ano_numero UNIQUE (ano, numero),
    ADD CONSTRAINT chk_fatura_numero CHECK (numero >= 1), -- RIA 21
    ADD CONSTRAINT chk_fatura_valores CHECK (valor_total > 0 AND valor_pago >= 0 AND valor_pago <= valor_total),
    ADD CONSTRAINT chk_fatura_nif CHECK (nif ~ '^[1-9][0-9]{8}$');

ALTER TABLE avaliacao
    ADD CONSTRAINT chk_avaliacao_valor CHECK (valor BETWEEN 1 AND 5);


-- ==============================================================================
-- TRIGGERS (RIAs COMPLEXAS E CRUZADAS)
-- ==============================================================================

-- RIA 28: Avaliação só em viagens CONCLUIDAS
CREATE OR REPLACE FUNCTION function_valida_avaliacao() RETURNS TRIGGER AS $$BEGIN
    IF (SELECT estado FROM viagem WHERE id = NEW.id_viagem) != 'CONCLUIDA' THEN
        RAISE EXCEPTION 'RIA 28: Um cliente só pode dar avaliação quando a viagem estiver CONCLUIDA.';
    END IF;
    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_avaliacao
BEFORE INSERT OR UPDATE ON avaliacao
FOR EACH ROW EXECUTE FUNCTION function_valida_avaliacao();

-- RIA 2 e RIA 5: Duração do Turno e Ano do Táxi
CREATE OR REPLACE FUNCTION function_valida_turno() RETURNS TRIGGER AS $$DECLARE
    v_hora_inicio TIMESTAMP;
    v_hora_fim TIMESTAMP;
    v_ano_compra INT;
BEGIN
    SELECT hora_inicio, hora_fim INTO v_hora_inicio, v_hora_fim FROM periodo_tempo WHERE id_periodo = NEW.id_periodo;
    SELECT ano_compra INTO v_ano_compra FROM taxi WHERE matricula = NEW.id_taxi;

    IF EXTRACT(EPOCH FROM (v_hora_fim - v_hora_inicio))/3600 > 8 THEN
        RAISE EXCEPTION 'RIA 2: O turno não pode durar mais de 8 horas.';
    END IF;

    IF v_ano_compra > EXTRACT(YEAR FROM v_hora_inicio) THEN
        RAISE EXCEPTION 'RIA 5: O ano de compra do táxi não pode ser posterior ao ano do turno.';
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_turno
BEFORE INSERT OR UPDATE ON turno
FOR EACH ROW EXECUTE FUNCTION function_valida_turno();

-- RIA 3: Viagem contida no Turno
CREATE OR REPLACE FUNCTION function_valida_viagem() RETURNS TRIGGER AS $$DECLARE
    v_inicio_viagem TIMESTAMP;
    v_fim_viagem TIMESTAMP;
    v_inicio_turno TIMESTAMP;
    v_fim_turno TIMESTAMP;
BEGIN
    SELECT hora_inicio, hora_fim INTO v_inicio_viagem, v_fim_viagem FROM periodo_tempo WHERE id_periodo = NEW.id_periodo;
    
    SELECT p.hora_inicio, p.hora_fim INTO v_inicio_turno, v_fim_turno 
    FROM turno t JOIN periodo_tempo p ON t.id_periodo = p.id_periodo 
    WHERE t.id = NEW.id_turno;

    IF v_inicio_viagem < v_inicio_turno OR v_fim_viagem > v_fim_turno THEN
        RAISE EXCEPTION 'RIA 3: O período da viagem tem de estar contido no período do turno correspondente.';
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_viagem
BEFORE INSERT OR UPDATE ON viagem
FOR EACH ROW EXECUTE FUNCTION function_valida_viagem();

-- RIA 8: Fatura posterior à viagem
CREATE OR REPLACE FUNCTION function_valida_fatura() RETURNS TRIGGER AS $$DECLARE
    v_inicio_viagem TIMESTAMP;
BEGIN
    SELECT p.hora_inicio INTO v_inicio_viagem 
    FROM viagem v JOIN periodo_tempo p ON v.id_periodo = p.id_periodo 
    WHERE v.id = NEW.id_viagem;

    IF NEW.data < DATE(v_inicio_viagem) THEN
        RAISE EXCEPTION 'RIA 8: A data da fatura não pode ser anterior à data de início da viagem.';
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_fatura
BEFORE INSERT OR UPDATE ON fatura
FOR EACH ROW EXECUTE FUNCTION function_valida_fatura();