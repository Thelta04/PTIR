DROP TABLE IF EXISTS avaliacao, fatura, pedido_viagem, viagem, reabastecimento, turno, periodo_tempo, motorista, gestor, cliente, utilizador, taxi CASCADE;

-- TAXI
CREATE TABLE taxi ( 
    matricula VARCHAR(10) PRIMARY KEY, 
    quilometragem INT NOT NULL,
    marca VARCHAR(40) NOT NULL,
    modelo VARCHAR(40) NOT NULL,
    nivel_conforto VARCHAR(10) NOT NULL,  
    tipo_motor VARCHAR(40) NOT NULL
);

-- UTILIZADORES
CREATE TABLE utilizador (
    id SERIAL PRIMARY KEY,
    nif VARCHAR(9) NOT NULL UNIQUE, 
    nome VARCHAR(60) NOT NULL,
    email VARCHAR(60),
    genero VARCHAR(15) NOT NULL, 
    senha VARCHAR(255) NOT NULL
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

-- PERIODO 
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

-- AVALIACAO
CREATE TABLE avaliacao (
    id SERIAL PRIMARY KEY,
    valor INT NOT NULL,
    id_viagem INTEGER NOT NULL,
    id_motorista INTEGER NOT NULL,
    id_cliente INTEGER NOT NULL
);

-- VIAGEM
CREATE TABLE viagem (
    id SERIAL PRIMARY KEY,
    id_pedido INTEGER,
    id_cliente INTEGER,
    quilometros INT NOT NULL,
    origem VARCHAR(255) NOT NULL,
    destino VARCHAR(255) NOT NULL,
    nivel_conforto VARCHAR(10) NOT NULL,
    preco DECIMAL(10,2) NOT NULL, 
    id_turno INTEGER NOT NULL REFERENCES turno(id),
    id_periodo INTEGER NOT NULL REFERENCES periodo_tempo(id_periodo)
);

-- FATURA
CREATE TABLE fatura (
    id_viagem INTEGER PRIMARY KEY REFERENCES viagem(id) ON DELETE CASCADE,
    numero INT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_total DECIMAL(10,2) NOT NULL,
    valor_pago DECIMAL(10,2) NOT NULL,
    nif VARCHAR(9) NOT NULL,
    ano INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM data)::INT) STORED
);

-- PEDIDO VIAGEM
CREATE TABLE pedido_viagem (
    id SERIAL PRIMARY KEY,  
    origem VARCHAR(255) NOT NULL,
    destino VARCHAR(255) NOT NULL,
    nivel_conforto VARCHAR(10) NOT NULL,
    estado VARCHAR(12) NOT NULL,
    n_passageiros INT NOT NULL,
    id_cliente INTEGER NOT NULL REFERENCES cliente(id_user)
);

----------------------------------------------------------------------
------- CONSTRAINTS --------------------------------------------------
----------------------------------------------------------------------

-- -------------------------
-- UTILIZADORES
-- -------------------------

ALTER TABLE utilizador
    ADD CONSTRAINT uq_utilizador_email UNIQUE (email),
    ADD CONSTRAINT chk_utilizador_nif CHECK (nif ~ '^[1-9][0-9]{8}$'),
    ADD CONSTRAINT chk_utilizador_genero CHECK (genero IN ('masculino', 'feminino')),
    ADD CONSTRAINT chk_utilizador_senha CHECK (
        char_length(senha_hash) >= 6
        AND senha_hash ~ '[A-Za-z]'
        AND senha_hash ~ '[0-9]'
    );

ALTER TABLE motorista
    ADD CONSTRAINT uq_motorista_carta UNIQUE (carta_conducao),
    ADD CONSTRAINT chk_motorista_maior_idade CHECK (
        ano_nascimento <= EXTRACT(YEAR FROM CURRENT_DATE)::INT - 18
    ),
    ADD CONSTRAINT chk_motorista_ano_nascimento CHECK (ano_nascimento >= 1900);

--------------------------
-- TAXI
--------------------------

