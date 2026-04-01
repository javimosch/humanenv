# HumanEnv Server - Docker Deployment Guide

## Quick Start

### SQLite Mode (Default)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate and save your mnemonic (CRITICAL - store securely!)
docker-compose -f docker-compose.server.yml run --rm humanenv-server \
  node -e "console.log(require('./packages/shared/src/crypto.ts').generateMnemonic())"

# 3. Add the mnemonic to .env
# HUMANENV_MNEMONIC=word1 word2 word3...

# 4. Change default admin password in .env
# BASIC_AUTH_PASSWORD=your-strong-password

# 5. Start the server
docker-compose -f docker-compose.server.yml up -d

# 6. Access admin UI
# http://localhost:3056
```

### MongoDB Mode

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Set MongoDB URI in .env
# MONGODB_URI=mongodb://mongo:27017/humanenv

# 3. Generate and save your mnemonic

# 4. Start with MongoDB override
docker-compose -f docker-compose.server.yml -f docker-compose.server.mongo.yml up -d

# 5. Access admin UI
# http://localhost:3056
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3056` | No |
| `MONGODB_URI` | MongoDB connection (leave empty for SQLite) | - | No |
| `HUMANENV_MNEMONIC` | 12-word recovery phrase for PK | - | Yes (for persistence) |
| `BASIC_AUTH_USERNAME` | Admin UI username | `admin` | No |
| `BASIC_AUTH_PASSWORD` | Admin UI password | `admin` | No |
| `HTTPS_CERT_PATH` | TLS certificate path | - | No |
| `HTTPS_KEY_PATH` | TLS key path | - | No |

## Data Persistence

### SQLite Mode
Data is stored in a named volume `humanenv-data`:
- SQLite database: `/data/humanenv/humanenv.db`
- Credentials: `/home/humanenv/.humanenv/credentials.json`

### MongoDB Mode
Data is stored in a named volume `mongo-data`:
- MongoDB data: `/data/db`

## Backup & Restore

### Backup SQLite Database

```bash
# Stop the container
docker-compose -f docker-compose.server.yml down

# Backup the volume
docker run --rm \
  -v humanenv-data:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/humanenv-backup-$(date +%Y%m%d).tar.gz -C /source .
```

### Restore SQLite Database

```bash
# Stop the container
docker-compose -f docker-compose.server.yml down

# Restore the volume
docker run --rm \
  -v humanenv-data:/target \
  -v $(pwd):/backup \
  alpine tar xzf /backup/humanenv-backup-YYYYMMDD.tar.gz -C /target
```

### Backup MongoDB

```bash
docker-compose -f docker-compose.server.yml -f docker-compose.server.mongo.yml exec mongo \
  mongodump --out /data/backup
```

## Security Considerations

### 1. Store Mnemonic Securely

The `HUMANENV_MNEMONIC` is the master key for all encrypted data:
- Store it in a secrets manager (Docker secrets, AWS Secrets Manager, etc.)
- Never commit it to version control
- If lost, all data is unrecoverable

### 2. Change Default Credentials

Always change the default admin password:
```bash
BASIC_AUTH_PASSWORD=your-very-strong-password-min-12-chars
```

### 3. Enable HTTPS in Production

For production deployments, enable HTTPS:
```bash
# Generate self-signed cert (or use Let's Encrypt)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/server.key -out certs/server.crt

# Mount in docker-compose.server.yml:
# volumes:
#   - ./certs:/certs:ro
# environment:
#   - HTTPS_CERT_PATH=/certs/server.crt
#   - HTTPS_KEY_PATH=/certs/server.key
```

### 4. Network Isolation

The server runs on an isolated bridge network. Only expose the port you need:
```bash
# Only expose to localhost (recommended)
ports:
  - "127.0.0.1:3056:3056"

# Then use a reverse proxy (nginx, traefik) for external access
```

### 5. Read-Only Filesystem (Advanced)

For maximum security, enable read-only root filesystem:
```yaml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp:noexec,nosuid,size=100m
```

Note: Requires adjusting volume mounts for writable directories.

## Health Check

The container includes a health check:
```bash
docker-compose -f docker-compose.server.yml ps
# Should show "healthy" after startup

# Manual check
curl http://localhost:3056/health
```

## Logs

```bash
# View logs
docker-compose -f docker-compose.server.yml logs -f

# View last 100 lines
docker-compose -f docker-compose.server.yml logs --tail=100
```

## Development Mode

Use the development target for hot reload:
```bash
docker-compose -f docker-compose.server.yml up \
  --build \
  --target development
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.server.yml logs

# Check if port is in use
lsof -i :3056
```

### PK not loaded after restart

Ensure `HUMANENV_MNEMONIC` is set correctly in `.env`:
```bash
docker-compose -f docker-compose.server.yml exec humanenv-server env | grep HUMANENV
```

### Database connection issues

```bash
# SQLite: Check volume exists
docker volume inspect humanenv-data

# MongoDB: Check container is healthy
docker-compose -f docker-compose.server.yml -f docker-compose.server.mongo.yml ps
```

## Production Checklist

- [ ] Mnemonic generated and stored securely
- [ ] Default admin password changed
- [ ] HTTPS enabled (if exposing to internet)
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring/alerting configured
- [ ] Log aggregation set up
- [ ] Rate limiting configured (reverse proxy)
- [ ] Container resource limits set
