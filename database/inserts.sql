-- TAXI -----------------------------------------------------------
INSERT INTO taxi (matricula, quilometragem, marca, modelo, nivel_conforto, tipo_motor) VALUES
('AA-11-BB', 120000, 'Toyota', 'Prius', 'basico', 'hibrido'),
('CC-22-DD', 80000, 'Mercedes', 'E200', 'luxuoso', 'diesel'),
('EE-33-FF', 50000, 'Tesla', 'Model 3', 'luxuoso', 'eletrico');

-- UTILIZADOR -----------------------------------------------------------
INSERT INTO utilizador (nif, nome, email, genero, senha) VALUES
('123456789', 'Joao Silva', 'joao@email.com', 'masculino', '1234'),
('987654321', 'Maria Costa', 'maria@email.com', 'femenino', 'abcd'),
('456789123', 'Pedro Santos', 'pedro@email.com', 'masculino', 'pass'),
('321654987', 'Ana Ferreira', 'ana@email.com', 'femenino', 'senha'),
('741852963', 'Carlos Mendes', 'carlos@email.com', 'masculino', 'qwerty');

-- MOTORISTA -----------------------------------------------------------
INSERT INTO motorista (id_user, carta_conducao, ano_nascimento) VALUES
(1, 'C1234567', '1985'),
(3, 'D7654321', '1990');

-- GESTOR -----------------------------------------------------------
INSERT INTO gestor (id_user) VALUES
(5);

-- CLIENTE -----------------------------------------------------------
INSERT INTO cliente (id_user) VALUES
(2),
(4);

-- PERIODO -----------------------------------------------------------
INSERT INTO periodo (hora_inicio, hora_fim) VALUES
('2025-01-01 08:00:00', '2025-01-01 16:00:00'),
('2025-01-01 16:00:00', '2025-01-02 00:00:00'),
('2025-01-02 00:00:00', '2025-01-02 08:00:00');

-- TURNO -----------------------------------------------------------
INSERT INTO turno (id_taxi, id_motorista, id_periodo) VALUES
(1, 1, 1),
(2, 3, 2);

-- REABASTECIMENTO -----------------------------------------------------------
INSERT INTO reabastecimento (euros, kwh, litros, quilometragem_inicial, id_turno, id_periodo) VALUES
(40, NULL, 30, 120000, 1, 1),
(25, 50, NULL, 50000, 2, 2);

-- AVALIACAO -----------------------------------------------------------
INSERT INTO avaliacao (valor, id_motorista, id_cliente) VALUES
(5, 1, 2),
(4, 3, 4);

-- VIAGEM -----------------------------------------------------------
INSERT INTO viagem (quilometros, origem, destino, nivel_conforto, preco, id_turno, id_periodo) VALUES
(12, 'Lisboa', 'Oeiras', 'basico', 15, 1, 1),
(25, 'Cascais', 'Lisboa', 'luxuoso', 35, 2, 2);

-- FATURA -----------------------------------------------------------
INSERT INTO fatura (data, valor_total, valor_pago, nif) VALUES
('2025-01-01', 15.00, 15.00, '987654321'),
('2025-01-02', 35.00, 35.00, '321654987');

-- PEDIDO VIAGEM -----------------------------------------------------------
INSERT INTO pedido_viagem (origem, destino, nivel_conforto, estado, n_passageiros) VALUES
('Lisboa', 'Sintra', 'basico', 'Em espera', 2),
('Oeiras', 'Cascais', 'luxuoso', 'Confirmado', 3);