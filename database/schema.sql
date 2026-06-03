DROP TABLE IF EXISTS rating, invoice, trip, refueling, shift, time_interval, driver, manager, client, user_account, taxi, config CASCADE;

-- TAXI
CREATE TABLE taxi ( 
    license_plate VARCHAR(10) PRIMARY KEY, 
    purchase_year INT NOT NULL,
    mileage INT NOT NULL,
    brand VARCHAR(40) NOT NULL,
    model VARCHAR(40) NOT NULL,
    comfort_level VARCHAR(10) NOT NULL,  
    engine_type VARCHAR(40) NOT NULL,
    num_passengers INT NOT NULL
);

-- PRICING CONFIG
CREATE TABLE config (
    id SERIAL PRIMARY KEY,
    price_per_min_basic DECIMAL(6,2) NOT NULL,
    price_per_min_luxury DECIMAL(6,2) NOT NULL,
    night_surcharge_percent DECIMAL(5,2) NOT NULL
);

-- USERS
CREATE TABLE user_account (
    id SERIAL PRIMARY KEY,
    nif VARCHAR(9) NOT NULL UNIQUE, 
    name VARCHAR(60) NOT NULL,
    email VARCHAR(60),
    gender VARCHAR(15) NOT NULL, 
    password VARCHAR(255) NOT NULL,
    is_banned BOOLEAN DEFAULT FALSE,
    profile_pic INT NOT NULL DEFAULT 1
);

-- DRIVER 
CREATE TABLE driver (
    id_user INTEGER PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE, 
    license_number VARCHAR(12) NOT NULL,
    birth_year INT NOT NULL
);

-- MANAGER
CREATE TABLE manager (
    id_user INTEGER PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE
);

-- CLIENT
CREATE TABLE client (
    id_user INTEGER PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE
);

-- TIME INTERVAL
CREATE TABLE time_interval (
    id_interval SERIAL PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP
);

-- SHIFT
CREATE TABLE shift (
    id SERIAL PRIMARY KEY,
    id_taxi VARCHAR(10) REFERENCES taxi(license_plate), 
    id_driver INTEGER NOT NULL REFERENCES driver(id_user),
    id_scheduled_interval INTEGER NOT NULL REFERENCES time_interval(id_interval),
    id_real_interval INTEGER REFERENCES time_interval(id_interval)
);

-- REFUELING
CREATE TABLE refueling (
    id SERIAL PRIMARY KEY,
    cost DECIMAL(10,2),
    kwh INT,
    liters INT,
    initial_mileage INT NOT NULL,
    id_shift INTEGER NOT NULL REFERENCES shift(id),
    id_interval INTEGER NOT NULL REFERENCES time_interval(id_interval)
);

-- TRIP
CREATE TABLE trip (
    id SERIAL PRIMARY KEY,
    kilometers INT NOT NULL,
    origin_coords VARCHAR(255) NOT NULL,
    dest_coords VARCHAR(255) NOT NULL,
    origin_address VARCHAR(255) NOT NULL,
    dest_address VARCHAR(255) NOT NULL,
    comfort_level VARCHAR(10) NOT NULL,
    price DECIMAL(10,2) NOT NULL, 
    num_passengers INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    id_client INTEGER NOT NULL REFERENCES client(id_user) ON DELETE CASCADE,
    id_shift INTEGER REFERENCES shift(id),
    id_interval INTEGER NOT NULL REFERENCES time_interval(id_interval)
);

-- RATING
CREATE TABLE rating (
    id_trip INTEGER PRIMARY KEY NOT NULL REFERENCES trip(id),
    score INT NOT NULL
);

-- INVOICE
CREATE TABLE invoice (
    id_trip INTEGER PRIMARY KEY REFERENCES trip(id),
    number INT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_total DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    nif VARCHAR(9) NOT NULL,
    year INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::INT) STORED
);


-- ==============================================================================
-- CONSTRAINTS (SIMPLE INTEGRITY RULES)
-- ==============================================================================

