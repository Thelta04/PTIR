FROM postgres:16-alpine

# These env vars are used by the entrypoint to create the DB and user
ENV POSTGRES_DB=tuxy_db
ENV POSTGRES_USER=tuxy_user
ENV POSTGRES_PASSWORD=ptir11

# Copy schema and seed data — files in /docker-entrypoint-initdb.d/ run
# automatically on first start, in alphabetical order
COPY schema.sql /docker-entrypoint-initdb.d/01_schema.sql
COPY inserts.sql /docker-entrypoint-initdb.d/02_inserts.sql
