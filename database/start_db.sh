# 1. Apaga a base de dados antiga 
sudo -u postgres dropdb --if-exists tuxy_db

# 2. Cria uma base de dados nova e limpa
sudo -u postgres createdb tuxy_db

# 3. Dá as permissões base (Acesso à BD e ao Schema)
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tuxy_db TO tuxy_user;"
sudo -u postgres psql -d tuxy_db -c "GRANT ALL ON SCHEMA public TO tuxy_user;"

# 4. Cria as tabelas
sudo -u postgres psql -d tuxy_db -f schema.sql

# 5. AS CHAVES MÁGICAS: Dá permissões ao Django sobre as tabelas e IDs recém-criados!
sudo -u postgres psql -d tuxy_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tuxy_user;"
sudo -u postgres psql -d tuxy_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tuxy_user;"

# 6. Insere os teus dados de teste
sudo -u postgres psql -d tuxy_db -f inserts.sql