ALTER TABLE user_account
    ADD CONSTRAINT uq_user_account_email UNIQUE (email),
    ADD CONSTRAINT chk_user_nif CHECK (nif ~ '^[1-9][0-9]{8}$'), -- RIA 12
    ADD CONSTRAINT chk_user_gender CHECK (gender IN ('Male', 'Female', 'Other')), -- RIA 13
    ADD CONSTRAINT chk_user_profile_pic CHECK (profile_pic BETWEEN 1 AND 12),
    ADD CONSTRAINT chk_user_password CHECK (char_length(password) >= 6 AND password ~ '[A-Za-z]' AND password ~ '[0-9]'); -- RIA 15

ALTER TABLE driver
    ADD CONSTRAINT uq_driver_license UNIQUE (license_number), -- RIA 14
    ADD CONSTRAINT chk_driver_minimum_age CHECK (birth_year <= EXTRACT(YEAR FROM CURRENT_DATE)::INT - 18), -- RIA 4
    ADD CONSTRAINT chk_driver_birth_year CHECK (birth_year >= 1900);

ALTER TABLE taxi
    ADD CONSTRAINT chk_taxi_engine_type CHECK (engine_type IN ('combustion', 'electric')), -- RIA 17
    ADD CONSTRAINT chk_taxi_brand_model_not_empty CHECK (brand <> '' AND model <> ''),
    ADD CONSTRAINT chk_taxi_mileage CHECK (mileage >= 0),
    ADD CONSTRAINT chk_taxi_comfort_level CHECK (comfort_level IN ('basic', 'luxury')), -- RIA 16
    ADD CONSTRAINT chk_taxi_num_passengers CHECK (num_passengers BETWEEN 1 AND 6); -- RIA 18

ALTER TABLE config
    ADD CONSTRAINT chk_config_basic_price_positive CHECK (price_per_min_basic > 0),
    ADD CONSTRAINT chk_config_luxury_price_positive CHECK (price_per_min_luxury > 0),
    ADD CONSTRAINT chk_config_night_surcharge_non_negative CHECK (night_surcharge_percent >= 0);

ALTER TABLE time_interval
    ADD CONSTRAINT chk_interval_time CHECK (start_time < end_time); -- RIA 1

ALTER TABLE shift
    ADD CONSTRAINT uq_shift_taxi_interval UNIQUE (id_taxi, id_scheduled_interval),
    ADD CONSTRAINT uq_shift_driver_interval UNIQUE (id_driver, id_scheduled_interval);

ALTER TABLE refueling
    ADD CONSTRAINT chk_refueling_mileage CHECK (initial_mileage > 0), -- RIA 25
    ADD CONSTRAINT chk_refueling_cost CHECK (cost > 0), -- RIA 24
    ADD CONSTRAINT chk_refueling_quantity CHECK (
        num_nonnulls(liters, kwh) = 1
        AND (liters IS NULL OR liters > 0) -- RIA 22
        AND (kwh IS NULL OR kwh > 0) -- RIA 23
    );
    
ALTER TABLE trip
    ADD CONSTRAINT chk_trip_comfort CHECK (comfort_level IN ('basic', 'luxury')),
    ADD CONSTRAINT chk_trip_passengers CHECK (num_passengers BETWEEN 1 AND 6),
    ADD CONSTRAINT chk_trip_status CHECK (status IN ('PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS', 'WAITING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELED'));

ALTER TABLE invoice
    ADD CONSTRAINT uq_invoice_year_number UNIQUE (year, number),
    ADD CONSTRAINT chk_invoice_number CHECK (number >= 1), -- RIA 21
    ADD CONSTRAINT chk_invoice_values CHECK (amount_total > 0 AND amount_paid >= 0 AND amount_paid <= amount_total),
    ADD CONSTRAINT chk_invoice_nif CHECK (nif ~ '^[1-9][0-9]{8}$');

ALTER TABLE rating
    ADD CONSTRAINT chk_rating_score CHECK (score BETWEEN 1 AND 5);


