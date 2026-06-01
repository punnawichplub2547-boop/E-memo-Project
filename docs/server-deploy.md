# Server Deploy Notes

This project can be deployed on a Linux server with plain Docker Engine. Docker Desktop is not required on the server.

## Recommended Runtime

Use `docker compose` with the included [compose.yaml](/D:/Hrproject/sandbox/compose.yaml) because it keeps the run command stable and supports restart policy cleanly.

## First Deploy

```bash
git clone <your-private-repo-url>
cd Hrproject/sandbox
docker compose up -d --build
```

The app will be available on port `3000`. Docker Compose also starts a MySQL 8 container for DB-1 schema validation; the app still uses in-memory prototype state until the read-path API is implemented.

## Keep It Running

The compose service uses:

```yaml
restart: unless-stopped
```

This means:

- the container starts again after Docker restarts
- the container starts again after server reboot, if the Docker service starts on boot
- the container stays down only if someone intentionally stops it

## Database Service

The Compose stack includes MySQL 8 for DB-1:

- database: `hr_ememo`
- app user: `hr_ememo`
- default dev password: `hr_ememo_dev_password`
- root dev password: `hr_ememo_root_password`
- default host port: `3307` mapped to MySQL container port `3306`
- schema init file: `db/init/001-db1-schema.sql`

Override the default dev credentials on a real server by setting `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and optionally `MYSQL_HOST_PORT` in the Compose environment or a `.env` file next to `compose.yaml`. Use `env.compose.example` as the starting template.

The schema init file runs only when the MySQL volume is created for the first time. If you need to recreate the database during prototype work, run:

```bash
docker compose down -v
docker compose up -d --build
```

This deletes the local MySQL volume. Use it only for disposable prototype data.

## Recommended Server Checks

Make sure Docker starts on boot:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

Check running status:

```bash
docker compose ps
docker compose logs -f
```

## Update Deploy

When new code is pushed:

```bash
cd Hrproject
git pull
cd sandbox
docker compose up -d --build
```

## Notes

- Current app mutations are still prototype in-memory state.
- MySQL is present for DB-1 schema validation; the app does not read/write it yet.
- If port `3000` is already used on the server, change the left side of `3000:3000` in `compose.yaml`.
- If port `3307` is already used on the server, set `MYSQL_HOST_PORT` to another free host port. The container-side port stays `3306`.