ALTER TABLE taxi
    ADD CONSTRAINT chk_taxi_tipo_motor CHECK (tipo_motor IN ('combustao', 'eletrico')),
    ADD CONSTRAINT chk_taxi_marca_modelo_not_empty CHECK (marca <> '' AND modelo <> ''),
    ADD CONSTRAINT chk_taxi_quilometragem CHECK (quilometragem >= 0),
    ADD CONSTRAINT chk_taxi_nivel_conforto CHECK (nivel_conforto IN ('basico', 'luxuoso'));

--------------------------
-- PERIODO DE TEMPO
-------------------------- 

ALTER TABLE periodo_tempo
    ADD CONSTRAINT chk_periodo_hora CHECK (hora_inicio < hora_fim);

--------------------------
-- TURNO
--------------------------

ALTER TABLE turno
    ADD CONSTRAINT uq_turno_periodo UNIQUE (id_periodo),
    ADD CONSTRAINT uq_turno_taxi_periodo UNIQUE (id_taxi, id_periodo),
    ADD CONSTRAINT uq_turno_motorista_periodo UNIQUE (id_motorista, id_periodo);

--------------------------
-- REABASTECIMENTO
--------------------------

ALTER TABLE reabastecimento
    ADD CONSTRAINT chk_reabastecimento_quilometragem CHECK (quilometragem_inicial > 0),
    ADD CONSTRAINT chk_reabastecimento_euros CHECK (euros > 0),
    ADD CONSTRAINT chk_reabastecimento_quantidade CHECK (
        num_nonnulls(litros, kwh) = 1
        AND (litros IS NULL OR litros > 0)
        AND (kwh IS NULL OR kwh > 0)
    );

--------------------------
-- PEDIDO DE VIAGEM
--------------------------

ALTER TABLE pedido_viagem
    ADD CONSTRAINT chk_pedido_origem_destino CHECK (origem <> destino),
    ADD CONSTRAINT chk_pedido_conforto CHECK (nivel_conforto IN ('basico', 'luxuoso')),
    ADD CONSTRAINT chk_pedido_passageiros CHECK (n_passageiros BETWEEN 1 AND 4),
    ADD CONSTRAINT chk_pedido_estado CHECK (estado IN ('pendente', 'aceite', 'cancelado', 'expirado'));

----------------------------
-- VIAGEM
---------------------------

ALTER TABLE viagem
    ADD CONSTRAINT uq_viagem_pedido UNIQUE (id_pedido),
    ADD CONSTRAINT fk_viagem_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedido_viagem(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_viagem_cliente FOREIGN KEY (id_cliente)
        REFERENCES cliente(id_user) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_viagem_origem_destino CHECK (origem <> destino),
    ADD CONSTRAINT chk_viagem_conforto CHECK (nivel_conforto IN ('basico', 'luxuoso')),
    ADD CONSTRAINT chk_viagem_quilometros CHECK (quilometros > 0),
    ADD CONSTRAINT chk_viagem_preco CHECK (preco > 0);

-------------------------
-- FATURA
-------------------------

ALTER TABLE fatura
    ADD CONSTRAINT uq_fatura_ano_numero UNIQUE (ano, numero),
    ADD CONSTRAINT chk_fatura_numero CHECK (numero >= 1),
    ADD CONSTRAINT chk_fatura_valores CHECK (
        valor_total > 0
        AND valor_pago >= 0
        AND valor_pago <= valor_total
    ),
    ADD CONSTRAINT chk_fatura_nif CHECK (nif ~ '^[1-9][0-9]{8}$');

--------------------------
-- AVALIACAO
--------------------------

ALTER TABLE avaliacao
    ADD CONSTRAINT uq_avaliacao_viagem UNIQUE (id_viagem),
    ADD CONSTRAINT fk_avaliacao_viagem FOREIGN KEY (id_viagem)
        REFERENCES viagem(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_avaliacao_cliente FOREIGN KEY (id_cliente)
        REFERENCES cliente(id_user) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_avaliacao_motorista FOREIGN KEY (id_motorista)
        REFERENCES motorista(id_user) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_avaliacao_valor CHECK (valor BETWEEN 1 AND 5);