-- ==============================================================================
-- TRIGGERS (COMPLEX AND CROSS-TABLE INTEGRITY RULES)
-- ==============================================================================

-- RIA 28: Rating only for COMPLETED trips
CREATE OR REPLACE FUNCTION fn_validate_rating() RETURNS TRIGGER AS $$BEGIN
    IF (SELECT status FROM trip WHERE id = NEW.id_trip) != 'COMPLETED' THEN
        RAISE EXCEPTION 'RIA 28: A client can only rate a trip when its status is COMPLETED.';
    END IF;
    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_rating
BEFORE INSERT OR UPDATE ON rating
FOR EACH ROW EXECUTE FUNCTION fn_validate_rating();

-- RIA 2 and RIA 5: Shift duration and Taxi purchase year
CREATE OR REPLACE FUNCTION fn_validate_shift() RETURNS TRIGGER AS $$DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_purchase_year INT;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM time_interval WHERE id_interval = NEW.id_scheduled_interval;
    SELECT purchase_year INTO v_purchase_year FROM taxi WHERE license_plate = NEW.id_taxi;

    IF EXTRACT(EPOCH FROM (v_end_time - v_start_time))/3600 > 8 THEN
        RAISE EXCEPTION 'RIA 2: A scheduled shift cannot last more than 8 hours.';
    END IF;

    IF v_purchase_year > EXTRACT(YEAR FROM v_start_time) THEN
        RAISE EXCEPTION 'RIA 5: The taxi purchase year cannot be later than the shift year.';
    END IF;

    IF NEW.id_real_interval IS NOT NULL THEN
        SELECT start_time, end_time INTO v_start_time, v_end_time FROM time_interval WHERE id_interval = NEW.id_real_interval;
        IF EXTRACT(EPOCH FROM (v_end_time - v_start_time))/3600 > 8 THEN
            RAISE EXCEPTION 'RIA 2: A real shift cannot last more than 8 hours.';
        END IF;
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_shift
BEFORE INSERT OR UPDATE ON shift
FOR EACH ROW EXECUTE FUNCTION fn_validate_shift();

-- RIA 3: Trip must be contained within the Shift
CREATE OR REPLACE FUNCTION fn_validate_trip() RETURNS TRIGGER AS $$DECLARE
    v_trip_start TIMESTAMP;
    v_trip_end TIMESTAMP;
    v_shift_start TIMESTAMP;
    v_shift_end TIMESTAMP;
BEGIN
    SELECT start_time, end_time INTO v_trip_start, v_trip_end FROM time_interval WHERE id_interval = NEW.id_interval;
    
    SELECT ti.start_time, ti.end_time INTO v_shift_start, v_shift_end 
    FROM shift s JOIN time_interval ti ON COALESCE(s.id_real_interval, s.id_scheduled_interval) = ti.id_interval 
    WHERE s.id = NEW.id_shift;

    IF v_trip_start < (v_shift_start - INTERVAL '24 hours') OR v_trip_end > v_shift_end THEN
        RAISE EXCEPTION 'RIA 3: The trip period must be contained within the corresponding shift period.';
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_trip
BEFORE INSERT OR UPDATE ON trip
FOR EACH ROW EXECUTE FUNCTION fn_validate_trip();

-- RIA 8: Invoice must be after the trip
CREATE OR REPLACE FUNCTION fn_validate_invoice() RETURNS TRIGGER AS $$DECLARE
    v_trip_start TIMESTAMP;
BEGIN
    SELECT ti.start_time INTO v_trip_start 
    FROM trip t JOIN time_interval ti ON t.id_interval = ti.id_interval 
    WHERE t.id = NEW.id_trip;

    IF NEW.date < DATE(v_trip_start) THEN
        RAISE EXCEPTION 'RIA 8: The invoice date cannot be earlier than the trip start date.';
    END IF;

    RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_invoice
BEFORE INSERT OR UPDATE ON invoice
FOR EACH ROW EXECUTE FUNCTION fn_validate_invoice();
