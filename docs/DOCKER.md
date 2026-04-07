# Docker Deployment

> One command to run humanenv in production. SQLite by default, MongoDB optional.

## Quick Start (SQLite)

```bash
# Generate a mnemonic (save this — it's your encryption key)
node -e "import('./packages/shared/src/crypto.ts').then(m => console.log(m.generateMnemonic()))"

# Start
HUMANENV_MNEMONIC="your twelve word mnemonic phrase here" \
BASIC_AUTH_PASSWORD="changeme" \
  docker-compose -f docker-compose.server.yml up -d

# Verify
curl http://localhost:3056/health
```

Admin UI: http://localhost:3056

## Quick Start (MongoDB)

```bash
HUMANENV_MNEMONIC="your twelve word mnemonic phrase here" \
BASIC_AUTH_PASSWORD="changeme" \
MONGODB_URI="mongodb://mongo:27017/humanenv" \
  docker-compose -f docker-compose.server.yml -f docker-compose.server.mongo.yml up -d
```

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `HUMANENV_MNEMONIC` | — | **Yes** | 12-word phrase for encryption key derivation |
| `BASIC_AUTH_PASSWORD` | `admin` | No | Admin UI password |
| `BASIC_AUTH_USERNAME` | `admin` | No | Admin UI username |
| `PORT` | `3056` | No | Server port |
| `MONGODB_URI` | — | No | MongoDB connection string (empty = SQLite) |
| `HTTPS_CERT_PATH` | — | No | TLS certificate path |
| `HTTPS_KEY_PATH` | — | No | TLS private key path |

## Data Persistence

| Mode | Docker Volume | Container Path |
|------|--------------|----------------|
| SQLite | `humanenv-data` | `/data/humanenv/humanenv.db` |
| MongoDB | `mongo-data` | `/data/db` |

## Backup

```bash
# SQLite
docker-compose -f docker-compose.server.yml down
docker run --rm -v humanenv-data:/src:ro -v $(pwd):/out alpine \
  tar czf /out/humanenv-$(date +%Y%m%d).tar.gz -C /src .

# MongoDB
docker-compose exec mongo mongodump --out /data/backup
```

## Production Checklist

| Item | Action |
|------|--------|
| Mnemonic | Generate, store in secrets manager, set as `HUMANENV_MNEMONIC` |
| Admin password | Change from default `admin` |
| HTTPS | Set `HTTPS_CERT_PATH` + `HTTPS_KEY_PATH` |
| Network | Bind to localhost: `127.0.0.1:3056:3056` |
| Firewall | Restrict access to trusted IPs |
| Backups | Schedule regular volume snapshots |
| Monitoring | Health check: `GET /health` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Container won't start | `docker-compose logs` — check port conflicts (`lsof -i :3056`) |
| PK not loaded after restart | Verify `HUMANENV_MNEMONIC` is set in environment |
| MongoDB unhealthy | `docker-compose ps` — check mongo service status |
| Volume missing | `docker volume inspect humanenv-data` |
