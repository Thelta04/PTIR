DROP TABLE IF EXISTS taxi, utilizador, motorista, gestor, cliente, avaliacao, viagem, pedido_viagem, periodo, reabastecimento, fatura, turno;

-- TAXI -----------------------------------------------------------
CREATE TABLE taxi ( 
    id SERIAL PRIMARY KEY,
    matricula VARCHAR(10),
    quilometragem INT,
    marca VARCHAR(40),
    modelo VARCHAR(40),
    nivel_conforto VARCHAR(10) CHECK (nivel_conforto IN ('basico', 'luxuoso')),  
    tipo_motor VARCHAR(40)
);

-- UTILIZADORES -----------------------------------------------------------
CREATE TABLE utilizador (
    id SERIAL PRIMARY KEY,
    nif VARCHAR(12),
    nome VARCHAR(60),
    email VARCHAR(60),
    genero VARCHAR(15) CHECK (genero IN ('femenino', 'masculino', 'outro', 'sem resposta')), 
    senha VARCHAR(40)
);

-- MOTORISTA -----------------------------------------------------------
CREATE TABLE motorista (
    id_user INTEGER,
    carta_conducao VARCHAR(12),
    ano_nascimento VARCHAR(4),

    FOREIGN KEY (id_user) REFERENCES utilizador(id)
);

-- GESTOR -----------------------------------------------------------
CREATE TABLE gestor (
    id_user INTEGER,

    FOREIGN KEY (id_user) REFERENCES utilizador(id)
);

-- CLIENTE -----------------------------------------------------------
CREATE TABLE cliente (
    id_user INTEGER,

    FOREIGN KEY (id_user) REFERENCES utilizador(id)
);

-- PERIODO --------------------------------------------------------------
CREATE TABLE periodo (
    id SERIAL PRIMARY KEY,
    hora_inicio TIMESTAMP,
    hora_fim TIMESTAMP
);

-- TURNO ----------------------------------------------------------------------
CREATE TABLE turno (
    id SERIAL PRIMARY KEY,

    id_taxi INTEGER,
    id_motorista INTEGER,
    id_periodo INTEGER,

    FOREIGN KEY (id_taxi) REFERENCES taxi(id),
    FOREIGN KEY (id_motorista) REFERENCES motorista(id_user),
    FOREIGN KEY (id_periodo) REFERENCES periodo(id)
);

-- REABASTECIMENTO -----------------------------------------------------------
CREATE TABLE reabastecimento (
    id SERIAL PRIMARY KEY,
    euros INT,
    kwh INT,
    litros INT,
    quilometragem_inicial INT,

    id_turno INTEGER,
    id_periodo INTEGER,

    FOREIGN KEY (id_turno) REFERENCES turno(id),
    FOREIGN KEY (id_periodo) REFERENCES periodo(id)
);

-- AVALIACAO -----------------------------------------------------------
CREATE TABLE avaliacao (
    id SERIAL PRIMARY KEY,
    valor INT,

    id_motorista INTEGER,
    id_cliente INTEGER,

    FOREIGN KEY (id_motorista) REFERENCES motorista(id_user),
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_user)
);

-- VIAGEM -----------------------------------------------------------
CREATE TABLE viagem (
    id SERIAL PRIMARY KEY,
    quilometros INT,
    origem VARCHAR(255),
    destino VARCHAR(255),
    nivel_conforto VARCHAR(10) CHECK (nivel_conforto IN ('basico', 'luxuoso')),  
    preco INT,

    id_turno INTEGER,
    id_periodo INTEGER,
    
    FOREIGN KEY (id_turno) REFERENCES turno(id),
    FOREIGN KEY (id_periodo) REFERENCES periodo(id)
);

-- FATURA -----------------------------------------------------------
CREATE TABLE fatura (
    id SERIAL PRIMARY KEY,
    data DATE,
    valor_total DECIMAL(10,2),
    valor_pago DECIMAL(10,2),
    nif VARCHAR(9)
);

-- O scrum master esteve aqui

-- PEDIDO VIAGEM -----------------------------------------------------------
CREATE TABLE pedido_viagem (
    origem VARCHAR(255),
    destino VARCHAR(255),
    nivel_conforto VARCHAR(10) CHECK (nivel_conforto IN ('basico', 'luxuoso')),  
    estado VARCHAR(12) CHECK (estado IN ('Em espera', 'Confirmado', 'Cancelado','Suspenso')),  
    n_passageiros INT
);