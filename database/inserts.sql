-- TAXI

INSERT INTO taxi (license_plate, purchase_year, mileage, brand, model, comfort_level, engine_type, num_passengers)
VALUES ('AA-11-BB', 2018, 120000, 'Smart', 'Fortwo', 'basic', 'combustion', 2),
       ('CC-22-DD', 2021, 80000, 'Mercedes', 'E200', 'luxury', 'combustion', 4),
       ('EE-33-FF', 2023, 50000, 'Tesla', 'Model 3', 'luxury', 'electric', 4),
       ('GG-44-HH', 2019, 210000, 'Toyota', 'Prius', 'basic', 'combustion', 4),
       ('II-55-JJ', 2022, 45000, 'Kia', 'EV6', 'luxury', 'electric', 4),
       ('KK-66-LL', 2020, 150000, 'Renault', 'Trafic', 'basic', 'combustion', 6);

-- PRICING CONFIG

INSERT INTO config (id, price_per_min_basic, price_per_min_luxury, night_surcharge_percent)
VALUES (1, 0.25, 0.50, 25.00);

-- USER ACCOUNT

INSERT INTO user_account (nif, name, email, gender, password, is_banned, profile_pic)
VALUES ('123456789', 'Joao Silva', 'joao@email.com', 'Male', 'Joao123', false, 1),
       ('987654321', 'Maria Costa', 'maria@email.com', 'Female', 'Maria123', false, 1),
       ('456789123', 'Pedro Santos', 'pedro@email.com', 'Male', 'Pedro123', false, 1),
       ('321654987', 'Ana Ferreira', 'ana@email.com', 'Female', 'Ana123', false, 1),
       ('741852963', 'Carlos Mendes', 'carlos@email.com', 'Male', 'Carlos123', false, 1),
       ('111222333', 'Tiago Almeida', 'tiago@email.com', 'Male', 'Tiago123', false, 1),
       ('444555666', 'Sofia Ribeiro', 'sofia@email.com', 'Female', 'Sofia123', false, 2),
       ('777888999', 'Rui Silva', 'rui@email.com', 'Male', 'Rui123', true, 1),
       -- Banned user
('222333444', 'Beatriz Gomes', 'beatriz@email.com', 'Female', 'Beatriz123', false, 3),
                     ('555666777', 'Miguel Pinto', 'miguel@email.com', 'Male', 'Miguel123', false, 5);

-- DRIVER

INSERT INTO driver (id_user, license_number, birth_year)
VALUES (1, 'C1234567', 1985),
       (3, 'D7654321', 1990),
       (6, 'D1122334', 1988),
       (8, 'D9988776', 1975);

-- MANAGER

INSERT INTO manager (id_user)
VALUES (5),
       (9);

-- CLIENT

INSERT INTO client (id_user)
VALUES (1),
       (2),
       (3),
       (4),
       (7),
       (10),
       (6);

-- TIME_INTERVAL

INSERT INTO time_interval (start_time, end_time)
VALUES ('2025-01-01 08:00:00+00:00', '2025-01-01 16:00:00+00:00'),
       ('2025-01-01 16:00:00+00:00', '2025-01-02 00:00:00+00:00'),
       ('2025-01-01 10:00:00+00:00', '2025-01-01 10:20:00+00:00'),
       ('2025-01-01 18:00:00+00:00', '2025-01-01 18:45:00+00:00'),
       ('2025-01-01 11:00:00+00:00', '2025-01-01 11:30:00+00:00'),
       ('2025-01-01 19:00:00+00:00', '2025-01-01 19:40:00+00:00'),
       (CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '7 hours'),
       (CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL),
       ('2025-01-01 14:00:00+00:00', '2025-01-01 14:15:00+00:00'),
       ('2025-01-01 22:00:00+00:00', '2025-01-01 22:20:00+00:00'),
       (CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP);

-- SHIFT

INSERT INTO shift (id_taxi, id_driver, id_scheduled_interval, id_real_interval)
VALUES ('AA-11-BB', 1, 1, NULL),
       ('EE-33-FF', 3, 2, NULL),
       ('AA-11-BB', 1, 7, 8);

-- TRIP

INSERT INTO trip(id_client, kilometers, origin_coords, dest_coords, origin_address, dest_address, comfort_level, price, num_passengers, status, id_shift, id_interval)
VALUES (2, 12, '38.7223,-9.1393', '38.6970,-9.3017', 'Marquês de Pombal, Lisboa', 'Estação, Oeiras', 'basic', 15.00, 2, 'COMPLETED', 1, 5),
       (4, 25, '38.6970,-9.3017', '38.7223,-9.1393', 'Marina, Cascais', 'Saldanha, Lisboa', 'luxury', 35.00, 3, 'COMPLETED', 2, 6);

-- NEW PENDING TRIPS FOR TESTING

INSERT INTO time_interval (start_time, end_time)
VALUES (CURRENT_TIMESTAMP - INTERVAL '45 minutes', NULL),
       (CURRENT_TIMESTAMP - INTERVAL '300 minutes', NULL),
       (CURRENT_TIMESTAMP - INTERVAL '600 minutes', NULL),
       (CURRENT_TIMESTAMP, NULL);

-- REFUELING

INSERT INTO refueling (cost, kwh, liters, initial_mileage, id_shift, id_interval)
VALUES (40.00, NULL, 30, 120000, 1, 3),
       (25.00, 50, NULL, 50000, 2, 4),
       (35.00, NULL, 25, 120150, 1, 9),
       (15.00, 30, NULL, 50100, 2, 10),
       (45.00, NULL, 32, 120500, 3, 11);

-- RATING

INSERT INTO rating (score, id_trip)
VALUES (5, 1),
       (4, 2);

-- INVOICE

INSERT INTO invoice (id_trip, number, date, amount_total, amount_paid, nif)
VALUES (1, 0, '2025-01-02', 15.00, 15.00, '987654321'),
       (2, 2, '2025-01-03', 35.00, 35.00, '321654987');