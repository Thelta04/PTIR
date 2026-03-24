-- TAXI -----------------------------------------------------------
INSERT INTO taxi (matricula, quilometragem, marca, modelo, nivel_conforto, tipo_motor) VALUES
('AA-11-BB', 120000, 'Toyota',   'Prius', 'basico',  'combustao'),
('CC-22-DD',  80000, 'Mercedes', 'E200', 'luxuoso', 'combustao'),
('EE-33-FF',  50000, 'Tesla',    'Model 3', 'luxuoso', 'eletrico');

-- UTILIZADOR -----------------------------------------------------------
INSERT INTO utilizador (nif, nome, email, genero, senha, is_banned) VALUES
('123456789', 'Joao Silva',    'joao@email.com',   'masculino', 'Joao123', false),
('987654321', 'Maria Costa',   'maria@email.com',  'feminino',  'Maria123', false),
('456789123', 'Pedro Santos',  'pedro@email.com',  'masculino', 'Pedro123', false),
('321654987', 'Ana Ferreira',  'ana@email.com',    'feminino',  'Ana12345', false),
('741852963', 'Carlos Mendes', 'carlos@email.com', 'masculino', 'Carlos123', false);

-- MOTORISTA -----------------------------------------------------------
INSERT INTO motorista (id_user, carta_conducao, ano_nascimento) VALUES
(1, 'C1234567', 1985),
(3, 'D7654321', 1990);

-- GESTOR -----------------------------------------------------------
INSERT INTO gestor (id_user) VALUES
(5);

-- CLIENTE -----------------------------------------------------------
INSERT INTO cliente (id_user) VALUES
(2),
(4);

-- PERIODO_TEMPO -----------------------------------------------------------
-- 1 e 2 = turnos
-- 3 e 4 = reabastecimentos/carregamentos
-- 5 e 6 = viagens
INSERT INTO periodo_tempo (hora_inicio, hora_fim) VALUES
('2025-01-01 08:00:00', '2025-01-01 16:00:00'),
('2025-01-01 16:00:00', '2025-01-02 00:00:00'),
('2025-01-01 10:00:00', '2025-01-01 10:20:00'),
('2025-01-01 18:00:00', '2025-01-01 18:45:00'),
('2025-01-01 11:00:00', '2025-01-01 11:30:00'),
('2025-01-01 19:00:00', '2025-01-01 19:40:00');

-- TURNO -----------------------------------------------------------
INSERT INTO turno (id_taxi, id_motorista, id_periodo) VALUES
('AA-11-BB', 1, 1),
('EE-33-FF', 3, 2);

-- PEDIDO VIAGEM -----------------------------------------------------------
INSERT INTO pedido_viagem (origem, destino, nivel_conforto, estado, n_passageiros, id_cliente) VALUES
('Lisboa',  'Oeiras', 'basico',  'aceite', 2, 2),
('Cascais', 'Lisboa', 'luxuoso', 'aceite', 3, 4);

-- VIAGEM -----------------------------------------------------------
INSERT INTO viagem(id_cliente, quilometros, origem, destino, nivel_conforto, preco, id_turno, id_periodo) VALUES
(2, 12, 'Lisboa', 'Oeiras', 'basico', 15.00, 1, 5),
(4, 25, 'Cascais', 'Lisboa', 'luxuoso', 35.00, 2, 6);

-- REABASTECIMENTO -----------------------------------------------------------
INSERT INTO reabastecimento (euros, kwh, litros, quilometragem_inicial, id_turno, id_periodo) VALUES
(40.00, NULL, 30, 120000, 1, 3),
(25.00, 50,   NULL, 50000,  2, 4);

-- AVALIACAO -----------------------------------------------------------
INSERT INTO avaliacao (valor, id_viagem, id_motorista, id_cliente) VALUES
(5, 1, 1, 2),
(4, 2, 3, 4);

-- FATURA -----------------------------------------------------------
INSERT INTO fatura (id_viagem, numero, data, valor_total, valor_pago, nif) VALUES
(1, 1, '2025-01-02', 15.00, 15.00, '987654321'),
(2, 2, '2025-01-03', 35.00, 35.00, '321654987');