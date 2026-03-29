-- TAXI
INSERT INTO taxi (matricula, ano_compra, quilometragem, marca, modelo, nivel_conforto, tipo_motor, n_passageiros) VALUES
('AA-11-BB', 2018, 120000, 'Toyota',   'Prius', 'basico',  'combustao', 4),
('CC-22-DD', 2021,  80000, 'Mercedes', 'E200', 'luxuoso', 'combustao', 4),
('EE-33-FF', 2023,  50000, 'Tesla',    'Model 3', 'luxuoso', 'eletrico', 4);

-- UTILIZADOR
INSERT INTO utilizador (nif, nome, email, genero, senha, is_banned) VALUES
('123456789', 'Joao Silva',    'joao@email.com',   'masculino', 'Joao123', false),
('987654321', 'Maria Costa',   'maria@email.com',  'feminino',  'Maria123', false),
('456789123', 'Pedro Santos',  'pedro@email.com',  'masculino', 'Pedro123', false),
('321654987', 'Ana Ferreira',  'ana@email.com',    'feminino',  'Ana12345', false),
('741852963', 'Carlos Mendes', 'carlos@email.com', 'masculino', 'Carlos123', false);

-- MOTORISTA
INSERT INTO motorista (id_user, carta_conducao, ano_nascimento) VALUES
(1, 'C1234567', 1985),
(3, 'D7654321', 1990);

-- GESTOR
INSERT INTO gestor (id_user) VALUES
(5);

-- CLIENTE
INSERT INTO cliente (id_user) VALUES
(2),
(4);

-- PERIODO_TEMPO
INSERT INTO periodo_tempo (hora_inicio, hora_fim) VALUES
('2025-01-01 08:00:00', '2025-01-01 16:00:00'),
('2025-01-01 16:00:00', '2025-01-02 00:00:00'),
('2025-01-01 10:00:00', '2025-01-01 10:20:00'),
('2025-01-01 18:00:00', '2025-01-01 18:45:00'),
('2025-01-01 11:00:00', '2025-01-01 11:30:00'),
('2025-01-01 19:00:00', '2025-01-01 19:40:00');

-- TURNO
INSERT INTO turno (id_taxi, id_motorista, id_periodo) VALUES
('AA-11-BB', 1, 1),
('EE-33-FF', 3, 2);

-- VIAGEM
INSERT INTO viagem(id_cliente, quilometros, origem_coords, destino_coords, origem_morada, destino_morada, nivel_conforto, preco, n_passageiros, estado, id_turno, id_periodo) VALUES
(2, 12, '38.7223,-9.1393', '38.6970,-9.3017', 'Marquês de Pombal, Lisboa', 'Estação, Oeiras', 'basico', 15.00, 2, 'CONCLUIDA', 1, 5),
(4, 25, '38.6970,-9.3017', '38.7223,-9.1393', 'Marina, Cascais', 'Saldanha, Lisboa', 'luxuoso', 35.00, 3, 'CONCLUIDA', 2, 6);

-- REABASTECIMENTO
INSERT INTO reabastecimento (euros, kwh, litros, quilometragem_inicial, id_turno, id_periodo) VALUES
(40.00, NULL, 30, 120000, 1, 3),
(25.00, 50,   NULL, 50000,  2, 4);

-- AVALIACAO
INSERT INTO avaliacao (valor, id_viagem) VALUES
(5, 1),
(4, 2);

-- FATURA
INSERT INTO fatura (id_viagem, numero, data, valor_total, valor_pago, nif) VALUES
(1, 1, '2025-01-02', 15.00, 15.00, '987654321'),
(2, 2, '2025-01-03', 35.00, 35.00, '321654987');