# HumanEnv Docker Deployment

## Quick Start (SQLite)

```bash
cp .env.example .env
# Generate mnemonic:
node -e "import('./packages/shared/src/crypto.ts').then(m => console.log(m.generateMnemonic()))"
# Edit .env: set HUMANENV_MNEMONIC and BASIC_AUTH_PASSWORD
docker-compose -f docker-compose.server.yml up -d
# Admin UI: http://localhost:3056
```

## Quick Start (MongoDB)

```bash
cp .env.example .env
# Edit .env: set MONGODB_URI, HUMANENV_MNEMONIC, BASIC_AUTH_PASSWORD
docker-compose -f docker-compose.server.yml -f docker-compose.server.mongo.yml up -d
```

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3056` | No | Server port |
| `MONGODB_URI` | — | No | MongoDB connection (empty = SQLite) |
| `HUMANENV_MNEMONIC` | — | Yes | 12-word recovery phrase for encryption PK |
| `BASIC_AUTH_USERNAME` | `admin` | No | Admin UI username |
| `BASIC_AUTH_PASSWORD` | `admin` | No | Admin UI password |
| `HTTPS_CERT_PATH` | — | No | TLS certificate path |
| `HTTPS_KEY_PATH` | — | No | TLS key path |

---

## Data Persistence

| Mode | Volume | Path |
|------|--------|------|
| SQLite | `humanenv-data` | `/data/humanenv/humanenv.db` |
| MongoDB | `mongo-data` | `/data/db` |

---

## Backup & Restore

### SQLite

```bash
# Backup
docker-compose -f docker-compose.server.yml down
docker run --rm -v humanenv-data:/source:ro -v $(pwd):/backup \
  alpine tar czf /backup/humanenv-backup-$(date +%Y%m%d).tar.gz -C /source .

# Restore
docker run --rm -v humanenv-data:/target -v $(pwd):/backup \
  alpine tar xzf /backup/humanenv-backup-YYYYMMDD.tar.gz -C /target
```

### MongoDB

```bash
docker-compose -f docker-compose.server.yml -f docker-compose.server.mongo.yml \
  exec mongo mongodump --out /data/backup
```

---

## Security

| Concern | Action |
|---------|--------|
| Mnemonic | Store in secrets manager, never commit to VCS |
| Admin password | Change from default `admin` |
| HTTPS | Enable for production (set `HTTPS_CERT_PATH` + `HTTPS_KEY_PATH`) |
| Network | Bind to localhost only: `127.0.0.1:3056:3056` |
| Filesystem | Optional: `read_only: true` + tmpfs mounts |

---

## Health Check

```bash
curl http://localhost:3056/health
docker-compose -f docker-compose.server.yml ps  # shows "healthy"
```

## Logs

```bash
docker-compose -f docker-compose.server.yml logs -f
docker-compose -f docker-compose.server.yml logs --tail=100
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Container won't start | `docker-compose logs` / check `lsof -i :3056` |
| PK not loaded after restart | Verify `HUMANENV_MNEMONIC` in `.env` |
| SQLite volume missing | `docker volume inspect humanenv-data` |
| MongoDB unhealthy | `docker-compose ps` on mongo service |

---

## Production Checklist

| Item | Status |
|------|--------|
| Mnemonic generated and stored securely | ☐ |
| Default admin password changed | ☐ |
| HTTPS enabled | ☐ |
| Firewall rules configured | ☐ |
| Backup strategy implemented | ☐ |
| Monitoring/alerting configured | ☐ |
| Container resource limits set | ☐ |
