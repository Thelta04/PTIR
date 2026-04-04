# 1. Drop the old database
sudo -u postgres dropdb --if-exists tuxy_db

# 2. Create a fresh, clean database
sudo -u postgres createdb tuxy_db

# 3. Grant base permissions (DB access and schema access)
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tuxy_db TO tuxy_user;"
sudo -u postgres psql -d tuxy_db -c "GRANT ALL ON SCHEMA public TO tuxy_user;"

# 4. Create the tables
sudo -u postgres psql -d tuxy_db -f schema.sql

# 5. THE MAGIC KEYS: Grant Django permissions on the newly created tables and sequences!
sudo -u postgres psql -d tuxy_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tuxy_user;"
sudo -u postgres psql -d tuxy_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tuxy_user;"

# 6. Insert test data
sudo -u postgres psql -d tuxy_db -f inserts.sql