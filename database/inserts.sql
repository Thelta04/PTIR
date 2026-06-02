-- TAXI
INSERT INTO taxi (license_plate, purchase_year, mileage, brand, model, comfort_level, engine_type, num_passengers) VALUES
('AA-11-BB', 2018, 120000, 'Smart',    'Fortwo',   'basic',  'combustion', 2),
('CC-22-DD', 2021,  80000, 'Mercedes', 'E200',     'luxury', 'combustion', 4),
('EE-33-FF', 2023,  50000, 'Tesla',    'Model 3',  'luxury', 'electric',   4);

-- PRICING CONFIG
INSERT INTO config (id, price_per_min_basic, price_per_min_luxury, night_surcharge_percent) VALUES
(1, 0.25, 0.50, 25.00);

-- USER ACCOUNT
INSERT INTO user_account (nif, name, email, gender, password, is_banned) VALUES
('123456789', 'Joao Silva',    'joao@email.com',   'Male',   'Joao123',   false),
('987654321', 'Maria Costa',   'maria@email.com',  'Female', 'Maria123',  false),
('456789123', 'Pedro Santos',  'pedro@email.com',  'Male',   'Pedro123',  false),
('321654987', 'Ana Ferreira',  'ana@email.com',    'Female', 'Ana123',    false),
('741852963', 'Carlos Mendes', 'carlos@email.com', 'Male',   'Carlos123', false);

-- DRIVER
INSERT INTO driver (id_user, license_number, birth_year) VALUES
(1, 'C1234567', 1985),
(3, 'D7654321', 1990);

-- MANAGER
INSERT INTO manager (id_user) VALUES
(5);

-- CLIENT
INSERT INTO client (id_user) VALUES
(1),
(2),
(3),
(4);

-- TIME_INTERVAL
INSERT INTO time_interval (start_time, end_time) VALUES
('2025-01-01 08:00:00+00:00', '2025-01-01 16:00:00+00:00'),
('2025-01-01 16:00:00+00:00', '2025-01-02 00:00:00+00:00'),
('2025-01-01 10:00:00+00:00', '2025-01-01 10:20:00+00:00'),
('2025-01-01 18:00:00+00:00', '2025-01-01 18:45:00+00:00'),
('2025-01-01 11:00:00+00:00', '2025-01-01 11:30:00+00:00'),
('2025-01-01 19:00:00+00:00', '2025-01-01 19:40:00+00:00'),
(CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '7 hours'),
(CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL);

-- SHIFT
INSERT INTO shift (id_taxi, id_driver, id_scheduled_interval, id_real_interval) VALUES
('AA-11-BB', 1, 1, NULL),
('EE-33-FF', 3, 2, NULL),
('AA-11-BB', 1, 7, 8);

-- TRIP
INSERT INTO trip(id_client, kilometers, origin_coords, dest_coords, origin_address, dest_address, comfort_level, price, num_passengers, status, id_shift, id_interval) VALUES
(2, 12, '38.7223,-9.1393', '38.6970,-9.3017', 'Marquês de Pombal, Lisboa', 'Estação, Oeiras', 'basic',  15.00, 2, 'COMPLETED', 1, 5),
(4, 25, '38.6970,-9.3017', '38.7223,-9.1393', 'Marina, Cascais',           'Saldanha, Lisboa', 'luxur   ', 35.00, 3, 'COMPLETED', 2, 6);

-- NEW PENDING TRIPS FOR TESTING
INSERT INTO time_interval (start_time, end_time) VALUES
(CURRENT_TIMESTAMP - INTERVAL '45 minutes', NULL),
(CURRENT_TIMESTAMP - INTERVAL '300 minutes', NULL),
(CURRENT_TIMESTAMP - INTERVAL '600 minutes', NULL),
(CURRENT_TIMESTAMP, NULL);

INSERT INTO trip (id_client, kilometers, origin_coords, dest_coords, origin_address, dest_address, comfort_level, price, num_passengers, status, id_shift, id_interval) VALUES
(2, 5,  '38.7111,-9.1368', '38.7369,-9.1427', 'Rossio, Lisboa',            'Saldanha, Lisboa',          'basic',   6.50, 1, 'PENDING', NULL, 9),
(4, 15, '38.7616,-9.0937', '38.7223,-9.1393', 'Parque das Nações, Lisboa', 'Marquês de Pombal, Lisboa', 'luxury', 25.00, 2, 'PENDING', NULL, 10),
(2, 3,  '38.7071,-9.1355', '38.7134,-9.1363', 'Praça do Comércio, Lisboa', 'Martim Moniz, Lisboa',      'basic',   4.90, 4, 'PENDING', NULL, 11),
(4, 8,  '38.7490,-9.1824', '38.7306,-9.1456', 'Benfica, Lisboa',           'El Corte Inglés, Lisboa',   'basic',  14.50, 2, 'PENDING', NULL, 12);

-- REFUELING
INSERT INTO refueling (cost, kwh, liters, initial_mileage, id_shift, id_interval) VALUES
(40.00, NULL, 30,   120000, 1, 3),
(25.00, 50,   NULL, 50000,  2, 4);

-- RATING
INSERT INTO rating (score, id_trip) VALUES
(5, 1),
(4, 2);

-- INVOICE
INSERT INTO invoice (id_trip, number, date, amount_total, amount_paid, nif) VALUES
(1, 1, '2025-01-02', 15.00, 15.00, '987654321'),
(2, 2, '2025-01-03', 35.00, 35.00, '321654987');
