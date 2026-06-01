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

The app will be available on port `3000`. Docker Compose also starts a MySQL 8 container. The app loads initial memo data from `GET /api/memos` when the DB is available. New memo creation, approval advancement, and return-for-revision are persisted to DB; later workflow mutations (reject, read, revision) still remain in-memory prototype state.

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

Seed the DB-1 tables from the current prototype `seedMemos` data:

```bash
npm.cmd run db:seed
```

The seed script inserts eight memos and one `submit` workflow action per memo. It clears the four DB-1 tables first, so use it only for disposable prototype data until DB-2 write persistence exists.

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

- New memo creation, approval advancement, and return-for-revision are persisted to DB.
- Reject, read, and revision mutations are still prototype in-memory state.
- MySQL backs the DB-1 read path through `GET /api/memos`; write persistence starts in DB-2.
- If port `3000` is already used on the server, change the left side of `3000:3000` in `compose.yaml`.
- If port `3307` is already used on the server, set `MYSQL_HOST_PORT` to another free host port. The container-side port stays `3306`.
