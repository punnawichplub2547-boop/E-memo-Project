FROM mysql:8.4

# Make the in-container mysql CLIENT default to utf8mb4 so migrations/imports run
# via `docker exec hr-ememo-db mysql ...` never fall back to latin1 and double-
# encode Thai into mojibake. Baked into the image (not a bind-mounted .cnf) because
# Windows bind-mounts are world-writable and mysqld/mysql ignore those config files
# for security. (MySQL 8.4 removed --skip-character-set-client-handshake, so setting
# the client default is the reliable cross-platform way.) See db/migrations/README.md.
COPY charset.cnf /etc/mysql/conf.d/charset.cnf
RUN chmod 0644 /etc/mysql/conf.d/charset.cnf
