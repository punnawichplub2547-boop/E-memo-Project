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

The app will be available on port `3000`.

## Keep It Running

The compose service uses:

```yaml
restart: unless-stopped
```

This means:

- the container starts again after Docker restarts
- the container starts again after server reboot, if the Docker service starts on boot
- the container stays down only if someone intentionally stops it

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

- Current app is a frontend-only prototype.
- No persistent database is required yet.
- If port `3000` is already used on the server, change the left side of `3000:3000` in `compose.yaml`.
