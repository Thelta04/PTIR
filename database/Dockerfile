FROM postgres:16-alpine

# Copy schema and seed data - files in /docker-entrypoint-initdb.d/ run
# automatically on first start, in alphabetical order
COPY schema.sql /docker-entrypoint-initdb.d/01_schema.sql
COPY inserts.sql /docker-entrypoint-initdb.d/02_inserts.sql
